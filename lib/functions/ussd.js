'use strict'
const Helper = require('node-pdu/PDU/Helper')

module.exports = function (modem) {

  modem.addListener({
    match: (newpart)=>{
      return newpart.substr(0, 7) === '+CUSD: ';
    },
    process: (newpart)=>{
      const splitted_newpart = newpart.substring(7).split(',')
      // console.log(newpart)
      let follow, followCode = splitted_newpart[0];
      if(followCode==='0'){
        follow = 'no further action required'
      }else if(followCode==='1'){
        follow = 'further action required'
      }else if(followCode==='2'){
        follow = 'terminated by network'
      }else if(followCode==='4'){
        follow = 'operation not supported'
      }

      let text;
      if(splitted_newpart.length>1){
        let decodable = /\"(.*?)\"/g.exec(splitted_newpart[1])
        if(decodable.length>1){
          text = Helper.decode16Bit(decodable[1]);
        }else{
          text = splitted_newpart[1]
        }
      }
      modem.emit('onNewIncomingUSSD', {
        status: 'Incoming USSD',
        data: {
          text,
          follow,
          followCode,
        }
      })
    },
  })

  modem.sendUSSD = (command, callback, timeout = 1000) => {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.sendUSSD(command, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, timeout)
      })
    }
    const item = modem.executeCommand(`AT+CUSD=1,"${command}",15`, (result, error) => {
      callback(result, error)
    }, false, timeout)
    item.logic = (newpart) => {
      // console.log({newpart})
      if ((newpart == ">" || newpart == 'OK')) {
        return {
          resultData: {
            status: 'success',
            request: 'ussd',
            data: newpart,
          },
          returnResult: true,
        }
      } else if (newpart == 'ERROR') {
        return {
          resultData: {
            status: 'fail',
            request: 'ussd',
            data: 'Cannot exec ussd'
          },
          returnResult: true,
        }
      }
    }
  }
}

