const knx = {
	host: '192.168.5.198',
	port: 6720
};
const knxd = require('knx');


// Create KNX Connection
var knxConnection = new knxd.Connection({
	ipAddr: knx.host,
	ipPort: knx.port,
	// the KNX physical address we'd like to use
	//physAddr: '15.15.15',
	// set the log level for messsages printed on the console. This can be 'error', 'warn', 'info' (default), 'debug', or 'trace'.
	loglevel: 'info',
	forceTunneling: false,
	// do not automatically connect, but use connection.Connect() to establish connection
	manualConnect: false,  
	// define your event handlers here:
	handlers: {
		// wait for connection establishment before sending anything!
		connected: function() {
			console.log('Hurray, I can talk KNX!');
		},
		// get notified for all KNX events:
		event: function(evt, src, dest, value) {
			console.log("event: %s, src: %j, dest: %j, value: %j", evt, src, dest, value);
		},
		// get notified on connection errors
		error: function(connstatus) {
			console.log("**** ERROR: %j", connstatus);
		}
	}
});