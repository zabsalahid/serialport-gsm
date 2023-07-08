import { SerialPort } from 'serialport';

/**
 * Retrieves a list of available serial ports.
 * @see https://serialport.io/docs/api-bindings-cpp#list
 */
export async function listSerialDevices() {
	return SerialPort.list();
}

export { Modem } from './Modem';
export * as types from './types';
