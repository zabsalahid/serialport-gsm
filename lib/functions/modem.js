'use strict'

const pdu = require('../pdu')
let EventEmitter = require('events').EventEmitter

module.exports = function (SerialPort) {
  let self = this
  let modem = new EventEmitter()
  let data = ''
  let resultData = {}
  let timeouts = {}
  let returnResult = false
  modem.queue = []
  modem.jobID = 1
  modem.isLocked = false
  modem.isOpened = false
  modem.modemMode = 0
  modem.tempConcatenatedMessages = {}

  modem.close = function (callback) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.close((error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })
      })
    }
    modem.port.close(error => {
      if (error) {
        callback(error)
      } else {
        callback(null, {
          status: 'success',
          request: 'disconnectModem',
          data: {
            comName: modem.port.path,
            status: 'Offline'
          }
        })
      }
    })
  }

  modem.open = function (device, options, callback) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.open((error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })
      })
    }
    if (options) options['parser'] = SerialPort.parsers.raw
    if (options && options.autoDeleteOnReceive == true) modem.autoDeleteOnReceive = true
    if (options && options.enableConcatenation == true) modem.enableConcatenation = true
    modem.port = SerialPort(device, options, (error) => {
      let result = { status: 'success', request: 'connectModem', data: { modem: modem.port.path, status: 'Online' } }
      if (error) {
        callback(error)
      } else {
        modem.emit('open', result)
        callback(null, result)
      }
    })

    modem.port.on('open', () => {
      modem.isOpened = true
      modem.port.on('data', modem.dataReceived)
    })

    modem.port.on('close', function () {
      modem.emit('close', {
        modem: modem.port.path
      })
      modem.isOpened = false
    })

    modem.port.on('error', function () {
      modem.emit('error', {
        modem: modem.port.path
      })
      modem.isOpened = false
    })
  }

  modem.readSMSById = function (id, callback) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.readSMSById((error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })
      })
    }
    modem.executeCommand(`AT+CMGR=${id}`, function (result) { }, true)
  }

  modem.checkSimMemory = function (callback, priority) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.checkSimMemory((error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })
      })
    }
    if (priority == null) priority = false
    modem.executeCommand(`AT+CPMS='` + `SM'`, function (result) {
      callback(result)
    }, priority)
  }

  modem.initializeModem = function (callback, priority) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.initializeModem((error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })
      })
    }
    if (priority == null) priority = false
    modem.executeCommand('ATZ', function (result) {
      callback(result)
    }, false, 30000)
  }

  modem.setModemMode = function (callback, priority, timeout, mode) {
    if (priority == null) priority = true
    if (timeout == 'PDU' || timeout == 'SMS') {
      mode == timeout
    }
    if (priority == 'PDU' || priority == 'SMS') {
      mode = priority
    }
    if (mode == 'PDU' || mode == 'SMS') {
      if (mode == 'PDU') {
        modem.modemMode = 0
      } else if (mode = 'SMS') {
        modem.modemMode = 1
      }
      modem.executeCommand(`AT+CMGF=${modem.modemMode}`, function (result) {
        callback(result)
      }, false, 30000)
    } else {
      callback({
        status: 'fail',
        request: 'modemMode',
        data: 'Modem Failed to Changed Mode'
      })
    }
  }

  modem.makeId = function (numOfCharacters) {
    let text = ''
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < numOfCharacters; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    return text
  }

  modem.sendSMS = function (number, message, alert = false, callback) {
    try {
      if (number && message) {
        let messageID = modem.makeId(25)
        let pduMessage = pdu.generate({
          text: message,
          receiver: number,
          encoding: '16bit',
          alert: alert
        })

        for (let i = 0; i < pduMessage.length; i++) {
          modem.executeCommand(`AT+CMGS=${(pduMessage[i].length / 2) - 1}`, function (data) { }, false, 100)
          modem.executeCommand(`${pduMessage[i]}` + '\x1a', function (data) {
            let channel = ''
            if (data.status == 'fail') {
              channel = 'onMessageSendingFailed'
            } else {
              channel = 'onMessageSent'
            }

            let result = {
              status: data.status,
              request: data.request,
              data: {
                messageId: data.data.messageId,
                message: data.data.message,
                recipient: data.data.recipient,
                response: data.data.response
              }
            }
            if (i == pduMessage.length - 1) {
              modem.emit(channel, result)
              callback(result)
            }
          }, false, 30000, messageID, message, number)
        }
        callback({
          status: 'success',
          request: 'sendSMS',
          data: {
            messageId: messageID,
            response: 'Successfully Sent to Message Queue'
          }
        })

      } else {
        callback({
          status: 'Error',
          request: 'sendSMS',
          error: 'Missing Arguments'
        })
      }
    } catch (error) {
      callback({
        status: 'Error',
        request: 'sendSMS',
        error: error
      })
    }
  }

  modem.deleteAllSimMessages = function (callback, priority, timeout) {
    if (priority == null) priority = false
    modem.executeCommand('AT+CMGD=1,4', function (result) {
      callback(result)
    }, priority, timeout)
  }

  modem.getModemSerial = function (callback, priority, timeout) {
    if (priority == null) priority = false
    modem.executeCommand('AT+CGSN', function (result) {
      callback(result)
    }, priority, timeout)

  }

  modem.getNetworkSignal = function (callback, priority, timeout) {
    if (priority == null) priority = false
    modem.executeCommand('AT+CSQ', function (result) {
      callback(result)
    }, priority, timeout)

  }

  modem.release = () => {
    modem.data = '' //Empty the result buffer.
    modem.isLocked = false //release the modem for next command.
    modem.queue.shift() //Remove current item from queue.
  }

  modem.executeCommand = (command, c, priority, timeout, messageID, message, recipient) => {
    if (!modem.isOpened) {
      modem.emit('close')
      return
    }

    let item = new EventEmitter()
    if (messageID) {
      item.messageID = messageID
      item.message = message
      item.recipient = recipient
      item.status = 'sendSMS'
    }
    item.command = command
    item.callback = c
    item.add_time = new Date()
    item.id = ++modem.jobID
    item.timeout = timeout
    if (item.timeout == undefined) //Default timeout it 60 seconds. Send false to disable timeouts.
      item.timeout = 60000
    if (priority) {
      // this.queue.unshift(item)
      if (modem.queue.length > 1) {
        thimodems.queue.splice(2, 0, item)
      } else {
        modem.queue.push(item)
      }
    } else {
      modem.queue.push(item)
    }

    modem.emit('job', item)
    process.nextTick(modem.executeNext)
    return item
  }

  modem.executeNext = () => {
    if (!modem.isOpened) {
      modem.emit('close')
      return
    }
    //Wait Modem is in use...
    if (modem.isLocked)
      return

    let item = modem.queue[0]

    if (!item) {
      modem.emit('idle')
      return //Queue is empty.
    }

    modem.data = ''
    modem.isLocked = true

    item.execute_time = new Date()

    item.emit('start')

    if (item.timeout)
      timeouts[item.id] = setTimeout(() => {
        item.emit('timeout')
        modem.release()
        modem.executeNext()
      }, item.timeout)
    modem.port.write(item['command'] + '\r')
  }

  modem.dataReceived = buffer => {
    data += buffer.toString()
    let parts = data.split('\r\n')
    data = parts.pop()
    parts.forEach(part => {
      let newparts = []
      newparts = part.split('\r')
      newparts = part.split('\n')
      newparts.forEach(newpart => {
        let pduTest = /[0-9A-Fa-f]{15}/g
        if (newpart.substr(0, 6) == '+CMTI:') { // New Message Indicatpr with SIM Card ID, After Recieving Read The Message From the SIM Card
          newpart = newpart.split(',')
          modem.readSMSById(newpart[1], res => { })
        }
        if (modem.queue.length) {
          if (modem.queue[0] && (modem.queue[0].status == 'sendSMS')) { // If SMS is currently Sending Emit currently sending SMS
            modem.emit('onSendingMessage', {
              status: 'Sending SMS',
              request: 'sendingSMS',
              data: {
                messageId: modem.queue[0]['messageID'],
                message: modem.queue[0]['message'],
                recipient: modem.queue[0]['recipient'],
                response: 'Message Currently Sending'
              }
            })
            modem.queue[0]['status'] = 'Sending SMS'
          }
          if (modem.queue[0] && (modem.queue[0].command == `AT+CPMS='SM'`)) { // Query SIM Card Space Available
            if (newpart.trim().substr(0, 6) === '+CPMS:') {
              modem.parseSimCardResponse(newpart, result => {
                resultData = result
              })
            }
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command == 'AT+CMGD=1,4')) { // Delete All Data from SIM Card
            if (newpart == 'OK') {
              resultData = {
                status: 'success',
                request: 'deleteAllSimMessages',
                data: 'success'
              }
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command.substr(0, 7) == 'AT+CMGD')) { // Delete By Index from SIM Card
            if (newpart == 'OK') {
              resultData = {
                status: 'success',
                request: 'deleteSimMessage',
                data: 'success'
              }
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command == 'ATZ')) { // Query Modem AT to initialize
            resultData = {
              status: 'success',
              request: 'modemInitialized',
              data: 'Modem Successfully Initialized'
            }
            if ((newpart == ">" || newpart == "> " || newpart == 'OK') && resultData) {
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command == 'AT+CSQ')) { // Query Modem AT to initialize

            if (newpart.substr(0, 5) == '+CSQ:') {
              let signal = newpart.split(' ')
              signal = signal[1].split(',')
              resultData = {
                status: 'success',
                request: 'getNetworkSignal',
                data: { 'signalQuality': signal[0] }
              }
            }
            if ((newpart == ">" || newpart == "> " || newpart == 'OK') && resultData) {
              returnResult = true
            } else if (newpart == "ERROR") {
              resultData = {
                status: 'ERROR',
                request: 'getNetworkSignal',
                data: 'Cannot Get Signal'
              }
            }
          } else if (modem.queue[0] && (modem.queue[0].command == 'AT+CGSN')) { // Query Modem AT to initialize
            let isSerial = /^\d+$/.test(newpart)
            if (isSerial) {
              resultData = {
                status: 'success',
                request: 'getModemSerial',
                data: { 'modemSerial': newpart }
              }
            }
            if ((newpart == ">" || newpart == "> " || newpart == 'OK') && resultData) {
              returnResult = true
            } else if (newpart == 'ERROR') {
              resultData = {
                status: 'ERROR',
                request: 'getModemSerial',
                data: 'Cannot Get Modem Serial Number'
              }
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command == 'AT+CMGF=0') || (modem.queue[0].command == 'AT+CMGF=1')) { // PDU Mode for Modem .. Default PDU Mode to accomodate Long SMS
            if (modem.queue[0]['command'].substr(8, 8) == '0') {
              resultData = {
                status: 'success',
                request: 'modemMode',
                data: 'PDU_Mode'
              }
            } else if (modem.queue[0].command.substr(8, 8) == '1') {
              resultData = {
                status: 'success',
                request: 'modemMode',
                data: 'SMS_Mode'
              }
            }
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command.substr(0, 7) == 'AT+CMGR')) { // Get New Message From SIM Card
            let regx = /[0-9A-Fa-f]{15}/g
            if (regx.test(newpart)) {
              let newMessage = pdu.parse(newpart)
              let messageIndex = parseInt(modem.queue[0].command.split('=')[1], 10)
              resultData = {
                sender: newMessage.sender,
                timeSent: newMessage.time,
                index: messageIndex
              }
              let message = self.processMessage(newMessage, messageIndex)

              if (modem.enableConcatenation == true && message.header.udh) {
                if (modem.tempConcatenatedMessages[message.header.udh.referenceNumber]) {
                  modem.tempConcatenatedMessages[message.header.udh.referenceNumber].push(message)
                } else {
                  modem.tempConcatenatedMessages[message.header.udh.referenceNumber] = [message]
                }
                let tempMessage = self.arrangeMessages(modem.tempConcatenatedMessages[message.header.udh.referenceNumber])[0]
                //check if complete
                if (tempMessage.header.udh.parts == tempMessage.udhs.length) {
                  delete modem.tempConcatenatedMessages[message.header.udh.referenceNumber]
                  modem.emit('onNewMessageIndicator', resultData)
                  modem.emit('onNewMessage', tempMessage)
                }
              } else {
                modem.emit('onNewMessageIndicator', resultData)
                modem.emit('onNewMessage', message)
              }

              if (modem.autoDeleteOnReceive == true) {
                modem.deleteMessage(messageIndex)
              }
            }
            regx.lastIndex = 0 // be sure to reset the index after using .test()
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command.substr(0, 7) == 'AT+CNUM')) { //Get own number
            if (newpart.indexOf('+CNUM') > -1) {
              let splitResult = newpart.split(',')
              if (splitResult.length > 0 && splitResult[1]) {
                resultData = {
                  status: 'success',
                  request: 'getOwnNumber',
                  data: {
                    name: /\"(.*?)\"/g.exec(splitResult[0])[1],
                    number: /\"(.*?)\"/g.exec(splitResult[1])[1]
                  }
                }
              } else {
                newpart == 'ERROR'
              }
            } else if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true
            } else if (newpart == 'ERROR') {
              resultData = {
                status: 'ERROR',
                request: 'getOwnNumber',
                data: 'Cannot Get Sim Number'
              }
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command.substr(0, 7) == 'AT+CPBS')) { // Select Phonebook
            if (newpart == ">" || newpart == 'OK') {
              resultData = {
                status: 'success',
                request: 'selectPhonebookStorage',
                data: newpart
              }
              returnResult = true
            } else if (newpart == 'ERROR') {
              resultData = {
                status: 'ERROR',
                request: 'selectPhonebookStorage',
                data: 'Error on setting phonebook storage'
              }
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command.substr(0, 7) == 'AT+CPBW')) { // Write to Phonebook
            if (newpart == ">" || newpart == 'OK') {
              resultData = {
                status: 'success',
                request: 'writeToPhonebook',
                data: newpart
              }
              returnResult = true
            } else if (newpart == 'ERROR') {
              resultData = {
                status: 'ERROR',
                request: 'writeToPhonebook',
                data: 'Cannot Write To Phonebook'
              }
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0].command.substr(0, 9) == 'AT+CMGL=4')) { // Get Sim Inbox
            let regx = /[0-9A-Fa-f]{15}/g
            if (!resultData) {
              resultData = {
                status: 'success',
                request: 'getSimInbox',
                data: []
              }
            }
            if (newpart.indexOf('+CMGL:') > -1) {
              resultData.data.push({
                index: parseInt(newpart.split(',')[0].replace('+CMGL: ', ''), 10)
              })
            } else if (regx.test(newpart)) {
              let newMessage = pdu.parse(newpart)
              let messageIndex = resultData.data[resultData.data.length - 1].index
              let message = self.processMessage(newMessage, messageIndex)
              resultData.data[resultData.data.length - 1] = message
            } else if ((newpart == ">" || newpart == 'OK') && resultData) {
              resultData.data = self.arrangeMessages(resultData.data)
              returnResult = true
            } else if (newpart == 'ERROR' || newpart.indexOf('ERROR') > -1) {
              resultData = {
                status: 'ERROR',
                request: 'getSimInbox',
                data: 'Cannot Get Sim Inbox'
              }
              returnResult = true
            }
          } else if (modem.queue[0] && (modem.queue[0]['command'].substr(0, 7) == 'AT+CMGS' || pduTest.test(modem.queue[0]['command']))) { // Sending of Message if with response ok.. Then Message was sent successfully.. If Error then Message Sending Failed
            resultData = {
              status: 'success',
              request: 'SendSMS',
              data: {
                messageId: modem.queue[0]['messageID'],
                message: modem.queue[0]['message'],
                recipient: modem.queue[0]['recipient'],
                response: 'Message Successfully Sent'
              }
            }
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true
            } else if (newpart == 'ERROR') {
              resultData = {
                status: 'fail',
                request: 'SendSMS',
                data: {
                  messageId: modem.queue[0]['messageID'],
                  message: modem.queue[0]['message'],
                  recipient: modem.queue[0]['recipient'],
                  response: 'Message Failed'
                }
              }
              returnResult = true
            }
          }
          let callback
          if (returnResult) { // Expected Result was ok or with error call back function that asked for the data or emit to listener, Execute next Command if any or Execute Next Command if TIME Out and modem did not respond
            returnResult = false
            if (modem.queue[0] && modem.queue[0]['callback']) {
              callback = modem.queue[0]['callback']
            } else {
              callback = null
            }

            modem.queue[0]['end_time'] = new Date()
            clearTimeout(timeouts[modem.queue[0].id])
            modem.release()

            if (callback) {
              callback(resultData)
            }
            resultData = null
            modem.executeNext()
          }
        }
      })
    })
  }

  modem.parseSimCardResponse = (newpart, callback) => {
    let simCardCheck = {
      used: '',
      totalSpace: ''
    }
    newpart = (newpart.split(' '))
    newpart = (newpart[1].split(','))
    simCardCheck.used = newpart[0]
    simCardCheck.totalSpace = newpart[1]
    callback({
      status: 'success',
      request: 'checkSimMemory',
      data: simCardCheck
    })
  }

  modem.getOwnNumber = (callback, timeout = 10000) => {
    modem.executeCommand(`AT+CNUM`, result => {
      callback(result)
    }, false, timeout)
  }

  modem.setOwnNumber = (number, callback, name = 'OwnNumber', timeout = 10000) => {
    //Select Phonebook Memery Storage "ON" SIM (or ME) own numbers (MSISDNs) list (reading of this storage may be available through +CNUM
    modem.executeCommand(`AT+CPBS="ON"`, result => {
      if (result.data === 'OK') {
        //CPBW parameters, Phonebook location, phone number, type of address octet in integer format, name
        modem.executeCommand(`AT+CPBW=1,"${number}",129,"${name}"`, result => {
          if (callback) callback(result)
        }, false, timeout)
      }
    }, false, timeout)
  }

  modem.getSimInbox = (callback, timeout = 15000) => {
    modem.executeCommand((modem.modemMode == 0 ? `AT+CMGL=4` : `AT+CMGL="ALL"`), result => {
      callback(result)
    }, false, timeout)
  }

  modem.deleteMessage = (message, callback, timeout = 10000) => {
    if (modem.enableConcatenation == true && message.udhs) {
      let indexes = message.udhs.map(a => a.index).sort((a, b) => { return b - a })
      indexes.forEach((i, index) => {
        modem.executeCommand(`AT+CMGD=${i}`, result => {
          if (index == indexes.length - 1) {
            if (callback) callback(result)
          }
        }, false, timeout)
      })
    } else {
      modem.executeCommand(`AT+CMGD=${message.index}`, result => {
        if (callback) callback(result)
      }, false, timeout)
    }
  }

  self.processMessage = (newMessage, messageIndex) => {
    let message = {
      sender: newMessage.sender || null,
      message: (newMessage.text ? (newMessage.udh ? newMessage.text.replace(/[\0\5]/g, '').substring(4) : newMessage.text.replace(/\0/g, '')) : null) || null,
      index: messageIndex,
      dateTimeSent: newMessage.time || null,
      dateTimeReceived: new Date(),
      header: {
        encoding: newMessage.encoding || null,
        smsc: newMessage.smsc || null,
        smscType: newMessage.smsc_type || null,
        senderType: newMessage.sender_type || null,
      }
    }

    // UDH - User Data Header, used to form concatenated sms
    if (newMessage.udh) {
      message.header.udh = {
        length: newMessage.udh.length,
        iei: newMessage.udh.iei,
        referenceNumber: newMessage.udh.reference_number,
        parts: newMessage.udh.parts,
        part: newMessage.udh.current_part
      }
    }

    return message
  }

  self.arrangeMessages = messageResult => {
    if (modem.enableConcatenation == true) {
      let newMessageResult = []
      messageResult.forEach((message, index) => {
        if (message.header.udh) {
          self.processConcatenatedMessage(newMessageResult, message)
        } else {
          newMessageResult.push(message)
        }
      })
      return newMessageResult
    } else {
      return messageResult
    }
  }

  self.processConcatenatedMessage = (newMessageResult, message) => {
    let target = newMessageResult.find(a => a.header.udh && a.header.udh.referenceNumber == message.header.udh.referenceNumber)
    if (target) {
      target.udhs.push({
        index: message.index,
        message: message.message,
        part: message.header.udh.part,
        length: message.header.udh.length,
        iei: message.header.udh.iei
      })
      //arrange inner message
      let newText = ''
      target.udhs = target.udhs.sort((a, b) => {
        if (a.part < b.part) return -1
        if (a.part > b.part) return 1
        return 0
      })
      target.udhs.forEach(a => newText += a.message)
      target.message = newText
    } else {
      let newUdhMessage = {
        sender: message.sender,
        index: message.index,
        message: message.message,
        dateTimeSent: message.dateTimeSent,
        dateTimeReceived: message.dateTimeReceived,
        header: {
          encoding: message.header.encoding,
          smsc: message.header.smsc,
          smscType: message.header.smscType,
          senderType: message.header.senderType,
          udh: {
            referenceNumber: message.header.udh.referenceNumber,
            parts: message.header.udh.parts
          }
        },
        udhs: [{
          index: message.index,
          message: message.message,
          part: message.header.udh.part,
          length: message.header.udh.length,
          iei: message.header.udh.iei
        }]
      }

      newMessageResult.push(newUdhMessage)
    }
  }

  return modem
}