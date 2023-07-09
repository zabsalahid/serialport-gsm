import { AutoDetectTypes } from '@serialport/bindings-cpp';
import { SerialPort } from 'serialport';
import { SerialPortOpenOptions } from 'serialport/dist/index';
import { Communicator } from '../utils/Communicator';

export class SerialPortCommunicator implements Communicator {
	private readonly device: string;
	private readonly serialPort: SerialPort;

	constructor(device: string, options: Partial<SerialPortOptions> = {}) {
		const serialPortOptions: SerialPortOptions = Object.assign(
			// defaults
			{
				baudRate: 9600,
				dataBits: 8,
				stopBits: 1,
				highWaterMark: 16384,
				parity: 'none',
				rtscts: false,
				xon: false,
				xoff: false
			},
			// options
			options,
			// overide options
			{
				path: device,
				autoOpen: false
			}
		);

		this.device = device;
		this.serialPort = new SerialPort(serialPortOptions);
	}

	get deviceIndentifier() {
		return `${this.serialPort.path}-${this.device}`;
	}

	get isConnected() {
		return this.serialPort.isOpen;
	}

	async connect() {
		await new Promise((resolve: (success: true) => void, reject: (error: Error) => void) => {
			this.serialPort.open((error) => {
				if (error !== null) {
					reject(error);
				}

				resolve(true);
			});
		});
	}

	async disconnect() {
		await new Promise((resolve: (success: true) => void, reject: (error: Error) => void) => {
			this.serialPort.close((error) => {
				if (error !== null) {
					reject(error);
				}

				resolve(true);
			});
		});
	}

	async setOnResiveFunc(func: (data: string) => void) {
		this.serialPort.on('data', (dataBuffer: Buffer) => func(dataBuffer.toString()));
	}

	async write(data: string) {
		this.serialPort.write(data);
	}

	/**
	 * Retrieves a list of available serial ports.
	 * @see https://serialport.io/docs/api-bindings-cpp#list
	 */
	static async listDevices() {
		return SerialPort.list();
	}
}

/**
 * @see https://serialport.io/docs/api-bindings-cpp#open
 */
export type SerialPortOptions = SerialPortOpenOptions<AutoDetectTypes>;
