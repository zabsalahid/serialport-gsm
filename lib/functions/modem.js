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
  modem.listeners = []
  modem.queue = []
  modem.jobID = 1
  modem.isLocked = false
  modem.isOpened = false
  modem.modemMode = 0
  modem.tempConcatenatedMessages = {}
  modem.device = ''
  modem.pin = ''
  modem.customInitCommand = ''
  modem.incomingSMSIndication = true
  modem.logger = {
    debug: function () { }
  };

  modem.close = function (callback) {
    if (typeof callback !== 'function') {
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
    if (typeof callback !== 'function') {
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
    if (options && options.autoDeleteOnReceive !== undefined) modem.autoDeleteOnReceive = options.autoDeleteOnReceive
    if (options && options.enableConcatenation !== undefined) modem.enableConcatenation = options.enableConcatenation
    if (options && options.incomingCallIndication !== undefined) modem.incomingCallIndication = options.incomingCallIndication
    if (options && options.incomingSMSIndication !== undefined) modem.incomingSMSIndication = options.incomingSMSIndication
    if (options && options.pin && options.pin.length) modem.pin = options.pin
    if (options && options.customInitCommand && options.customInitCommand.length) modem.customInitCommand = options.customInitCommand
    if (options && options.logger) modem.logger = options.logger
    modem.port = SerialPort(device, options, (error) => {
      if (error) {
        callback(error)
      } else {
        let result = { status: 'success', request: 'connectModem', data: { modem: modem.port.path, status: 'Online' } }
        modem.device = device
        modem.emit('open', result)
        callback(null, result)
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

  modem.addListener = (listener) => {
    if (!listener.match || typeof listener.match !== 'function') {
      throw new Error('match function is needed for the listener')
    }
    if (!listener.process || typeof listener.process !== 'function') {
      throw new Error('process function is needed for the listener')
    }
    modem.listeners.push(listener);
  }

  modem.readSMSById = function (id) {
    const item = modem.executeCommand(`AT+CMGR=${id}`, () => { }, true)

    let resultData;
    item.logic = (newpart) => {
      let regx = /[0-9A-Fa-f]{15}/g
      if (regx.test(newpart)) {
        let messageIndex = parseInt(id, 10)
        let message
        try {
          let newMessage = pdu.parse(newpart)
          resultData = {
            sender: newMessage.sender,
            timeSent: new Date(newMessage.getScts().getIsoString()),
            index: messageIndex,
          }
          message = self.processMessage(newMessage, messageIndex)
        } catch (error) {
          message = {
            unparsedMessage: newpart,
            index: messageIndex,
          }
          resultData = {
            index: messageIndex,
          }
        }

        if (modem.enableConcatenation && message.udh) {
          if (modem.tempConcatenatedMessages[message.udh.referenceNumber]) {
            modem.tempConcatenatedMessages[message.udh.referenceNumber].push(message)
          } else {
            modem.tempConcatenatedMessages[message.udh.referenceNumber] = [message]
          }
          let tempMessage = self.arrangeMessages(modem.tempConcatenatedMessages[message.udh.referenceNumber])[0]
          //check if complete
          if (tempMessage.udh.parts === tempMessage.udhs.length) {
            delete modem.tempConcatenatedMessages[message.udh.referenceNumber]
            modem.emit('onNewMessageIndicator', resultData)
            modem.emit('onNewMessage', tempMessage)
          }
        } else {
          modem.emit('onNewMessageIndicator', resultData)
          modem.emit('onNewMessage', message)
        }

        if (modem.autoDeleteOnReceive) {
          modem.deleteMessage(message)
        }
        modem.checkSimMemory()
      }
      regx.lastIndex = 0 // be sure to reset the index after using .test()
      if ((newpart === '>' || newpart === 'OK') && resultData) {
        return {
          resultData,
          returnResult: true
        }
      }
      else if (newpart.includes('ERROR') || ((newpart === '>' || newpart === 'OK') && !resultData)) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'readSMSById',
            data: `Cannot read Message ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.checkSimMemory = function (callback, priority) {
    if (typeof callback !== 'function') {
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
    const item = modem.executeCommand(`AT+CPMS="SM"`, (result, error) => {
      callback(result, error)
    }, priority)

    item.logic = (newpart) => {
      if (newpart.trim().startsWith('+CPMS:')) {
        return {
          resultData: modem.parseSimCardResponse(newpart),
          returnResult: true
        }
      }
    }
  }

  modem.initializeModem = function (callback, priority, timeout) {

    function sendAdditionalCommands() {
      const item = modem.executeCommand('AT+CMEE=1;+CREG=2', (result, error) => {
        // we do not need the callback
      }, false, timeout || 30000)
      item.logic = (newpart) => {
        if (newpart.trim() === '>' || newpart === 'OK') {
          return {
            resultData: {
              status: 'success',
              request: 'modemInitialized',
              data: 'Modem Successfully Initialized'
            },
            returnResult: true
          }
        } else if (newpart.includes('ERROR')) {
          return {
            resultData: {
              status: 'ERROR',
              request: 'initializeModem',
              data: `Cannot Get Modem Initialized ${newpart}`
            },
            returnResult: true
          }
        }
      }

      if (modem.customInitCommand.length) {
        const item = modem.executeCommand(modem.customInitCommand, (result, error) => {
          // we do not need the callback
        }, false, timeout || 30000)
        item.logic = (newpart) => {
          if (newpart.trim() === '>' || newpart === 'OK') {
            return {
              resultData: {
                status: 'success',
                request: 'modemInitialized',
                data: 'Modem Successfully Initialized'
              },
              returnResult: true
            }
          } else if (newpart.includes('ERROR')) {
            return {
              resultData: {
                status: 'ERROR',
                request: 'initializeModem',
                data: `Cannot Get Modem Initialized ${newpart}`
              },
              returnResult: true
            }
          }
        }

      }

      if (modem.incomingCallIndication) {
        modem.enableCLIP(() => { })
      }
    }

    if (typeof callback !== 'function') {
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
    modem.resetModem((resultCheck, error) => {
      if (!error) {
        modem.enableEcho((result, error) => {
          if (!error) {
            modem.checkPINRequired((result, error) => {
              if (!error && result.data && result.data.pinNeeded && modem.pin.length) {
                modem.providePIN(modem.pin, (result, error) => {
                  if (!error) {
                    sendAdditionalCommands()
                  }
                  callback(resultCheck, error)
                }, priority, timeout)
              } else {
                if (!error) {
                  sendAdditionalCommands()
                }
                callback(resultCheck, error)
              }
            }, priority, timeout)
          } else {
            callback(resultCheck, error)
          }
        }, priority, timeout);
      } else {
        callback(resultCheck, error)
      }
    }, priority, timeout);
  }

  modem.resetModem = function (callback, priority, timeout) {
    if (typeof callback !== 'function') {
      return new Promise((resolve, reject) => {
        modem.resetModem((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    // is the modem Ready?
    const item = modem.executeCommand('ATZ', (resultInit, error) => {
      callback(resultInit, error)
    }, false, timeout || 30000, undefined, undefined, undefined, true) // auto activate it if no Echo is active
    item.logic = (newpart) => {
      if (newpart === '>' || newpart === '> ' || newpart === 'OK') {
        return {
          resultData: {
            status: 'success',
            request: 'modemInitialized',
            data: 'Modem Successfully Initialized'
          },
          returnResult: true
        }
      } else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'initializeModem',
            data: `Cannot Get Modem Initialized ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.enableEcho = function (callback, priority, timeout) {
    if (typeof callback !== 'function') {
      return new Promise((resolve, reject) => {
        modem.enableEcho((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    // is the modem Ready?
    const item = modem.executeCommand('ATE1', (resultInit, error) => {
      callback(resultInit, error)
    }, false, timeout || 30000, undefined, undefined, undefined, true) // auto activate it if no Echo is active
    item.logic = (newpart) => {
      if (newpart === '>' || newpart === '> ' || newpart === 'OK') {
        return {
          resultData: {
            status: 'success',
            request: 'enableEcho',
            data: 'Modem Echo Successfully Activated'
          },
          returnResult: true
        }
      } else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'initializeModem',
            data: `Cannot Activate Modem Echo ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.checkModem = function (callback, priority, timeout) {
    if (typeof callback !== 'function') {
      return new Promise((resolve, reject) => {
        modem.checkModem((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    // is the modem Ready?
    const item = modem.executeCommand('AT', (resultInit, error) => {
      callback(resultInit, error)
    }, false, timeout || 30000)
    item.logic = (newpart) => {
      if (newpart === '>' || newpart === '> ' || newpart === 'OK') {
        return {
          resultData: {
            status: 'success',
            request: 'checkModem',
            data: 'Modem Available'
          },
          returnResult: true
        }
      } else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'checkModem',
            data: `Cannot Communicate with Modem ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.setModemMode = function (callback, priority, timeout, mode) {
    if (callback !== undefined && typeof callback !== 'function') {
      return modem.setModemMode(undefined, callback, priority, timeout, mode)
    }
    if (typeof callback !== 'function' || typeof callback !== 'function') {
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
    if (timeout === 'PDU' || timeout === 'SMS') {
      mode = timeout
    }
    if (priority === 'PDU' || priority === 'SMS') {
      mode = priority
    }
    if (mode === 'PDU' || mode === 'SMS') {
      if (mode === 'PDU') {
        modem.modemMode = 0
      } else if (mode === 'SMS') {
        modem.modemMode = 1
      }
      const item = modem.executeCommand(`AT+CMGF=${modem.modemMode}`, (result, error) => {
        if (mode === 'PDU' && !error && modem.incomingSMSIndication) {
          modem.enableCNMI(() => { })
        }

        callback(result, error)
      }, false, 30000)

      let resultData;
      item.logic = (newpart) => {
        if (modem.modemMode === 0) {
          resultData = {
            status: 'success',
            request: 'modemMode',
            data: 'PDU_Mode'
          }
        } else if (modem.modemMode === 1) {
          resultData = {
            status: 'success',
            request: 'modemMode',
            data: 'SMS_Mode'
          }
        }
        if ((newpart === '>' || newpart === 'OK') && resultData) {
          return {
            resultData,
            returnResult: true
          }
        }
      }
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
    if (typeof callback !== 'function') {
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
        if (alert) {
          submit.getDcs().setUseMessageClass(alert)
        }
        let parts = submit.getParts()

        for (let i = 0; i < parts.length; i++) {
          modem.executeCommand(`AT+CMGS=${(parts[i].toString().length / 2) - 1}`, (data) => { }, false, 100)
          modem.executeCommand(`${parts[i].toString()}` + '\x1a', function (data, error) {
            if (!data) {
              // console.log('no data for sms send', {data, error})
              return
            }
            let channel = ''
            if (data.status === 'fail') {
              channel = 'onMessageSendingFailed'
            } else {
              channel = 'onMessageSent'
            }

            if (i === parts.length - 1) {
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
          }, false, 30000, messageID, message, number, true)
        }
        // if it is called with promise (the promise callback has 2 args)
        // it is better not to callback until the message is sent or failed, 
        // the call back send above inside the call back
        if (callback.length === 1) {
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

  modem.checkPINRequired = function (callback, priority, timeout) {
    if (typeof callback !== 'function') {
      return new Promise((resolve, reject) => {
        modem.checkPINRequired((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    const item = modem.executeCommand('AT+CPIN?', (result, error) => {
      callback(result, error)
    }, priority, timeout)

    let resultData
    item.logic = (newpart) => {
      if (newpart.startsWith('+CPIN:')) {
        return {
          resultData: {
            status: 'success',
            request: 'checkPINRequired',
            data: { pinNeeded: !newpart.includes('READY') }
          },
          returnResult: true
        }
      }
      if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'Error',
            request: 'checkPINRequired',
            error: newpart
          },
          returnResult: true
        }
      }
    }
  }

  modem.providePIN = function (pin, callback, priority, timeout) {
    if (typeof callback !== 'function') {
      return new Promise((resolve, reject) => {
        modem.providePIN(pin, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    const item = modem.executeCommand(`AT+CPIN=${pin}`, (result, error) => {
      callback(result, error)
    }, priority, timeout)
    item.logic = (newpart) => {
      if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'Error',
            request: 'providePIN',
            error: newpart
          },
          returnResult: true
        }
      } else {
        return {
          resultData: {
            status: 'success',
            request: 'providePIN',
            data: 'success'
          },
          returnResult: true
        }
      }
    }
  }

  modem.deleteAllSimMessages = function (callback, priority, timeout) {
    if (typeof callback !== 'function') {
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
    const item = modem.executeCommand('AT+CMGD=1,4', (result, error) => {
      callback(result, error)
    }, priority, timeout)
    item.logic = (newpart) => {
      if (newpart === 'OK') {
        return {
          resultData: {
            status: 'success',
            request: 'deleteAllSimMessages',
            data: 'success'
          },
          returnResult: true
        }
      }
    }
  }

  modem.deleteSimMessages = function (id, callback, priority, timeout) {
    if (typeof callback !== 'function') {
      return new Promise((resolve, reject) => {
        modem.deleteSimMessages(id, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, priority, timeout)
      })
    }
    if (priority == null) priority = false
    const item = modem.executeCommand(`AT+CMGD=${id}`, (result, error) => {
      callback(result, error)
    }, priority, timeout)
    item.logic = (newpart) => {
      if (newpart === 'OK') {
        return {
          resultData: {
            status: 'success',
            request: 'deleteSimMessages',
            data: 'success'
          },
          returnResult: true
        }
      }
    }
  }

  modem.getModemSerial = function (callback, priority, timeout) {
    if (typeof callback !== 'function') {
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
    const item = modem.executeCommand('AT+CGSN', (result, error) => {
      callback(result, error)
    }, priority, timeout)

    let resultData;
    item.logic = (newpart) => {
      let isSerial = /^\d+$/.test(newpart)
      if (isSerial) {
        return {
          resultData: {
            status: 'success',
            request: 'getModemSerial',
            data: { 'modemSerial': newpart }
          },
          returnResult: true
        }
      }
      else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'getModemSerial',
            data: `Cannot Get Modem Serial Number ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.getNetworkSignal = function (callback, priority, timeout) {
    if (typeof callback !== 'function') {
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
    const item = modem.executeCommand('AT+CSQ', (result, error) => {
      callback(result, error)
    }, priority, timeout)

    let resultData;
    item.logic = (newpart) => {
      if (newpart.startsWith('+CSQ:')) {
        let signal = newpart.split(' ')
        signal = signal[1].split(',')
        return {
          resultData:{
            status: 'success',
            request: 'getNetworkSignal',
            data: {
              'signalQuality': signal[0],
              'signalStrength': signal[0] !== 99 ? (113 - signal[0] * 2) : undefined
            }
          },
          returnResult: true
        }
      }
      if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'getNetworkSignal',
            data: `Cannot Get Signal ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.release = () => {
    modem.data = '' //Empty the result buffer.
    modem.isLocked = false //release the modem for next command.
    modem.queue.shift() //Remove current item from queue.
  }

  modem.executeCommand = (command, callback, priority, timeout, messageID, message, recipient, activateProcessing) => {
    if (typeof callback !== 'function') {
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
      return {}
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
    item.timeout = timeout || 60000 //Default timeout it 60 seconds. Send false to disable timeouts.
    item.on('timeout', () => {
      callback(undefined, new Error(`timeout: \n${JSON.stringify(item)}`))
    })
    item.inProgress = activateProcessing;
    // item.on('start', ()=>{
    //   console.log('started')
    // })
    item.logic = (newpart) => {
      const commandName = command.match(/^AT([^?= ]+)[?= ]?/i);
      if (commandName && commandName[1] && newpart.startsWith(commandName[1])) {
        return {
          resultData: {
            status: 'success',
            request: 'executeCommand',
            data: { 'result': newpart.substr(commandName[1].length + 1) }
          },
          returnResult: true
        }
      }
      if (newpart.includes('OK')) {
        return {
          resultData: {
            status: 'success',
            request: 'executeCommand',
            data: { 'result': 'OK' }
          },
          returnResult: true
        }
      }
      if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'executeCommand',
            data: `Execute Command returned Error: ${newpart}`
          },
          returnResult: true
        }
      }
    }

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
    modem.logger.debug(`Modem Write: ${item.command}`)
  }

  modem.dataReceived = buffer => {
    const received = buffer.toString()
    data += received
    // console.log(received)
    let parts = data.split('\r\n')
    data = parts.pop()
    parts.forEach(part => {
      let newparts = part.split(/\r\n|\n|\r/)
      newparts.forEach(newpart => {
        modem.logger.debug(`Modem Received: ${newpart}`)
        let pduTest = /[0-9A-Fa-f]{15}/g
        if (modem.incomingSMSIndication && newpart.startsWith('+CMTI:')) { // New Message Indicator with SIM Card ID, After Recieving Read The Message From the SIM Card
          const splitted_newpart = newpart.split(',')
          modem.readSMSById(splitted_newpart[1])
        } else if (modem.incomingCallIndication && newpart.startsWith('+CLIP')) { // New Incomming call
          const splitted_newpart = newpart.split(',')
          modem.emit('onNewIncomingCall', {
            status: 'Incoming Call',
            data: {
              number: /"(.*?)"/g.exec(splitted_newpart[0])[1],
              numberingScheme: splitted_newpart[1],
            }
          })
        } else if (newpart.includes('^SMMEMFULL')) {
          modem.checkSimMemory()
        }

        //we can also move the logic of incoming call and incoming message here
        modem.listeners.forEach(l => {
          if (l.match(newpart)) {
            l.process(newpart);
          }
        })

        if (modem.queue.length && modem.queue[0]) {
          if (modem.queue[0].command.trim() === newpart.trim()) { // Echo of command received, only process if active
            modem.queue[0].inProgress = true;
            modem.logger.debug('Activate Message Processing for: ' + newpart)
          }
          if ((modem.queue[0].status === 'sendSMS')) { // If SMS is currently Sending Emit currently sending SMS
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
          if ((modem.queue[0].command.startsWith('AT+CMGS') || pduTest.test(modem.queue[0].command))) { // Sending of Message if with response ok.. Then Message was sent successfully.. If Error then Message Sending Failed
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
            if ((newpart === '>' || newpart === 'OK') && resultData) {
              returnResult = true
            } else if (newpart.includes('ERROR')) {
              resultData = {
                status: 'fail',
                request: 'SendSMS',
                data: {
                  messageId: modem.queue[0].messageID,
                  message: modem.queue[0].message,
                  recipient: modem.queue[0].recipient,
                  response: `Message Failed ${newpart}`
                }
              }
              returnResult = true
            }
          } else { // let's check if it has a logic function
            if (modem.queue[0].logic && modem.queue[0].inProgress) {
              const logicResult = modem.queue[0].logic(newpart);
              if (logicResult) {
                resultData = logicResult.resultData
                returnResult = logicResult.returnResult
              }
            } else {
              modem.logger.debug(`Ignore Data: ${newpart}`)
            }
          }
          let callback
          if (returnResult && modem.queue[0].inProgress) { // Expected Result was ok or with error call back function that asked for the data or emit to listener, Execute next Command if any or Execute Next Command if TIME Out and modem did not respond
            returnResult = false
            if (modem.queue[0] && modem.queue[0].callback) {
              callback = modem.queue[0].callback
              modem.logger.debug('Call callback for: ' + modem.queue[0].command)
            } else {
              callback = null
              modem.logger.debug('No callback for: ' + modem.queue[0].command)
            }

            modem.queue[0].end_time = new Date()
            clearTimeout(timeouts[modem.queue[0].id])
            modem.release()

            if (callback) {
              setImmediate(callback, resultData) // call callback async
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
    if (simCardCheck.used === simCardCheck.total) {
      setImmediate(() => {
        modem.emit('onMemoryFull', {
          status: 'Memory Full',
          data: {
            used: simCardCheck.used,
            total: simCardCheck.total
          }
        })
      })
    }
    const result = {
      status: 'success',
      request: 'checkSimMemory',
      data: simCardCheck
    };
    if (callback) {
      callback(result)
    }
    else {
      return result
    }
  }

  modem.getOwnNumber = (callback, timeout = 10000) => {
    if (typeof callback !== 'function') {
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
    const item = modem.executeCommand(`AT+CNUM`, (result, error) => {
      callback(result, error)
    }, false, timeout)

    let resultData;
    item.logic = (newpart) => {
      if (newpart.startsWith('+CNUM')) {
        let splitResult = newpart.split(',')
        if (splitResult.length > 0 && splitResult[1]) {
          return {
            resultData: {
              status: 'success',
              request: 'getOwnNumber',
              data: {
                name: /"(.*?)"/g.exec(splitResult[0])[1],
                number: /"(.*?)"/g.exec(splitResult[1])[1]
              }
            },
            returnResult: true
          }
        } else {
          // TODO what will happen here?
          newpart === 'ERROR'
        }
      } else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'getOwnNumber',
            data: `Cannot Get Sim Number ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.selectPhonebookStorage = (memory, callback, timeout = 10000) => {
    if (typeof callback !== 'function') {
      return new Promise((resolve, reject) => {
        modem.selectPhonebookStorage(memory, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })
      })
    }
    //Select Phonebook Memory Storage "ON" SIM (or ME) own numbers (MSISDNs) list (reading of this storage may be available through +CNUM
    const item = modem.executeCommand(`AT+CPBS="${memory}"`, (result, error) => {
      callback(result, error)
    }, false, timeout);
    item.logic = (newpart) => {
      if (newpart === '>' || newpart === 'OK') {
        return {
          resultData: {
            status: 'success',
            request: 'selectPhonebookStorage',
            data: newpart
          },
          returnResult: true
        }
      } else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'selectPhonebookStorage',
            data: `Error on setting phonebook storage ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.writeToPhonebook = (number, name, callback, timeout = 10000) => {
    if (typeof callback !== 'function') {
      return new Promise((resolve, reject) => {
        modem.writeToPhonebook(number, name, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })
      })
    }
    //CPBW parameters, Phonebook location, phone number, type of address octet in integer format, name
    const item = modem.executeCommand(`AT+CPBW=1,"${number}",129,"${name}"`, (result, error) => {
      callback(result, error)
    }, false, timeout);
    item.logic = (newpart) => {
      if (newpart === '>' || newpart === 'OK') {
        return {
          resultData: {
            status: 'success',
            request: 'writeToPhonebook',
            data: newpart
          },
          returnResult: true
        }
      } else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'writeToPhonebook',
            data: `Cannot Write To Phonebook ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.setOwnNumber = (number, callback, name = 'OwnNumber', timeout = 10000) => {
    if (typeof callback !== 'function') {
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
    modem.selectPhonebookStorage('ON', (result, error) => {
      if (error) {
        callback(undefined, error)
      }
      if (result.data === 'OK') {
        modem.writeToPhonebook(number, name, (result, error) => {
          callback(result, error)
        })
      }
    })
  }

  modem.getSimInbox = (callback, timeout = 15000) => {
    if (typeof callback !== 'function') {
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
    const item = modem.executeCommand((modem.modemMode === 0 ? `AT+CMGL=4` : `AT+CMGL="ALL"`), (result, error) => {
      callback(result, error)
    }, false, timeout)

    let resultData;
    item.logic = (newpart) => {
      let regx = /[0-9A-Fa-f]{15}/g
      if (!resultData) {
        resultData = {
          status: 'success',
          request: 'getSimInbox',
          data: []
        }
      }
      if (newpart.includes('+CMGL:')) {
        resultData.data.push({
          index: parseInt(newpart.split(',')[0].replace('+CMGL: ', ''), 10)
        })
      } else if (regx.test(newpart)) {
        let newMessage = pdu.parse(newpart)
        let messageIndex = resultData.data[resultData.data.length - 1].index
        let message = self.processMessage(newMessage, messageIndex)
        resultData.data[resultData.data.length - 1] = message
      } else if ((newpart === '>' || newpart === 'OK') && resultData) {
        resultData.data = self.arrangeMessages(resultData.data)
        return {
          resultData,
          returnResult: true
        }
      } else if (newpart.includes('ERROR')) {
        resultData = {
          status: 'ERROR',
          request: 'getSimInbox',
          data: `Cannot Get Sim Inbox ${newpart}`
        }
        return {
          resultData,
          returnResult: true
        }
      }
    }
  }

  modem.deleteMessage = (message, callback, timeout = 10000) => {
    if (typeof callback !== 'function') {
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
    if (modem.enableConcatenation && message.udhs) {
      let indexes = message.udhs.map(a => a.index).sort((a, b) => { return b - a })
      const responses = {
        deleted: [],
        errors: [],
      };
      indexes.forEach((i, index) => {
        modem.deleteSimMessages(i, (result, error) => {
          if (error) {
            responses.errors.push(error);
          } else {
            responses.deleted.push(result);
          }
          if (index === indexes.length - 1) {
            if (responses.errors.length > 0) {
              callback(undefined, {
                status: 'ERROR',
                request: 'deleteMessage',
                data: responses,
              })
            } else {
              callback({
                status: 'success',
                request: 'deleteMessage',
                data: responses,
              })
            }
          }
        }, false, timeout)
      })
    } else {
      modem.deleteSimMessages(message.index, (result, error) => {
        callback(result, error)
      }, false, timeout)
    }
  }

  modem.enableCLIP = (callback, timeout = 1000) => {
    if (typeof callback !== 'function') {
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
    const item = modem.executeCommand(`AT+CLIP=1`, (result, error) => {
      callback(result, error)
    }, false, timeout)
    item.logic = (newpart) => {
      if (newpart === '>' || newpart === 'OK') {
        return {
          resultData: {
            status: 'success',
            request: 'enableCLIP',
            data: 'OK'
          },
          returnResult: true
        }
      } else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'enableCLIP',
            data: `Error on enabling CLIP ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.enableCNMI = (callback, timeout = 1000) => {
    if (typeof callback !== 'function') {
      return new Promise((resolve, reject) => {
        modem.enableCNMI((result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, timeout)
      })
    }
    const item = modem.executeCommand(`AT+CNMI=2,1,0,2,0`, (result, error) => {
      callback(result, error)
    }, false, timeout)
    item.logic = (newpart) => {
      if (newpart === '>' || newpart === 'OK') {
        return {
          resultData: {
            status: 'success',
            request: 'enableCNMI',
            data: 'OK'
          },
          returnResult: true
        }
      } else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'ERROR',
            request: 'enableCNMI',
            data: `Error on enabling CNMI ${newpart}`
          },
          returnResult: true
        }
      }
    }
  }

  modem.hangupCall = (callback, timeout = 1000) => {
    if (typeof callback !== 'function') {
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
      // console.log(`logic for command : ${item.command} with newpart : ${newpart}`)
      if ((newpart === '>' || newpart === 'OK')) {
        return {
          resultData: {
            status: 'success',
            request: 'hangupCall',
            data: newpart,
          },
          returnResult: true
        }
      } else if (newpart.includes('ERROR')) {
        return {
          resultData: {
            status: 'fail',
            request: 'hangupCall',
            data: `Cannot hangup call ${newpart}`
          },
          returnResult: true
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
    if (modem.enableConcatenation) {
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
    let target = newMessageResult.find(a => a.udh && a.udh.referenceNumber === message.udh.referenceNumber)
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
