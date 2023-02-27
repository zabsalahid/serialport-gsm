'use strict'


module.exports = function (modem) {

  modem.addListener({
    match: (newpart)=>{
      return newpart.substr(0, 8) === '+STKPCI:';
    },
    process: (newpart)=>{
      const splitted_newpart = newpart.substring(8).split(',')
      console.log(splitted_newpart)
      if (splitted_newpart.length === 1 && splitted_newpart[0] === ' 2') {
        modem.emit('onNewIncomingSTK', {
          status: 'Ended STK',
          data: '2'
        })
      } else {
        modem.emit('onNewIncomingSTK', {
          status: 'Incoming STK',
          data: splitted_newpart.length > 0 && splitted_newpart[1].replace(/"/g, '')
        })
      }
    },
  })

  modem.executeSTK = (command, callback, timeout = 1000) => {
    if (callback == undefined) {
      return new Promise((resolve, reject) => {
        modem.executeSTK(command, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }, timeout)
      })
    }
    const item = modem.executeCommand(command, (result, error) => {
      callback(result, error)
    }, false, timeout)
    item.logic = (newpart) => {
      // console.log({newpart})
      if ((newpart == ">" || newpart == 'OK')) {
        return {
          resultData: {
            status: 'success',
            request: 'stk',
            data: newpart,
          },
          returnResult: true,
        }
      } else if (newpart == 'ERROR') {
        return {
          resultData: {
            status: 'fail',
            request: 'stk',
            data: 'Cannot exec sim toolkit'
          },
          returnResult: true,
        }
      }
    }
  }

}

