'use strict'

const pdu = require('node-pdu')

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
  modem.device = ''

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
            comName: modem.device,
            status: 'Closed'
          }
        })
      }
    })
  }

  modem.open = function (device, options, callback) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.open(device, options, (error, result) => {
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
    if (options && options.incomingCallIndication == true) modem.incomingCallIndication = true
    modem.port = SerialPort(device, options, (error) => {
      if (error) {
        callback(error)
      } else {
        let result = { status: 'success', request: 'connectModem', data: { modem: modem.port.path, status: 'Online' } }
        modem.device = device
        modem.emit('open', result)
        callback(null, result)
        if (modem.incomingCallIndication == true) {
          modem.enableCLIP(()=>{}) // we are not interested in the call back
        }
      }
    })

    modem.port.on('open', () => {
      modem.isOpened = true
      modem.port.on('data', modem.dataReceived)
    })

    modem.port.on('close', (err, msg) => {
      modem.isOpened = false
      modem.emit('close', {
        modem: modem.port.path,
        status: 'Offline'
      })
    })

    modem.port.on('error', () => {
      modem.emit('error', {
        modem: modem.port.path
      })
      modem.isOpened = false
    })
  }

  modem.readSMSById = function (id) {
    modem.executeCommand(`AT+CMGR=${id}`, undefined, true)
  }

  modem.checkSimMemory = function (callback, priority) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.checkSimMemory((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority)
      })
    }
    if (priority == null) priority = false
    modem.executeCommand(`AT+CPMS=` + `"SM"`, function (result, error) {
      callback(result, error)
    }, priority)
  }

  modem.initializeModem = function (callback, priority, timeout) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.initializeModem((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    modem.executeCommand('ATZ', function (result, error) {
      callback(result, error)
    }, false, timeout || 30000)
  }

  modem.setModemMode = function (callback, priority, timeout, mode) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.setModemMode((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout, mode)
      })
    }
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
      modem.executeCommand(`AT+CMGF=${modem.modemMode}`, function (result, error) {
        callback(result, error)
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
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.sendSMS(number, message, alert, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })
      })
    }
    try {
      if (number && message) {
        let messageID = modem.makeId(25)
        //use node-pdu
        let submit = pdu.Submit()
        submit.setAddress(number)
        submit.setData(message)
        if (alert == true) {
          submit.getDcs().setUseMessageClass(alert)
        }
        let parts = submit.getParts()

        for (let i = 0; i < parts.length; i++) {
          modem.executeCommand(`AT+CMGS=${(parts[i].toString().length / 2) - 1}`, function (data) { }, false, 100)
          modem.executeCommand(`${parts[i].toString()}` + '\x1a', function (data, error) {
            if(!data){
              // console.log('no data for sms send', {data, error})
              return
            }
            let channel = ''
            if (data.status == 'fail') {
              channel = 'onMessageSendingFailed'
            } else {
              channel = 'onMessageSent'
            }

            if (i == parts.length - 1) {
              const result = {
                status: data.status,
                request: data.request,
                data: {
                  messageId: data.data.messageId,
                  message: data.data.message,
                  recipient: data.data.recipient,
                  response: data.data.response
                }
              }
              modem.emit(channel, result)
              callback(result)
            }
          }, false, 30000, messageID, message, number)
        }
        // if it is called with promise (the promise callback has 2 args)
        // it is better not to callback until the message is sent or failed, 
        // the call back send above inside the call back
        if(callback.length===1){
          callback({
            status: 'success',
            request: 'sendSMS',
            data: {
              messageId: messageID,
              response: 'Successfully Sent to Message Queue'
            }
          })
        }

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
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.deleteAllSimMessages((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    modem.executeCommand('AT+CMGD=1,4', function (result, error) {
      callback(result, error)
    }, priority, timeout)
  }

  modem.getModemSerial = function (callback, priority, timeout) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.getModemSerial((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    modem.executeCommand('AT+CGSN', function (result, error) {
      callback(result, error)
    }, priority, timeout)

  }

  modem.getNetworkSignal = function (callback, priority, timeout) {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.getNetworkSignal((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    modem.executeCommand('AT+CSQ', function (result, error) {
      callback(result, error)
    }, priority, timeout)

  }

  modem.release = () => {
    modem.data = '' //Empty the result buffer.
    modem.isLocked = false //release the modem for next command.
    modem.queue.shift() //Remove current item from queue.
  }

  modem.executeCommand = (command, callback, priority, timeout, messageID, message, recipient) => {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.executeCommand(command, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout, messageID, message, recipient)
      })
    }
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
    item.callback = callback
    item.add_time = new Date()
    item.id = ++modem.jobID
    item.timeout = timeout  || 60000 //Default timeout it 60 seconds. Send false to disable timeouts.
    item.on('timeout', ()=>{
      callback(undefined, new Error(`timeout: \n${JSON.stringify(item)}`))
    })
    // item.on('start', ()=>{
    //   console.log('started')
    // })

    if (priority) {
      if (modem.queue.length > 1) {
        modem.queue.splice(2, 0, item)
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
    modem.port.write(`${item.command}\r`)
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
        if (newpart.substr(0, 6) == '+CMTI:') { // New Message Indicator with SIM Card ID, After Recieving Read The Message From the SIM Card
          const splitted_newpart = newpart.split(',')
          modem.readSMSById(splitted_newpart[1])
        } else if (newpart.substr(0, 5) == '+CLIP') { // New Message Indicator with SIM Card ID, After Recieving Read The Message From the SIM Card
          const splitted_newpart = newpart.split(',')
          if (modem.incomingCallIndication == true) {
            modem.emit('onNewIncomingCall', {
              status: 'Incoming Call',
              data: {
                number: /\"(.*?)\"/g.exec(splitted_newpart[0])[1],
                numberingScheme: splitted_newpart[1],
              }
            })
          }
        } else if (newpart.substr(0, 10) == '^SMMEMFULL' || newpart.indexOf('^SMMEMFULL') > -1) {
          modem.checkSimMemory()
        }
        if (modem.queue.length && modem.queue[0]) {
          if ((modem.queue[0].status == 'sendSMS')) { // If SMS is currently Sending Emit currently sending SMS
            modem.emit('onSendingMessage', {
              status: 'Sending SMS',
              request: 'sendingSMS',
              data: {
                messageId: modem.queue[0].messageID,
                message: modem.queue[0].message,
                recipient: modem.queue[0].recipient,
                response: 'Message Currently Sending'
              }
            })
            modem.queue[0]['status'] = 'Sending SMS'
          }
          if ((modem.queue[0].command == `AT+CPMS="SM"`)) { // Query SIM Card Space Available
            if (newpart.trim().substr(0, 6) === '+CPMS:') {
              modem.parseSimCardResponse(newpart, result => {
                resultData = result
              })
            }
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true
            }
          } else if ((modem.queue[0].command == 'AT+CMGD=1,4')) { // Delete All Data from SIM Card
            if (newpart == 'OK') {
              resultData = {
                status: 'success',
                request: 'deleteAllSimMessages',
                data: 'success'
              }
              returnResult = true
            }
          } else if ((modem.queue[0].command.substr(0, 7) == 'AT+CMGD')) { // Delete By Index from SIM Card
            if (newpart == 'OK') {
              resultData = {
                status: 'success',
                request: 'deleteSimMessage',
                data: 'success'
              }
              returnResult = true
            }
          } else if ((modem.queue[0].command == 'ATZ')) { // Query Modem AT to initialize
            resultData = {
              status: 'success',
              request: 'modemInitialized',
              data: 'Modem Successfully Initialized'
            }
            if ((newpart == ">" || newpart == "> " || newpart == 'OK') && resultData) {
              returnResult = true
            }
          } else if ((modem.queue[0].command == 'AT+CSQ')) { // Query Modem AT to initialize

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
          } else if ((modem.queue[0].command == 'AT+CGSN')) { // Query Modem AT to initialize
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
          } else if ((modem.queue[0].command == 'AT+CMGF=0') || (modem.queue[0].command == 'AT+CMGF=1')) { // PDU Mode for Modem .. Default PDU Mode to accomodate Long SMS
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
          } else if ((modem.queue[0].command.substr(0, 7) == 'AT+CMGR')) { // Get New Message From SIM Card
            let regx = /[0-9A-Fa-f]{15}/g
            if (regx.test(newpart)) {
              let newMessage = pdu.parse(newpart)
              let messageIndex = parseInt(modem.queue[0].command.split('=')[1], 10)
              resultData = {
                sender: newMessage.sender,
                timeSent: new Date(newMessage.getScts().getIsoString()),
                index: messageIndex
              }
              let message = self.processMessage(newMessage, messageIndex)

              if (modem.enableConcatenation == true && message.udh) {
                if (modem.tempConcatenatedMessages[message.udh.referenceNumber]) {
                  modem.tempConcatenatedMessages[message.udh.referenceNumber].push(message)
                } else {
                  modem.tempConcatenatedMessages[message.udh.referenceNumber] = [message]
                }
                let tempMessage = self.arrangeMessages(modem.tempConcatenatedMessages[message.udh.referenceNumber])[0]
                //check if complete
                if (tempMessage.udh.parts == tempMessage.udhs.length) {
                  delete modem.tempConcatenatedMessages[message.udh.referenceNumber]
                  modem.emit('onNewMessageIndicator', resultData)
                  modem.emit('onNewMessage', tempMessage)
                }
              } else {
                modem.emit('onNewMessageIndicator', resultData)
                modem.emit('onNewMessage', message)
              }

              if (modem.autoDeleteOnReceive == true) {
                modem.deleteMessage(message)
              }
              modem.checkSimMemory()
            }
            regx.lastIndex = 0 // be sure to reset the index after using .test()
            if ((newpart == ">" || newpart == 'OK') && resultData) {
              returnResult = true
            }
          } else if ((modem.queue[0].command.substr(0, 7) == 'AT+CNUM')) { //Get own number
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
          } else if ((modem.queue[0].command.substr(0, 9) == 'AT+CLIP=1')) { // Enable Clip
            if (newpart == ">" || newpart == 'OK') {
              resultData = {
                status: 'success',
                request: 'enableCLIP',
                data: 'OK'
              }
              returnResult = true
            } else if (newpart == 'ERROR') {
              resultData = {
                status: 'ERROR',
                request: 'enableCLIP',
                data: 'Error on enabling CLIP'
              }
              returnResult = true
            }
          } else if ((modem.queue[0].command.substr(0, 7) == 'AT+CPBS')) { // Select Phonebook
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
          } else if ((modem.queue[0].command.substr(0, 7) == 'AT+CPBW')) { // Write to Phonebook
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
          } else if ((modem.queue[0].command.substr(0, 9) == 'AT+CMGL=4')) { // Get Sim Inbox
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
          } else if ((modem.queue[0].command.substr(0, 7) == 'AT+CMGS' || pduTest.test(modem.queue[0].command))) { // Sending of Message if with response ok.. Then Message was sent successfully.. If Error then Message Sending Failed
            resultData = {
              status: 'success',
              request: 'SendSMS',
              data: {
                messageId: modem.queue[0].messageID,
                message: modem.queue[0].message,
                recipient: modem.queue[0].recipient,
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
                  messageId: modem.queue[0].messageID,
                  message: modem.queue[0].message,
                  recipient: modem.queue[0].recipient,
                  response: 'Message Failed'
                }
              }
              returnResult = true
            }
          } else { // let's check if it has a logic function
            if (modem.queue[0].logic){
              const logicResult = modem.queue[0].logic(newpart);
              if(logicResult){
                resultData = logicResult.resultData
                returnResult = logicResult.returnResult
              }
            }
          }
          let callback
          if (returnResult) { // Expected Result was ok or with error call back function that asked for the data or emit to listener, Execute next Command if any or Execute Next Command if TIME Out and modem did not respond
            returnResult = false
            if (modem.queue[0] && modem.queue[0].callback) {
              callback = modem.queue[0].callback
            } else {
              callback = null
            }

            modem.queue[0].end_time = new Date()
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
      total: ''
    }
    newpart = newpart.split(' ')
    newpart = newpart[1].split(',')
    simCardCheck.used = parseInt(newpart[0])
    simCardCheck.total = parseInt(newpart[1])
    if (simCardCheck.used == simCardCheck.total) {
      modem.emit('onMemoryFull', {
        status: 'Memory Full',
        data: {
          used: simCardCheck.used,
          total: simCardCheck.total
        }
      })
    }
    if (callback) {
      callback({
        status: 'success',
        request: 'checkSimMemory',
        data: simCardCheck
      })
    }
  }

  modem.getOwnNumber = (callback, timeout = 10000) => {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.getOwnNumber((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, timeout)
      })
    }
    modem.executeCommand(`AT+CNUM`, (result, error) => {
      callback(result, error)
    }, false, timeout)
  }

  modem.setOwnNumber = (number, callback, name = 'OwnNumber', timeout = 10000) => {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.setOwnNumber(number, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, name, timeout)
      })
    }
    //Select Phonebook Memory Storage "ON" SIM (or ME) own numbers (MSISDNs) list (reading of this storage may be available through +CNUM
    modem.executeCommand(`AT+CPBS="ON"`, (result, error) => {
      if (error){
        callback(undefined, error)
      }
      if (result.data === 'OK') {
        //CPBW parameters, Phonebook location, phone number, type of address octet in integer format, name
        modem.executeCommand(`AT+CPBW=1,"${number}",129,"${name}"`, (result, error) => {
          callback(result, error)
        }, false, timeout)
      }
    }, false, timeout)
  }

  modem.getSimInbox = (callback, timeout = 15000) => {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.getSimInbox((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, timeout)
      })
    }
    modem.executeCommand((modem.modemMode == 0 ? `AT+CMGL=4` : `AT+CMGL="ALL"`), (result, error) => {
      callback(result, error)
    }, false, timeout)
  }

  modem.deleteMessage = (message, callback, timeout = 10000) => {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.deleteMessage(message, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, timeout)
      })
    }
    if (modem.enableConcatenation == true && message.udhs) {
      let indexes = message.udhs.map(a => a.index).sort((a, b) => { return b - a })
      //TO we have a problem with promises here, we have to collect all the results then executeing the callback
      indexes.forEach((i, index) => {
        modem.executeCommand(`AT+CMGD=${i}`, (result, error) => {
          if(error){
            callback(undefined, error)
          }
          if (index == indexes.length - 1) {
            callback(result)
          }
        }, false, timeout)
      })
    } else {
      modem.executeCommand(`AT+CMGD=${message.index}`, (result, error) => {
        callback(result, error)
      }, false, timeout)
    }
  }

  modem.enableCLIP = (callback, timeout = 1000) => {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.enableCLIP((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, timeout)
      })
    }
    modem.executeCommand(`AT+CLIP=1`, (result, error) => {
      callback(result, error)
    }, false, timeout)
  }

  modem.hangupCall = (callback, timeout = 1000) => {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.hangupCall((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, timeout)
      })
    }
    const item = modem.executeCommand(`ATH`, (result, error) => {
      callback(result, error)
    }, false, timeout)
    item.logic = (newpart) => {
      console.log(`logic for command : ${item.command} with newpart : ${newpart}`)
      if ((newpart == ">" || newpart == 'OK')) {
        return {
          resultData: {
            status: 'success',
            request: 'hangupCall',
            data: newpart,
          },
          returnResult: true,
        }
      } else if (newpart == 'ERROR') {
        return {
          resultData: {
            status: 'fail',
            request: 'hangupCall',
            data: 'Cannot hangup call'
          },
          returnResult: true,
        }
      }
    }
  }

  self.processMessage = (message, messageIndex) => {
    let newMessage = {
      sender: message.getAddress().getPhone() || null,
      message: message.getData().getText() || null,
      index: messageIndex,
      dateTimeSent: message.getScts() ? new Date(message.getScts().getIsoString()) : null || null,
      header: {
        encoding: self.getEncoding(message.getDcs()._dataEncoding) || null,
        smsc: message.getSca().getPhone() || null,
        smscType: self.getType(message.getSca().getType().getType()) || null,
        smscPlan: self.getPlan(message.getSca().getType().getPlan()) || null,
      }
    }

    // UDH - User Data Header, used to form concatenated sms
    if (message.getData().getParts()[0].getHeader()) {
      newMessage.udh = {
        referenceNumber: message.getData().getParts()[0].getHeader().getPointer(),
        parts: message.getData().getParts()[0].getHeader().getSegments(),
        part: message.getData().getParts()[0].getHeader().getCurrent()
      }
    }

    return newMessage
  }

  self.arrangeMessages = messageResult => {
    if (modem.enableConcatenation == true) {
      let newMessageResult = []
      messageResult.forEach((message, index) => {
        if (message.udh) {
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
    let target = newMessageResult.find(a => a.udh && a.udh.referenceNumber == message.udh.referenceNumber)
    if (target) {
      target.udhs.push({
        index: message.index,
        message: message.message,
        part: message.udh.part,
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
        header: {
          encoding: message.header.encoding,
          smsc: message.header.smsc,
          smscType: message.header.smscType,
          smscPlan: message.header.smscPlan,
        },
        udh: {
          referenceNumber: message.udh.referenceNumber,
          parts: message.udh.parts,
          part: message.udh.part
        },
        udhs: [{
          index: message.index,
          message: message.message,
          part: message.udh.part
        }]
      }

      newMessageResult.push(newUdhMessage)
    }
  }

  self.getEncoding = encoding => {
    switch (encoding) {
      case 8: return '16bit'
      case 4: return '8bit'
      case 0:
      default:
        return '7bit'
    }
  }

  self.getType = type => {
    switch (type) {
      case 0x00: return 'UNKNOWN'
      case 0x01: return 'INTERNATIONAL'
      case 0x02: return 'NATIONAL'
      case 0x03: return 'ACCEPTER_INTO_NET'
      case 0x04: return 'SUBSCRIBER_NET'
      case 0x05: return 'ALPHANUMERICAL'
      case 0x06: return 'TRIMMED'
      case 0x07: return 'RESERVED'
    }
  }

  self.getPlan = plan => {
    switch (plan) {
      case 0x00: return 'UNKNOWN'
      case 0x01: return 'ISDN'
      case 0x02: return 'X_121'
      case 0x03: return 'TELEX'
      case 0x08: return 'NATIONAL'
      case 0x09: return 'INDIVIDUAL'
      case 0x0A: return 'ERMES'
      case 0x0F: return 'RESERVED'
    }
  }

  return modem
}