let SerialPort = require('serialport')
let Modem = require('./functions/modem')

const SerialPortGSM = {

  serialport: SerialPort,

  list: function (callback) {
    if (callback === undefined) {
      return new Promise((resolve, reject) => {
        SerialPortGSM.listOpenPorts((error, results) => {
          if (error) {
            resolve(error)
          } else {
            reject(results)
          }
        })
      })
    }
    SerialPort.list((error, results) => {
      if (error) {
        callback(error)
      } else {
        callback(null, results)
      }
    })
  },

  Modem: function (params) {
    return new Modem(SerialPort)
  }
}

module.exports = SerialPortGSM