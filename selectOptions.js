#!/usr/bin/env node

var c = require('chalk'),
    queryUber = require('./queryUber'),
    fs = require('fs'),
    ora = require('ora'),
    clear = require('cli-clear'),
    mkdirp = require('mkdirp'),
    child = require('child_process'),
    prompt = require('syncprompt');
var Client = require('ssh2').Client;

if(!process.env['resultsFile'])process.exit(-1);

var ResultFile = __dirname +'/'+ process.env['resultsFile'];


clear();
if (process.argv[2] > 0)
    var devID = process.argv[2];
else
    var devID = prompt('Enter Device ID to provision: ');
if (devID < 1) process.exit(-1);
var queryUberSpinner = ora('Querying Ubersmith for device data').start();
queryUber(devID, function(e, NewServer) {
    if (e) throw e;
    queryUberSpinner.succeed('Device Loaded [' + c.red.bgBlack(NewServer.ServerName) + ']!');
    console.log('  Hit right arrow to select an option, left arrow to deselect an option, enter to process.\n\tMultiple options can be selected.');
    var Select = require('select-shell');
    var list = Select({
        pointer: ' ▸ ',
        pointerColor: 'yellow',
        checked: ' ◉  ',
        unchecked: ' ◎  ',
        checkedColor: 'blue',
        msgCancel: '',
        multiSelect: true,
        inverse: true,
        prepend: true
    });

    var stream = process.stdin;

    	list.option('  CSF Firewall    ', 'csf')
        .option('  OpenVZ    ', 'openvz')
        .option('  ZFS  ', 'zfs')
        .option('  CloudLinux  ', 'cloudlinux')
    .option('  Infinitum Users and SSH Security  (This will lock out root so use last)  ', 'sshSecurity')
        .list();

    list.on('select', function(options) {
        if (options.length < 1) {
            console.log('\tNo Options Selected!');
            process.exit(-1);
        }
        var out = {
            deviceID: +devID,
            device: NewServer,
            options: options,
        };
        var hvFile = '../provisionCLI/SERVER_PROVISIONING/host_vars/' + NewServer.ServerName + '/main.json';
        if (fs.statSync(hvFile)) {
            out.device = JSON.parse(fs.readFileSync(hvFile).toString());
        }
        var sshSpinner = ora('Connecting to server ' + NewServer.ServerName + ' via ssh at IP ' + out.device.PrimaryIP + ' as root.').start();

        var conn = new Client();
        conn.on('ready', function() {
            conn.exec('uptime', function(err, stream) {
                if (err) throw err;
                stream.on('close', function(code, signal) {
                    conn.end();
                    sshSpinner.succeed('Connected as root!');
                    out.device.ansible_ssh_user = 'root';
                    out.device.ansible_ssh_pass = out.device.Password;
                    out.device.ansible_ssh_host = out.device.PrimaryIP;
                    out.device.ansible_ssh_port = 22;
                    fs.writeFileSync(ResultFile, JSON.stringify(out));
                    process.exit(0);
                }).on('data', function(data) {
                }).stderr.on('data', function(data) {
                });
            });
        }).on('error', function(err) {
            sshSpinner.fail('Failed to connect.');
            process.exit(-1);
        }).connect({
            host: out.device.PrimaryIP,
            port: 22,
            username: 'root',
            password: out.device.Password,
        });
    });
    list.on('cancel', function(options) {
        console.log('Cancel list, ' + options.length + ' options selected');
        process.exit(-1);
    });
});
