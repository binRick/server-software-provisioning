#!/usr/bin/env node

var c = require('chalk'),
    condenseWhitespace = require('condense-whitespace'),
    queryUber = require('./queryUber'),
    fs = require('fs'),
    ora = require('ora'),
    clear = require('cli-clear'),
    mkdirp = require('mkdirp'),
    child = require('child_process'),
    prompt = require('syncprompt'),
    _ = require('underscore'),
    async = require('async'),
    Client = require('ssh2').Client,
    sftpClient = require('ssh2-sftp-client'),
    sftp = new sftpClient();

if (!process.env['resultsFile']) process.exit(-1);
if (!process.env['inventoryFile']) process.exit(-1);
var ResultFile = __dirname + '/' + process.env['resultsFile'];
var InventoryFile = __dirname + '/' + process.env['inventoryFile'];
var options = JSON.parse(fs.readFileSync(ResultFile).toString());

var invData = "[all]\n" + options.device.ServerName + " ansible_ssh_host=" + options.device.ansible_ssh_host + " ansible_ssh_user=" + options.device.ansible_ssh_user + " ansible_ssh_port=" + options.device.ansible_ssh_port + " ansible_ssh_pass=" + options.device.ansible_ssh_pass + "\n";
fs.writeFileSync(InventoryFile, invData);


async.mapSeries(options.options, function(option, _cb) {
    option.text = condenseWhitespace(option.text);
    if (option.value == 'sshSecurity') {
    console.log('\tInstalling ' + option.text);
        var auth = {
            host: options.device.ansible_ssh_host,
            port: options.device.ansible_ssh_port,
            username: options.device.ansible_ssh_user,
            password: options.device.ansible_ssh_pass,
        };
        sftp.connect(auth).then(function() {
            return sftp.put('sanitize.sh', '/root/sanitize.sh');
        }).then(function(data) {
            var conn = new Client();
            conn.on('ready', function() {
                conn.exec('sh /root/sanitize.sh', function(err, stream) {
                    if (err) throw err;
                    stream.on('close', function(code, signal) {
                            if (code != 0) {
                                _cb(code, {});
                            } else {
                                conn.end();
                                console.log(option.text + ' Installed!');
                                _cb(null, {});
}
                            });
                    process.stdin.pipe(stream);
                    stream.stdout.pipe(process.stdout);
                    stream.stderr.pipe(process.stderr);
                });
            }).connect(auth);
        }).catch(function(err) {
            throw (err);
        });

    } else {
    var spinner = ora('\tInstalling ' + option.text).start();
        var pb = __dirname + '/playbooks/' + option.value + '.yaml';
        var ansibleCommand = '/usr/bin/ansible-playbook -i ' + InventoryFile + ' ' + pb + ' -l ' + options.device.ServerName;
        var acA = ansibleCommand.split(' ');
        var cmdOut = '';
        ansibleSpawn = child.spawn(acA[0], acA.slice(1, acA.length));
        ansibleSpawn.stdout.on('data', function(data) {
            cmdOut += data.toString();
        });
        ansibleSpawn.stderr.on('data', function(data) {
            cmdOut += data.toString();
        });
        ansibleSpawn.on('exit', function(code) {
            if (code == 0) {
                spinner.succeed(option.text + ' Installed!');
                _cb(null, {});
            } else {
                spinner.fail(c.red('Installation process finished with code ' + c.white(code)) + ' when command finished:\n\t' + ansibleCommand + '\n\n');
                process.exit(-1);
            }
        });
    }
}, function(errs, results) {
    if (errs) throw errs;
    console.log('Software Provisioned!');
});
