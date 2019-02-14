const SerialPort = require('serialport')
const Modem = require('./functions/modem')

const SerialPortGSM = {

  serialport: SerialPort,

  list: function (callback) {
    if (callback === undefined) {
      return new Promise((resolve, reject) => {
        SerialPortGSM.list((error, results) => {
          if (error) {
            reject(error)
          } else {
            resolve(results)
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