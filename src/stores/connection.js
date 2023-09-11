import { defineStore } from 'pinia'
import {ref} from "vue";
import {hex} from "../util.js";
import { getUsbInfo } from "../usb-ids.js"

/*
No parameters are required for sedning data over bluetooth from what I can find 
readableStream uses Uint8Array
*/

// no need for usb-ids file because we dont use any text files just bledevice.id for checking 

/* get info about the port */
const vid_pid = (port) => {
  const info = port.getInfo() //usbProductId and usbVendorId is returned 
  return hex(info.usbVendorId) + ':' + hex(info.usbProductId)   //hex coded usbVendorId : hex coded usbProductId
}

const b_id = (bd) => {
  return hex(bd.id)
}

const bleNusServiceUUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const bleNusCharRXUUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const bleNusCharTXUUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const MTU = 20;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

//vuex needs something like state and id -- stores 
const useConnectionStore = defineStore({ 
  id: 'connection',
  state: () => ({
    id: undefined,
    vendor: undefined,
    product: undefined,
    name: undefined,
    port: undefined,
    physicallyConnected: false,
    open: false,
    _reader: undefined,

    options: { //what we can select on screen
      baudRate: ref(115200),
      bufferSize: ref(255),
      dataBits: ref(8),
      flowControl: ref("none"),
      parity: ref("none"),
      stopBits: ref(1)
    },
    signals: {},
    messages: [],
    prepend: '',
    append: '\n'
  }),
  getters: {
  },
  actions: {
    /*need to change select port to the bluetooth version */

    /* 
    this fn bascically selects the port ur device is connected to and then 
    and then gives the info about the usb connected to the port 
    */
    /* for bluetooth : 
    this fn should give info about the connected bluetooth device
    */
    async selectPort() {
      try {
        //if (!navigator.bluetooth)
        if (!navigator.serial) return false 
        /*Returns a Serial object, which represents the entry point into the Web Serial 
        API to enable the control of serial ports.*/
        const port = await navigator.serial.requestPort() //gives the port chosen by user
        const info = await getUsbInfo(port) //get info of usb connected to the port
        window.location.search = `?vid=${info.vid}&pid=${info.pid}`   //  = "?vid=12&pid=13" 
        //query string - string containing a '?' followed by the parameters of the URL
        return true
      }
      catch(e) {}
    },
    // async selectPort() {
    //   try{
    //     if (!navigator.bluetooth) {
    //       console.log('WebBluetooth API is not available.\r\n' +
    //         'Please make sure the Web Bluetooth flag is enabled.');
    //       window.term_.io.println('WebBluetooth API is not available on your browser.\r\n' +
    //         'Please make sure the Web Bluetooth flag is enabled.');
    //       return;
    //     }
    //     console.log('Requesting Bluetooth Device...');
    //     const bleDevice = navigator.bluetooth.requestDevice({
    //       optionalServices: [bleNusServiceUUID], //An array of BluetoothServiceUUIDs
    //       acceptAllDevices: true //A boolean value indicating that the requesting script can accept all Bluetooth devices
    //     }) 
    //     const bid = bleDevice.id;
    //     const bname = bleDevice.name;

        
    //   }
    //   catch (e) {}
    // },


    // for bluetooth instead of having a vid / pid i just need device.id to get it 
    // isntead of vendor / product i just need device.name 
    /*change port parts to bluetooth details */

    async init(vid, pid) {
      const ports = await navigator.serial.getPorts() //array of SerialPort objects representing serial ports connected to the host
      const id = vid + ':' + pid
      this.port = ports.find((port) => vid_pid(port) === id)
      if (!this.port) { //id from param doesnt match the port id 
        window.location.search = ``
        return;
      }
      this.id = id
      const info = await getUsbInfo(this.port) //get info of the port
      this.vendor = info.vendor
      this.product = info.product
      this.physicallyConnected = true

      // notification for a USB device getting physically connected
      // change notifications
      const onconnect = (e) => {
        console.log(id + 'device connected', e)
        this.port = e.target //the vent is dispatched on the port connected
        this.physicallyConnected = true
      }
      // connect disconnect event types are by default 
      navigator.serial.addEventListener('connect', onconnect); //onconnect fn is called when usb connected to port 

      // notification for a USB device getting physically disconnected
      const ondisconnect = (e) => {
        console.log(id + ' disconnect')
        this.physicallyConnected = false
        this.open = false
      }
      navigator.serial.addEventListener('disconnect', ondisconnect);
      console.log(id + ' initialized')
    },

    // async init(bid){
    //   const id = bid
    //   const bleDevices = await navigator.bluetooth.getDevices()
    //   this.device = bleDevices.find((bd) => b_id(bd) === id)

    //   if (!this.device) { //id from param doesnt match the port id 
    //     window.location.search = ``
    //     return;
    //   }

    //   this.id = id
    //   this.physicallyConnected = true
    //   this.name = this.device.name

    //   try{
    //     console.log('Connecting to GATT Server...');
    //     this.device.addEventListener('gattserverdisconnected', onDisconnected);
    //     const bleServer = await this.device.gatt.connect();

    //     const nusService = await bleServer.getPrimaryService(bleNusServiceUUID);
    //     console.log('Found NUS service: ' + service.uuid);

    //     let characteristic = await nusService.getCharacteristic(bleNusCharRXUUID);
    //     const rxCharacteristic = characteristic;

    //     characteristic = await nusService.getCharacteristic(bleNusCharTXUUID);
    //     const txCharacteristic = characteristic;

    //     console.log('Enable notifications');
    //     const startNotif = await txCharacteristic.startNotifications();
    //     console.log('Notifications started');

    //     const onconnect = await txCharacteristic.addEventListener('characteristicvaluechanged',
    //       handleNotifications);
    //     window.term_.io.println('\r\n' + this.device.name + ' Connected.');
    //     this.physicallyConnected = true
    //   } catch(error)  {
    //       console.log('' + error);
    //       window.term_.io.println('' + error);
    //       if (this.device && this.device.gatt.connected) {
    //         this.device.gatt.disconnect();
    //       }
    //   };
    // },

    async connect() {
      // u are seeing if the port is connected? and if it is open a readableStream after which go to monitor 
      if (!this.port) return
      console.log(this.id + ': opening')
      try {
        await this.port.open(this.options)  
        // !!to return a bolean value of the condition
        this.open = !!this.port?.readable //if port is connected open readableStream for receiving data from the device connected to the port
        console.log(this.id + ': opened')
        // const { clearToSend, dataCarrierDetect, dataSetReady, ringIndicator} = await this.port.getSignals()
        // console.log({ clearToSend, dataCarrierDetect, dataSetReady, ringIndicator})
        this.monitor()
      }
      catch (e) {
        console.log(e)
        window.alert(e.message)
      }
    },

    async monitor() {
      console.log('monitor()')
      while (this.open && this.port?.readable) { //while port is open and readable
        this.open = true
        const reader = this.port.readable.getReader()
        this._reader = reader
        try {
          while (this.open) {
            console.log('reading...')
            const { value, done } = await reader.read()
            if (done) {
              // |reader| has been canceled.
              this.open = false
              break;
            }
            const decoded = decoder.decode(value)
            // console.log('read complete:', decoded, value, done)
            this.messages.push(decoded)
          }
        } catch (error) {
          console.error('reading error', error)
        } finally {
          reader.releaseLock()
        }
      }
    },

    async write(data) {
      if (this.port?.writable) {
        const writer = this.port.writable.getWriter()
        await writer.write(encoder.encode(data))
        writer.releaseLock()
      }
    },

    async close() {
      if (this._reader) {
        await this._reader.cancel()
      }
      this.port.close()
    }
  }
})



export { useConnectionStore }
