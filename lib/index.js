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
    SerialPort
      .list()
      .then(results=>callback(null, results))
      .catch(error=>callback(error))
  },

  Modem: function (params) {
    return new Modem(SerialPort)
  }
}

module.exports = SerialPortGSM