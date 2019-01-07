let pduParser = require('pdu')

//Modified PDU" included class 0 messaging
pduParser.generate = function (message) {
  var pdu = '00';

  var parts = 1;
  if (message.encoding === '16bit' && message.text.length > 70)
    parts = message.text.length / 66;

  else if (message.encoding === '7bit' && message.text.length > 160)
    parts = message.text.length / 153;

  parts = Math.ceil(parts);

  TPMTI = 1;
  TPRD = 4;
  TPVPF = 8;
  TPSRR = 32;
  TPUDHI = 64;
  TPRP = 128;

  var submit = TPMTI;

  if (parts > 1) //UDHI
    submit = submit | TPUDHI;

  submit = submit | TPSRR;

  pdu += submit.toString(16);

  pdu += '00'; //TODO: Reference Number;

  var receiverSize = ('00' + (parseInt(message.receiver.length, 10).toString(16))).slice(-2);
  var receiver = pduParser.swapNibbles(message.receiver);
  var receiverType = 81; //TODO: NOT-Hardcoded PDU generation. Please note that Hamrah1 doesnt work if we set it to 91 (International).

  pdu += receiverSize.toString(16) + receiverType + receiver;

  pdu += '00'; //TODO TP-PID

  if (message.encoding === '16bit') {
    if (message.alert === true) {
      pdu += '18';
    } else {
      pdu += '08';
    }
  } else if (message.encoding === '7bit') {
    if (message.alert === true) {
      pdu += '10';
    } else {
      pdu += '00';
    }
  }

  var pdus = new Array();

  for (var i = 0; i < parts; i++) {
    pdus[i] = pdu;

    if (message.encoding === '16bit') {
      /* If there are more than one messages to be sent, we are going to have to put some UDH. Then, we would have space only
       * for 66 UCS2 characters instead of 70 */
      if (parts === 1)
        var length = 70;
      else
        var length = 66;

    } else if (message.encoding === '7bit') {
      /* If there are more than one messages to be sent, we are going to have to put some UDH. Then, we would have space only
       * for 153 ASCII characters instead of 160 */
      if (parts === 1)
        var length = 160;
      else
        var length = 153;
    }
    var text = message.text.slice(i * length, (i * length) + length);

    if (message.encoding === '16bit') {
      user_data = pduParser.encode16Bit(text);
      var size = (user_data.length / 2);

      if (parts > 1)
        size += 6; //6 is the number of data headers we append.

    } else if (message.encoding === '7bit') {
      user_data = pduParser.encode7Bit(text);
      var size = user_data.length / 2;
    }

    pdus[i] += ('00' + parseInt(size).toString(16)).slice(-2);

    if (parts > 1) {
      pdus[i] += '05';
      pdus[i] += '00';
      pdus[i] += '03';
      pdus[i] += '00';
      pdus[i] += ('00' + parts.toString(16)).slice(-2);
      pdus[i] += ('00' + (i + 1).toString(16)).slice(-2);
    }
    pdus[i] += user_data;
  }

  return pdus;
}

module.exports = pduParser