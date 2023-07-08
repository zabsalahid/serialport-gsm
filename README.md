# Node SerialPort-GSM

SerialPort-GSM - A library for the communication with GSM modems like sending and receiving SMS messages.

[![NPM](https://nodei.co/npm/serialport-gsm.png)](https://npmjs.org/package/serialport-gsm)

## Install

```bash
npm i serialport-gsm
```

## Usage

Usage in JavaScript/TypeScript (with ES Modules):

```typescript
import { Modem } from 'serialport-gsm';

// Initalization of the modem. For more options take a look at the full documentaion
const myModem = new Modem('COM4');

// You can listen to different events
myModem.on('onWriteToModem', (data) => console.log('>:', data.replace(/\n|\r/g, '')));
myModem.on('onDataReceived', (data) => console.log('<:', data.replace(/\n|\r/g, '')));

// Do whatever you want
async function start() {
  await myModem.open();

  console.log('.checkModem()', await myModem.checkModem());
  console.log('.getSignalInfo()', await myModem.getSignalInfo());
  console.log('.getRegisteredNetwork()', await myModem.getRegisteredNetwork());
  console.log('.getAvailableNetworks()', await myModem.getAvailableNetworks());
  console.log('.checkSimMemory()', await myModem.checkSimMemory());
  console.log('.getProductSerialNumber()', await myModem.getProductSerialNumber());
  console.log('.getOwnNumber()', await myModem.getOwnNumber());
  console.log('.getSimInbox()', await myModem.getSimInbox());
  console.log('.sendSms()', await myModem.sendSms('+XXXXXXXXX', 'Hello, Zap here!'));

  await myModem.close();
}

start();
```

You can find more information in the **[full documentation](https://zabsalahid.github.io/serialport-gsm/)**.

---

## ❤️ Contributors

**Our thanks go to these wonderful people who have contributed to this project:**

[![Contributors](https://contrib.rocks/image?repo=zabsalahid/serialport-gsm)](https://github.com/zabsalahid/serialport-gsm/graphs/contributors)

Made with [contrib.rocks](https://contrib.rocks).

## 🤝 Contributing

Contributions, issues and feature requests are welcome! Feel you free to check [issues page](https://github.com/zabsalahid/serialport-gsm/issues) or create a [pull request](https://github.com/zabsalahid/serialport-gsm/pulls). We are happy about collaboration on this project.
