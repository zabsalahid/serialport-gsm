const { SerialPort } = require("serialport");
const Modem = require("./functions/modem");

const SerialPortGSM = {
  serialport: SerialPort,

  list: function (callback) {
    if (callback === undefined) {
      return SerialPort.list();
    }
    SerialPort.list()
      .then((results) => callback(null, results))
      .catch((error) => callback(error));
  },

  Modem: function (params) {
    return new Modem(SerialPort);
  },
};

module.exports = SerialPortGSM;
