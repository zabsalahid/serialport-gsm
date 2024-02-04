import { AutoDetectTypes } from '@serialport/bindings-cpp';
import { SerialPort } from 'serialport';
import { SerialPortOpenOptions } from 'serialport/dist/index';
import { Communicator } from '../utils/Communicator';

/**
 * Represents a communicator using the SerialPort library for communication with hardware devices.
 */
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

	/*
	 * ================================================
	 *                      Getter
	 * ================================================
	 */

	/**
	 * Gets the identifier for the communication device.
	 *
	 * @returns The device identifier.
	 */
	get deviceIndentifier() {
		return `serialport-${this.serialPort.path}-${this.device}`;
	}

	/**
	 * Checks if the communication device is currently connected.
	 *
	 * @returns True if the device is connected, otherwise false.
	 */
	get isConnected() {
		return this.serialPort.isOpen;
	}

	/*
	 * ================================================
	 *                 Public functions
	 * ================================================
	 */

	/**
	 * Connects to the serial port device.
	 */
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

	/**
	 * Disconnects from the serial port device.
	 */
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

	/**
	 * Sets a callback function to handle incoming data from the serial port.
	 *
	 * @param func The function to be called with received data.
	 */
	async setOnResiveFunc(func: (data: string) => void) {
		this.serialPort.on('data', (dataBuffer: Buffer) => func(dataBuffer.toString()));
	}

	/**
	 * Writes data to the serial port.
	 *
	 * @param data The data to be written.
	 */
	async write(data: string) {
		this.serialPort.write(data);
	}

	/**
	 * Retrieves a list of available serial ports.
	 * @see https://serialport.io/docs/api-bindings-cpp#list
	 *
	 * @returns A promise resolving to an array of available serial ports.
	 */
	static async listDevices() {
		return SerialPort.list();
	}
}

/**
 * @see https://serialport.io/docs/api-bindings-cpp#open
 */
export type SerialPortOptions = SerialPortOpenOptions<AutoDetectTypes>;
