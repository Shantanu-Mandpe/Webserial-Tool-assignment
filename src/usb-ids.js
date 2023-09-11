import {hex} from "./util.js";

const log = (...args) => {
    console.log(...args)
}

// getting usb vendor and product id from /usb-ids.txt
// from the file u get the vendor id and the product id of the usb that is connected to the port 


//reading a remote text file line by line from mozilla website
async function* makeTextFileLineIterator(fileURL) {
    const utf8Decoder = new TextDecoder("utf-8");
    let response = await fetch(fileURL);
    let reader = response.body.getReader();
    let {value: chunk, done: readerDone} = await reader.read();
    chunk = chunk ? utf8Decoder.decode(chunk, {stream: true}) : "";

    let re = /\r\n|\n|\r/gm;
    let startIndex = 0;

    for (;;) {
        let result = re.exec(chunk);
        if (!result) {
            if (readerDone) {
                break;
            }
            let remainder = chunk.substr(startIndex); //remainder is string from startIndex position till end
            ({value: chunk, done: readerDone} = await reader.read());
            chunk = remainder + (chunk ? utf8Decoder.decode(chunk, {stream: true}) : "");
            startIndex = re.lastIndex = 0;
            continue;
        }
        yield chunk.substring(startIndex, result.index);
        startIndex = re.lastIndex;
    }
    if (startIndex < chunk.length) {
        // last line didn't end in a newline char
        yield chunk.substr(startIndex);
    }
}

export const getUsbInfo = async (vid, pid) => {
    let info = {vid, pid}
    
    if (vid instanceof SerialPort) { //if vid is an instance of SerialPort constructor 
        const i = vid.getInfo() //Returns an object containing properties of the port
        log(info) 
        vid = info.vid = hex(i.usbVendorId) //usb vendor id hex coded
        pid = info.pid = hex(i.usbProductId)// usb product id hex coded
    }

    log(`searching for ${vid}:${pid}`)  // searching for usb with this product id and vendor id 
    for await (let line of makeTextFileLineIterator('/usb-ids.txt')) { // if the line of the txt file is same as this
        if (line === '# List of known device classes, subclasses and protocols') {
            break
        }
        if (line.startsWith('#') || !line) continue //comment

        if (info.vendor) {
            const pidMatch = line.match(/^\t[0-9a-f]{4}  /) //if line matches the pattern
            if (pidMatch) {
                if (pid === line.substr(1, 4)) {
                    info.product = line.substr(7)
                    log(info)
                    return info  //if product id matches return info 
                }
            }
        }

        const vidMatch = line.match(/^[0-9a-f]{4}  /)
        if(vidMatch) {
            if (line.substr(0, 4) === vid) {
                info.vendor = line.substr(6)
            }
            else if (info.vendor) {
                log(info)
                return info // pid not found   //if vid id matches return info 
            }
        }
    }
    log(`unable to find ${vid}:${pid}`)
    return info
}
