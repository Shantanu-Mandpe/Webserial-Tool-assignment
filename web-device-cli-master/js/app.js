'use strict';

const bleNusServiceUUID  = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const bleNusCharRXUUID   = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const bleNusCharTXUUID   = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const MTU = 20;

var bleDevice;
var bleServer;
var nusService;
var rxCharacteristic;
var txCharacteristic;

var connected = false;

// fn to toogle bluetooth connection
function connectionToggle() {
    if (connected) {
        disconnect();
    } else {
        connect();
    }
    document.getElementById('terminal').focus(); //focus on the element with id terminal 
    // focused element is the element that will receive keyboard and similar events by default
}

// Sets button to either Connect or Disconnect
function setConnButtonState(enabled) {
    if (enabled) {
        document.getElementById("clientConnectButton").innerHTML = "Disconnect";
    } else {
        document.getElementById("clientConnectButton").innerHTML = "Connect";
    }
}
/*
above two fns are for the connect button in bluetooth version 
in serial version : it is the Select Serial Port button
*/

function connect() {
    // if bluetooth is not available in the device the this prompt
    if (!navigator.bluetooth) {
        console.log('WebBluetooth API is not available.\r\n' +
                    'Please make sure the Web Bluetooth flag is enabled.');
        window.term_.io.println('WebBluetooth API is not available on your browser.\r\n' +
                    'Please make sure the Web Bluetooth flag is enabled.');
        return;
    }
    console.log('Requesting Bluetooth Device...');
    navigator.bluetooth.requestDevice({ //returns a Promise to a BluetoothDevice
        // these are all options for the bluetooth device / options for the device request
        //filters: [{services: []}]
        optionalServices: [bleNusServiceUUID], //An array of BluetoothServiceUUIDs
        acceptAllDevices: true //A boolean value indicating that the requesting script can accept all Bluetooth devices
    })
    .then(device => {
        bleDevice = device; 
        console.log('Found ' + device.name);
        //// Do something with the device
        console.log('Connecting to GATT Server...');
        bleDevice.addEventListener('gattserverdisconnected', onDisconnected);
        //Fired on a BluetoothDevice when an active GATT connection is lost
        // (type, js function) the fn is called when the event is triggered 
        return device.gatt.connect();
        //Causes the script execution environment to connect to this.device
    })
    //interface of the Web Bluetooth API represents a GATT Server on a remote device.
    .then(server => {
        console.log('Locate NUS service');
        return server.getPrimaryService(bleNusServiceUUID);
    /* interface of the Web Bluetooth API represents a service provided by a GATT server, 
    including a device, a list of referenced services, and a list of the characteristics 
    of this service.*/
    }).then(service => {
        nusService = service;
        console.log('Found NUS service: ' + service.uuid);
    })
    //  GATT Characteristic, which is a basic data element 
    //  that provides further information about a peripheral's service.
    .then(() => {
        console.log('Locate RX characteristic');
        return nusService.getCharacteristic(bleNusCharRXUUID);  //https://googlechrome.github.io/samples/web-bluetooth/device-information-characteristics.html
    })
    .then(characteristic => {
        rxCharacteristic = characteristic;
        console.log('Found RX characteristic');
    })
    .then(() => {
        console.log('Locate TX characteristic');
        return nusService.getCharacteristic(bleNusCharTXUUID);
    })
    .then(characteristic => {
        txCharacteristic = characteristic;
        console.log('Found TX characteristic');
    })
    // above fns are to get the TX and RX characteristics of the device

    // returns a Promise to the BluetoothRemoteGATTCharacteristic
    // instance when there is an active notification on it
    .then(() => {
        console.log('Enable notifications');
        return txCharacteristic.startNotifications();
    })
    .then(() => {
        console.log('Notifications started');
        txCharacteristic.addEventListener('characteristicvaluechanged',
                                          handleNotifications);
        connected = true;
        window.term_.io.println('\r\n' + bleDevice.name + ' Connected.');
        nusSendString('\r'); // moves the cursor to the beginning of the line without advancing to the next line
        setConnButtonState(true);
    })
    .catch(error => {
        console.log('' + error);
        window.term_.io.println('' + error);
        if(bleDevice && bleDevice.gatt.connected)
        {
            bleDevice.gatt.disconnect();
        }
    });
}

function disconnect() {
    if (!bleDevice) {
        console.log('No Bluetooth Device connected...');
        return;
    }
    console.log('Disconnecting from Bluetooth Device...');
    if (bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect();
        connected = false;
        setConnButtonState(false);
        console.log('Bluetooth Device connected: ' + bleDevice.gatt.connected);
    } else {
        console.log('> Bluetooth Device is already disconnected');
    }
}

function onDisconnected() {
    connected = false;
    window.term_.io.println('\r\n' + bleDevice.name + ' Disconnected.');
    setConnButtonState(false);
}

function handleNotifications(event) {
    console.log('notification');
    let value = event.target.value;
    // Convert raw data bytes to character values and use these to 
    // construct a string.
    let str = "";
    for (let i = 0; i < value.byteLength; i++) {
        str += String.fromCharCode(value.getUint8(i));
    }
    window.term_.io.print(str);
}


//w/e the value of string "s" is convert it into char codes and send 20bits at a time 

function nusSendString(s) {
    if(bleDevice && bleDevice.gatt.connected) {
        console.log("send: " + s); 
        let val_arr = new Uint8Array(s.length) //new The Uint8Array typed array represents an array of 8-bit unsigned integers
        for (let i = 0; i < s.length; i++) {
            let val = s[i].charCodeAt(0); //get the char code of the element of the array
            val_arr[i] = val;
        } 
        sendNextChunk(val_arr);
    } else {
        window.term_.io.println('Not connected to a device yet.');
    }
}

function sendNextChunk(a) {
    let chunk = a.slice(0, MTU);
    rxCharacteristic.writeValue(chunk)
      .then(function() {
          if (a.length > MTU) { //if the remainiang string is more than 20 then send the next also
              sendNextChunk(a.slice(MTU));
          }
      });
}



function initContent(io) {
    io.println("\r\n\
Welcome to Web Device CLI V0.1.0 (03/19/2019)\r\n\
Copyright (C) 2019  makerdiary.\r\n\
\r\n\
This is a Web Command Line Interface via NUS (Nordic UART Service) using Web Bluetooth.\r\n\
\r\n\
  * Source: https://github.com/makerdiary/web-device-cli\r\n\
  * Live:   https://makerdiary.github.io/web-device-cli\r\n\
");
}

function setupHterm() {
    const term = new hterm.Terminal();

    term.onTerminalReady = function() {
        const io = this.io.push();
        io.onVTKeystroke = (string) => {
            nusSendString(string);
        };
        io.sendString = nusSendString;
        initContent(io);
        this.setCursorVisible(true);
        this.keyboard.characterEncoding = 'raw';
    };
    term.decorate(document.querySelector('#terminal'));
    term.installKeyboard();

    term.contextMenu.setItems([
        ['Terminal Reset', () => {term.reset(); initContent(window.term_.io);}],
        ['Terminal Clear', () => {term.clearHome();}],
        [hterm.ContextMenu.SEPARATOR],
        ['GitHub', function() {
            lib.f.openWindow('https://github.com/makerdiary/web-device-cli', '_blank');
        }],
    ]);

    // Useful for console debugging.
    window.term_ = term;
}

window.onload = function() {
    lib.init(setupHterm);
};