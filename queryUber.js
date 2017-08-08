var fs = require('fs'),
    network = require('network'),
    _ = require('underscore'),
    config = require('./uberConfig'),
    iprange = require('iprange');

var fulfill = function(D) {
    var e = null;
    var J = {};
    J.dev = parseInt(D.dev);
    J.ServerName = String(D.dev_desc).toLowerCase();
    J.Assignments = _.toArray(D.assignments);
    //   J.Range = iprange(J.Assignments[0].addr_readable);
    // J.PrimaryIP = J.Range[2];
    J.PrimaryIP = D.metadata.primary_ip;
    //  J.Gateway = J.Range[1];
    J.BashColor = config.BashColor;
    //	J.RAID_SDA_SDB = 1;
    J.Netmask = '255.255.255.248';
    J.ansible_ssh_host = J.PrimaryIP;

    if (D.metadata.custom_gateway.split('.').length == 4)
        J.Gateway = D.metadata.custom_gateway;
    if (D.metadata.custom_netmask.split('.').length == 4)
        J.Netmask = D.metadata.custom_netmask;



    J.myMAC = D.metadata.mac;
    J.ParentDevice = parseInt(D.parent);
    J.ProductionVlan = parseInt(D.metadata.eth0_vlan);
    J.SwitchPort = parseInt(String(D.metadata.switch_port_eth0).split('/')[1]);
    J.OS = process.argv[3] || 'centos-6';
    J.ProductionInterface = 'eth0';
    J.PrimaryInterface = 'eth0';
    J.BashPrompt = 'bash_prompt';
    J.Filesystem = 'xfs';
    J.Disk = 'sda';
    J.BootSize = 256
    J.SlashSize = 20480
    J.SwapSize = 1024
    J.ProductionPortSpeed = 1000000000
    J.PxeInterface = 'eth0';
    J.Speed = 1000
    J.ParentDeviceTypeId = parseInt(D.ParentData.type_id);
    J.SwitchIP = D.ParentData.metadata.primary_ip;
    J.ReinstallVLAN = parseInt(D.ParentData.ParentData.metadata.provisioning_vlan);
    if (parseInt(J.ReinstallVLAN) == 800)
        J.PxeServerIP = '10.87.89.249';
    delete J.Assignments;
    delete J.Range;

    _.each(_.keys(J), function(k) {
        if (typeof(J[k]) == 'undefined') throw 'key ' + k + ' is undefined';
        if (typeof(J[k]) == 'number' && J[k] < 1) throw k + ' is less then one';
        if (typeof(J[k]) == 'string' && J[k].length < 1) throw k + ' is not set';
    });

    return J;
};

var UberAPI = require('ubersmith');
module.exports = function(devID, CB) {
    var client = new UberAPI(config.uber.user, config.uber.token, config.uber.url);
    var uber_calls = {};
    uber_calls['device.get'] = {
        args: {
            device_id: devID,
            metadata: 1
        },
        callback: function(err, res) {
            if (err) console.log(err);
            try {
                var J = JSON.parse(res.body).data;
                var u2 = {};
                u2['device.get'] = {
                    args: {
                        device_id: J.parent,
                        metadata: 1
                    },
                    callback: function(e, pR) {
                        if (e) throw e;
                        //console.log(pR);
                        J.ParentData = JSON.parse(pR.body).data;
                        var u3 = {};
                        u3['device.get'] = {
                            args: {
                                device_id: J.ParentData.parent,
                                metadata: 1
                            },
                            callback: function(e, coreR) {
                                J.ParentData.ParentData = JSON.parse(coreR.body).data;
                                //                                console.log(J.ReinstallVLAN); process.exit();
                                CB(err, fulfill(J));
                            }
                        };
                        client.Async(u3);
                    }
                };
                client.Async(u2);
            } catch (e) {
                CB(e, null);
            }
        }
    }
    client.Async(uber_calls);
    var J = {};
};
