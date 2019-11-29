# Node SerialPort-GSM
[![NPM](https://nodei.co/npm/serialport-gsm.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/serialport-gsm/)

## Intro
SerialPort-GSM is a simplified plugin for communicating with gsm modems, primarily for sms. (This library is focused in `'PDU'` mode)

***
## Table of Contents

* [Installation](#installation-instructions)
* [Usage](#usage)
    * [Methods](#methods)
        * [List Ports](#list-available-ports)
        * [Open](#opening-a-port)
        * [Initialize Modem](#initialize-modem)
        * [Close](#close-modem)
        * [Set Modem Mode](#set-modem-mode)
        * [Send SMS](#send-message)
        * [Get Sim Inbox](#get-sim-inbox)
        * [Delete Message](#delete-sim-message)
        * [Delete All SIm MEssages](#delete-all-sim-messages)
        * [Get Modem Serial](#get-modem-serial)
        * [Get Network Signal](#get-network-signal)
        * [Get Own Number](#get-own-number)
        * [Set Own Number](#set-own-number)
        * [Hangup current call](#hangup-call)
        * [Execute AT Command](#execute-at-command)
    * [Events](#events)
        * [open](#open)
        * [close](#close)
        * [error](#error)
        * [onSendingMessage](#onsendingmessage)
        * [onNewMessage](#onnewmessage)
        * [onNewMessageIndicator](#onnewmessage-indicator)
        * [onNewIncomingCall](#onnewincomingcall)
        * [onMemoryFull](#onmemoryfull)
    * [SerialPort](#serialport)
* [Contributors](#contributors)
* [License](#license)

***
## Installation Instructions

```terminal
npm install serialport-gsm
```
 
## Example

A full example can be found in the example directory.

## Usage

### Methods

#### List Available Ports
```js
let serialportgsm = require('serialport-gsm')

serialportgsm.list((err, result) => {
    console.log(result)
})
```

#### Opening a Port
Call other functions after the port has been opened.
`open(path, options, callback)`
When opening a serial port, specify (in this order)
1. Path to Serial Port - required.
2. Options `(see sample options on code)`.

#### SerialPort openOptions
| Name                  | Type          | Default     | Description |
| --------------------- | ------------- | ----------- | ----------- |
| baudRate              | number        | 9600        | The port's baudRate. |
| dataBits              | number        | 8           | Must be one of: 8, 7, 6, or 5. |
| stopBits              | number        | 1           | Must be one of: 1 or 2. |
| highWaterMark         | number        | 16384       | The size of the read and write buffers defaults to 16k. |
| parity                | string        | "none       | Must be one of: 'none', 'even', 'mark', 'odd', 'space'. |
| rtscts                | boolean       | false       | flow control setting |
| xon                   | boolean       | false       | flow control setting |
| xoff                  | boolean       | false       | flow control setting |
| xany                  | boolean       | false       | flow control settings |

#### SerialPort-GSM additional openOptions
| Name                   | Type          | Default     | Description |
| ---------------------- | ------------- | ----------- | ----------- |
| autoDeleteOnReceive    | boolean       | false       | Delete from `'sim'` after receiving. |
| enableConcatenation    | boolean       | false       | Receive concatenated messages as one. |
| incomingCallIndication | boolean       | false       | Receive `'onNewIncomingCall'` event when receiving calls. |
| incomingSMSIndication  | boolean       | true        | Enables the modem to notify that a new SMS message has been received. |
| pin                    | string        |             | If your SIM card is protected by a PIN provide the PIN as String and it will be used to unlock the SIM card during initialization (empty, means "no PIN existing on the SIM card"). |
| customInitCommand      | string        |             | If your device needs a custom initialization command it can be provided and will be used after PIN check. The command is expected to return `'OK'` (empty, means "no custom command for init"). |
| logger                 |               |             | Provide a logger instance, currently `'debug'` is used only to output written and received serial data. Use `'console'` for debugging purposes. |

```js
let serialportgsm = require('serialport-gsm')
let modem = serialportgsm.Modem()
let options = {
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    rtscts: false,
    xon: false,
    xoff: false,
    xany: false,
    autoDeleteOnReceive: true,
    enableConcatenation: true,
    incomingCallIndication: true,
    incomingSMSIndication: true,
    pin: '',
    customInitCommand: '',
    logger: console
}

modem.open('COM', options, callback[Optional])
```

#### Initialize Modem
This function starts the modem. (If your port fails to work or does not respond to commands, don't forget to call `initializeModem` after opening the port.)
```js
modem.on('open', data => {
    modem.initializeModem(callback[optional])
})
```

#### Close Modem
Closes an open connection
`close(callback[optional])`
```	js
modem.close()
```

#### Set Modem Mode	
`setModemMode(callback, type)`	
* type can be `'PDU'` or `'SMS'`
* Note: This module is focused on PDU mode as it is more supported in most GSMs.
```	js
modem.on('open', data => {	
    modem.setModemMode(callback, 'PDU')	
})	
```

#### Check Modem Communication
Send simple command to check communication with device
```js
modem.checkModem(callback)
```


#### Send Message
Sends sms. `sendSMS(recipient, message, alert, callback)`

| Name      | Type       | Default | Description |
| --------- | ---------- | ------- | ----------- |
| recipient | string     |         | The recipient number should start with the location code or `'+'` then the location code `(Ex. '63999XXXXX19', '+63999XXXXX19' )`. |
| message   | string     |         | The text message to send. |
| alert     | boolean    | false   | Enable to send as class 0 message (flash message), or Disable to send as a normal sms. |
| callback  | [function] |         | The callback is called twice. First time when queued for sending and second time when message was really send out. |

```js
modem.sendSMS('63999XXXXX19', 'Hello there Zab!', true, callback)
```

#### Get Sim Inbox
Shows messages of sim inbox
```js
modem.getSimInbox(callback)
```

#### Delete Sim Message
Delete a sim message by message object `(Use Sim Inbox data)`
```js
modem.deleteMessage(messageObj, callback)
```

#### Delete All Sim Messages
```js
modem.deleteAllSimMessages(callback)
```

#### Get Modem Serial
```js
modem.getModemSerial(callback)
```

#### Get Network Signal
```js
modem.getNetworkSignal(callback)
```

#### Get Own Number
```js
modem.getOwnNumber(callback)
```

#### Set Own Number
`setOwnNumber('number', callback, name[optional || default 'OwnNumber'])`
```js
modem.setOwnNumber(number, callback)
```

#### Hangup Call
```js
modem.hangupCall(callback)
```

#### Execute AT Command
For executing a complex custom command with multi-line responses, you need your own parsing logic - see examples
```js
modem.executeCommand(command, callback, priority, timeout)
```

## Other Usage 
### Events
#### open
```js
modem.on('open', result => { /*do something*/ })
```

#### close
```js
modem.on('close', result => { /*do something*/ })
```

#### error
```js
modem.on('error', result => { /*do something*/ })
```

#### onSendingMessage
```js
modem.on('onSendingMessage', result => { status, request, data })
```

#### onNewMessage
```js
modem.on('onNewMessage', messageDetails)
```

#### onNewMessage Indicator
```js
modem.on('onNewMessageIndicator', result => { sender, timeSent })
```

#### onNewIncomingCall
```js
modem.on('onNewIncomingCall', result => { number, numberScheme })
```

#### onMemoryFull
```js
modem.on('onMemoryFull', result => { status, data })
```

## Errors
When errors are returned and the error originated from the device, then in the error message, an error code should be listed, e.g. "+CMS ERROR: 500". An (incomplete) list of possible error codes and their meanings can be found e.g. at https://www.activexperts.com/sms-component/gsm-error-codes/

## SerialPort
Access base serialport. Please refer to [***SerialPort Docs***](https://serialport.io/docs/en/api-serialport) for documentation
```js
let serialportgsm = require('serialport-gsm')
let serialport = serialportgsm.serialport
```

Access modem serialport.
```js
modem.port.SERIAL_PORT_PROTOTYPES
```

## Contributors
Thanks goes to these wonderful people who contributed a lot in this project:
 
<a href="https://github.com/zabsalahid/serialport-gsm/graphs/contributors">
  <img src="https://contributors-img.firebaseapp.com/image?repo=zabsalahid/serialport-gsm" />
</a>

Made with [contributors-img](https://contributors-img.firebaseapp.com).

## License
SerialPort-GSM is [MIT licensed](LICENSE) and all it's dependencies are MIT or BSD licensed.