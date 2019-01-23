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

pduParser.parse = function (pdu) {
  //Cursor points to the last octet we've read.
  var cursor = 0;

  var bufferMain = new Buffer.from(pdu.slice(0, 4), 'hex');
  var smscSize = bufferMain[0];
  var smscType = bufferMain[1].toString(16);
  cursor = (smscSize * 2 + 2);
  var smscNum = pduParser.deSwapNibbles(pdu.slice(4, cursor));

  var buffer = new Buffer.from(pdu.slice(cursor, cursor + 6), 'hex');
  cursor += 6;
  var smsDeliver = buffer[0];

  var smsDeliverBits = ("00000000" + parseInt(smsDeliver).toString(2)).slice(-8);
  var udhi = smsDeliverBits.slice(1, 2) === "1";

  var senderSize = buffer[1];
  if (senderSize % 2 === 1)
    senderSize++;

  var senderType = parseInt(buffer[2]).toString(16)

  var encodedSender = pdu.slice(cursor, cursor + senderSize);
  var senderNum;
  if (senderType === '91') {
    senderNum = pduParser.deSwapNibbles(encodedSender);
  } else if (senderType === 'd0') {
    senderNum = pduParser.decode7Bit(encodedSender).replace(/\0/g, '');
  } else {
    console.error('unsupported sender type.');
  }

  cursor += senderSize;

  var protocolIdentifier = pdu.slice(cursor, cursor + 2);
  cursor += 2;

  var dataCodingScheme = pdu.slice(cursor, cursor + 2);
  cursor = cursor + 2;

  var encoding = pduParser.detectEncoding(dataCodingScheme);

  var timestamp = pduParser.deSwapNibbles(pdu.slice(cursor, cursor + 14));


  var time = new Date;
  time.setUTCFullYear('20' + timestamp.slice(0, 2));
  time.setUTCMonth(timestamp.slice(2, 4) - 1);
  time.setUTCDate(timestamp.slice(4, 6));
  time.setUTCHours(timestamp.slice(6, 8));
  time.setUTCMinutes(timestamp.slice(8, 10));
  time.setUTCSeconds(timestamp.slice(10, 12));

  var firstTimezoneOctet = parseInt(timestamp.slice(12, 13));
  var binary = ("0000" + firstTimezoneOctet.toString(2)).slice(-4);
  var factor = binary.slice(0, 1) === '1' ? 1 : -1;
  var binary = '0' + binary.slice(1, 4);
  var firstTimezoneOctet = parseInt(binary, 2).toString(10);
  var timezoneDiff = parseInt(firstTimezoneOctet + timestamp.slice(13, 14));
  var time = new Date(time.getTime() + (timezoneDiff * 15 * 1000 * 60 * factor));

  cursor += 14;

  var dataLength = parseInt(pdu.slice(cursor, cursor + 2), 16).toString(10);
  cursor += 2;

  if (udhi) { //User-Data-Header-Indicator: means there's some User-Data-Header.
    var udhLength = pdu.slice(cursor, cursor + 2);
    var iei = pdu.slice(cursor + 2, cursor + 4);
    if (iei == "00") { //Concatenated sms.
      var headerLength = pdu.slice(cursor + 4, cursor + 6);
      var referenceNumber = pdu.slice(cursor + 6, cursor + 8);
      var parts = pdu.slice(cursor + 8, cursor + 10);
      var currentPart = pdu.slice(cursor + 10, cursor + 12);
    }

    if (iei == "08") { //Concatenaded sms with a two-bytes reference number
      var headerLength = pdu.slice(cursor + 4, cursor + 6);
      var referenceNumber = pdu.slice(cursor + 6, cursor + 10);
      var parts = pdu.slice(cursor + 10, cursor + 12);
      var currentPart = pdu.slice(cursor + 12, cursor + 14);
    }

    if (encoding === '16bit')
      if (iei == '00')
        cursor += (udhLength - 2) * 4;
      else if (iei == '08')
        cursor += ((udhLength - 2) * 4) + 2;
      else
        cursor += (udhLength - 2) * 2;
  }

  if (encoding === '16bit')
    var text = pduParser.decode16Bit(pdu.slice(cursor), dataLength);
  else if (encoding === '7bit')
    var text = pduParser.decode7Bit(pdu.slice(cursor), dataLength);
  else if (encoding === '8bit')
    var text = ''; //TODO

  var data = {
    'smsc': smscNum,
    'smsc_type': smscType,
    'sender': senderNum,
    'sender_type': senderType,
    'encoding': encoding,
    'time': time,
    'text': text
  };

  if (udhi) {
    data['udh'] = {
      'length': udhLength,
      'iei': iei,
    };

    if (iei == '00' || iei == '08') {
      data['udh']['reference_number'] = referenceNumber;
      data['udh']['parts'] = parseInt(parts);
      data['udh']['current_part'] = parseInt(currentPart);
    }
  }

  return data;
}

module.exports = pduParser