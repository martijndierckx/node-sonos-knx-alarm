// Notes
// Tested with a single Sonos One gen2

// Config
const targetRoom = 'Slaapkamer';
const discoverDevicesEvery = 60; //Seconds
const discoverAlarmsEvery = 5; //Seconds
const knx = {
	host: '192.168.5.198',
	port: 6720
};
const appliances = [
	/*{
		type: 'SHUTTER',
		name: 'Rolluik links',
		startTime: 295, //Seconds - Time before alarm when the shutters should open
		openLevel: 100, //Percentage,
		knx: {
			moveTo: '2/2/1',
			currentPosition: '2/3/1'
		}
	},
	{
		type: 'SHUTTER',
		name: 'Rolluik rechts',
		startTime: 295, //Seconds - Time before alarm when the shutters should open
		openLevel: 100, //Percentage,
		knx: {
			currentPosition: '2/3/2'
			moveTo: '2/2/2',
		}
	},*/
	{
		type: 'SHUTTER',
		name: 'Screen',
		startTime: 295, //Seconds - Time before alarm when the shutters should open
		openLevel: 100, //Percentage,
		knx: {
			moveTo: '2/2/4',
			currentPosition: '2/3/4'
		}
	},
	{
		type: 'LIGHT',
		name: 'LED Strip',
		dimmable: true,
		startTime: 5*60, //Seconds - Time before alarm when light should start turning on
		dimLevelStart: 1, //Percentage
		dimLevelEnd: 80, //Percentage
		knx: {
			switch: '0/0/1',
			switchStatus: '0/1/1',
			dim: '0/3/1', // Absolute (not relative)
			dimStatus: '0/4/1'
		}
	},
	{
		type: 'LIGHT',
		name: 'Dresser lights',
		dimmable: false,
		startTime: 290, //Seconds - Time before alarm when light should start turning on
		knx: {
			switch: '0/0/2',
			switchStatus: '0/1/2',
		}
	}
];


// Imports
const DeviceDiscovery = require('sonos').AsyncDeviceDiscovery;
const { Sonos } = require('sonos');
const moment = require('moment');
const knxd = require('eibd');


// Globals
var targetDevices = [];
var alarms = [];
var activeAlarms = [];
var latestAlarmListVersion = null;


// Discover Sonos Devices & Groups/Rooms
const discoverDevices = function() {
	let sonosDiscovery = new DeviceDiscovery();
	sonosDiscovery.discover().then((device, model) => {

		// Create Sonos object from discovered Device
		sonosDevice = new Sonos(device.host);
			
		// List all Groups the device is in.
		sonosDevice.getAllGroups().then(groups => {
			groups.forEach(group => {
				
				if(group.Name == targetRoom) {
					
					// Save some info to trigger an Alarm Disovery later
					var initialAmountOfDevices = Object.keys(targetDevices).length;
					var didDeviceAlreadyExist = (targetDevices[device.host] !== undefined);

					// Add Device to Target list
					targetDevices[device.host] = sonosDevice;

					// Trigger Alarm Discovery
					if(initialAmountOfDevices != Object.keys(targetDevices).length || !didDeviceAlreadyExist) {
						console.log('Discovered device matching target group: ' + device.host);
						
						// Now also Discover associated Alarms
						discoverAlarms();
					}
				}
			});
		});
	});
};
setInterval(discoverDevices, discoverDevicesEvery * 1000);
discoverDevices();


// Discover Sonos Alarms
const discoverAlarms = function() {
	// Check Alarms list for each Device
	for (deviceHost in targetDevices) {
		var sonosDevice = targetDevices[deviceHost];

		// Get all Alarms
		sonosDevice.alarmClockService().ListAlarms().then(deviceAlarms => {

			// Only when a new Alarms list is detected
			if(latestAlarmListVersion != deviceAlarms.CurrentAlarmListVersion) {
				alarms = [];
				deviceAlarms.Alarms.forEach(deviceAlarm => {
					
					// Only enabled Alarms
					if(deviceAlarm.Enabled == 1) {
						
						// Extract Start time
						var timeRegex = /([0-9]{2}):([0-9]{2}):([0-9]{2})/ig;
						var startTime = timeRegex.exec(deviceAlarm.StartTime);
						
						// Create alarm object
						var alarm = {
							id: deviceAlarm.ID,
							startTime: {
								hour: parseInt(startTime[1]),
								min: parseInt(startTime[2]),
								sec: parseInt(startTime[3])
							},
							recurrence: null
						};

						// Add Recurrence if applicable
						if(deviceAlarm.Recurrence == 'DAILY') {
							alarm.recurrence = {};
							alarm.recurrence[1] = true; //Monday
							alarm.recurrence[2] = true; //Tuesday
							alarm.recurrence[3] = true; //Wednesday
							alarm.recurrence[4] = true; //Thursday
							alarm.recurrence[5] = true; //Friday
							alarm.recurrence[6] = true; //Saturday
							alarm.recurrence[0] = true; //Sunday

							console.log('Discovered alarm: Daily at '+ deviceAlarm.StartTime);
						}
						else if (typeof deviceAlarm.Recurrence == 'string' && deviceAlarm.Recurrence.startsWith('ON_')) {
							alarm.recurrence = {};
							alarm.recurrence[1] = deviceAlarm.Recurrence.includes('0'); //Monday
							alarm.recurrence[2] = deviceAlarm.Recurrence.includes('1'); //Tuesday
							alarm.recurrence[3] = deviceAlarm.Recurrence.includes('2'); //Wednesday
							alarm.recurrence[4] = deviceAlarm.Recurrence.includes('3'); //Thursday
							alarm.recurrence[5] = deviceAlarm.Recurrence.includes('4'); //Friday
							alarm.recurrence[6] = deviceAlarm.Recurrence.includes('5'); //Saturday
							alarm.recurrence[0] = deviceAlarm.Recurrence.includes('6'); //Sunday

							console.log('Discovered alarm: Every ' + deviceAlarm.Recurrence.substr(3) + ' at ' + deviceAlarm.StartTime);
						}
						else {
							console.log('Discovered alarm: '+ deviceAlarm.StartTime);
						}

						// Save alarm
						alarms.push(alarm);
					}
				});

				// Save latest version
				latestAlarmListVersion = deviceAlarms.CurrentAlarmListVersion;
			}
		});
	};
};
setInterval(discoverAlarms, discoverAlarmsEvery * 1000);


// Any Sonos Alarms that need to be sounded?
const runAlarms = function() {
	const dateTime = new moment();
	dateTime.milliseconds(0);

	// What is the earliest running up time for any appliance
	var runningUpTime = 0;
	appliances.forEach(appliance => {
		if (appliance.startTime > runningUpTime) {
			runningUpTime = appliance.startTime;
		}
	});

	// Keep triggering existing alarms
	activeAlarms.forEach((alarm, index) => {
		
		// Only run the first alarm to prevent sending mixed signals to the appliances
		//if(index == 0) {
			runAlarm(alarm);
		//}
	});

	// Check if new alarms need to be triggered
	alarms.forEach(alarm => {
		
		// Only alarms without recurrence or which recur today
		if(alarm.recurrence == null || alarm.recurrence[dateTime.day()]) {
			
			var alarmTime = new moment();
			alarmTime.hours(alarm.startTime.hour);
			alarmTime.minutes(alarm.startTime.min);
			alarmTime.seconds(alarm.startTime.sec);
			alarmTime.milliseconds(0);

			var runningUpAlarmTime = moment(alarmTime).subtract(runningUpTime, 'seconds');

			// Have we reached the running-up-time of an alarm?
			if(dateTime.diff(runningUpAlarmTime, 'seconds') == 0) {
				activeAlarms.push(alarm);
				runAlarm(alarm);
			}
		}
	});
};
setInterval(runAlarms, 1000);


// Sound the Alarm (::Read with German SS voice)
const runAlarm = function(alarm) {
	const dateTime = new moment();
	dateTime.milliseconds(0);

	// Get the exact Alarm time
	var alarmTime = new moment();
	alarmTime.hours(alarm.startTime.hour);
	alarmTime.minutes(alarm.startTime.min);
	alarmTime.seconds(alarm.startTime.sec);

	// TODO: SAVE APPLIANCE STATE TO PREVENT DOUBLE FIRING
	// TODO: CHECK KNX moving/on/dimlevel states to prevent firing again.
	// TODO: ADD FLAG to enable volume buildup
	// TODO: ALLOW triggers TO BE RUN AFTER THE ALARM TIME

	// For each appliance
	appliances.forEach(appliance => {
		var applianceStartTime = moment(alarmTime).subtract(appliance.startTime, 'seconds'); 
		var timeDiff = dateTime.diff(applianceStartTime, 'seconds');

		// Keep firing every second in the run-up time
		if(timeDiff >= 0) {
			
			switch(appliance.type) {
				case 'SHUTTER':
					// Only move once at the start of the run-up time
					if(timeDiff == 0) {
						
						// Send position message to KNX Group Address
						writeKNXPercentageMessage(appliance.knx.moveTo, appliance.openLevel, true, () => {
							console.log('Setting shutter \'' + appliance.name +'\' to ' + appliance.openLevel + '%');
						});

					}
					break;

				case 'LIGHT':
					// Non Dimmable: Only turn on once at the start of the run-up time
					if(!appliance.dimmable && timeDiff == 0) {
						
						// Send ON message to KNX Group Address
						writeKNXBooleanMessage(appliance.knx.switch, true, () => {
							console.log('Turned on light \'' + appliance.name +'\'');
						});

					}
					// Dimmable: Update dim level each second
					else if(appliance.dimmable) {
						// Determine dimlevel
						var speed = (appliance.dimLevelEnd - appliance.dimLevelStart) / appliance.startTime;
						var dimLevel = appliance.dimLevelStart + (speed * timeDiff);
						if(dimLevel > appliance.dimLevelEnd) { dimLevel = appliance.dimLevelEnd }
						
						// Send Dim level message to KNX Group Address
						writeKNXPercentageMessage(appliance.knx.dim, dimLevel, false, () => {
							console.log('Dimmed light \'' + appliance.name +'\' to ' + dimLevel + '%');
						});
					}
					break;
			}
		}
	});
	
	// We've reached the actual alarm time
	if(alarmTime.diff(dateTime, 'seconds') <= -1) { // Extra second to make sure we reach the max values

		// Remove alarm from the active list
		activeAlarms.splice(activeAlarms.indexOf(alarm));

		console.log('Alarm is sounding. Removing it from the active alarms list.');
	}

};


// Write KNX Message
const writeKNXMessage = function(dest, dpt, value, callback) {
	
	// Connect to KNX
	var knxdConnection = new knxd.Connection();
	knxdConnection.socketRemote({
		host : knx.host,
		port : knx.port
	}, function(err) {
		if (err) {
			// a connection error occurred
			console.error("KNX not reachable: " + err);
		}

		knxdConnection.openTGroup(knxd.str2addr(dest), 1, function(err) {
			if (err) {
				console.error('Cannot open KNX TGroup: ' + err);
			} else {
				var msg = knxd.createMessage('write', dpt, parseFloat(value));
				knxdConnection.sendAPDU(msg, function(err) {
					if (err) {
						console.errorlog('Cannot send KNX message: ' + err);
					} else {
						console.debug('knx - data sent: Value ' + value + ' to GA ' + dest);
						if(callback) {
							callback();
						}
					}
				});
			}
		});
	});
};

// Write Boolean KNX Message
const writeKNXBooleanMessage = function(dest, value, callback) {
	if(value) {
		writeKNXMessage(dest, 'DPT1', 1, callback);
	}
	else {
		writeKNXMessage(dest, 'DPT1', 0, callback);
	}
};

// Write Percentage KNX Message
const writeKNXPercentageMessage = function(dest, value, reverseflag, callback) {

	var numericValue = 0;
	value = (value >= 0 ? (value <= 100 ? value : 100) : 0); //ensure range 0..100
	if (reverseflag) {
		numericValue = 255 - Math.round(255 * value / 100); // convert 0..100 to 255..0 for KNX bus  
	} else {
		numericValue = Math.round(255 * value / 100); // convert 0..100 to 0..255 for KNX bus  
	}

	console.debug('knx - setPercentage: Setting ' + dest + ' percentage ' + (reverseflag ? '(reverse) ' : '') + 'to ' + value + ' (' + numericValue + ')');
	writeKNXMessage(dest, 'DPT5', numericValue, callback);
};