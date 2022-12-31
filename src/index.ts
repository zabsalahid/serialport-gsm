import { SerialPort } from 'serialport';

export async function listSerialDevices() {
	return SerialPort.list();
}

export { Modem } from './Modem';
export * as types from './types';

