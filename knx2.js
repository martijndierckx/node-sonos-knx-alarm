const knx = {
	host: '192.168.5.198',
	port: 6720
};
const knxd = require('eibd');

var groupAddress = "0/0/2";
var value = 0;
var dpt = "DPT1";
var callback = null;

var knxdConnection = new knxd.Connection();
knxdConnection.socketRemote({
	host : knx.host,
	port : knx.port
}, function(err) {
	if (err) {
		// a fatal error occurred
		console.error("FATAL: knxd or eibd not reachable: " + err);
		throw new Error("Cannot reach knxd or eibd service, please check installation and configuration .json");
	}
	var dest = knxd.str2addr(groupAddress);
	console.debug("DEBUG knxwrite Address conversion, converted "+ groupAddress+ " to " + dest);
	knxdConnection.openTGroup(dest, 1, function(err) {
		if (err) {
			console.errorlog("[ERROR] knxwrite:openTGroup: " + err);
			if (callback) {
				try {
					callback(err);
				} catch (e) {
					console.log('Caught error '+ e + ' when calling homebridg callback.');
				}
			}
		} else {
			//globs.debug("DEBUG opened TGroup ");
			var msg = knxd.createMessage('write', dpt, parseFloat(value));
			knxdConnection.sendAPDU(msg, function(err) {
				if (err) {
					console.errorlog("[ERROR] knxwrite:sendAPDU: " + err);
					if (callback) {
						try {
							callback(err);
						} catch (e) {
							console.log('Caught error '+ e + ' when calling homebridg callback.');
						}
					}
				} else {
					console.debug("knxAccess.knxwrite: knx data sent: Value " + value + " for GA " + groupAddress);
					if (callback) {
						try {
							// DO SOMETHING
						} catch (e) {
							console.log('Caught error '+ e + ' when calling homebridg callback.');
						}
					}
				}
			});
		}
	});
});