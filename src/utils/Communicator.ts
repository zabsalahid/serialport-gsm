/**
 * Interface representing a communication channel with a modem.
 *
 * The Communicator interface defines the communication methods used by the Modem class
 * to interact with the physical modem device. It abstracts the low-level communication details,
 * allowing the Modem class to focus on higher-level functionality.
 */
export interface Communicator {
	/**
	 * Unique identifier for the communication device.
	 */
	deviceIndentifier: string;

	/**
	 * Indicates whether the communicator is currently connected.
	 */
	isConnected: boolean;

	/**
	 * Establishes a connection to the communication device.
	 * Returns a Promise that resolves when the connection is successfully established.
	 */
	connect: () => Promise<void>;

	/**
	 * Disconnects the communicator from the communication device.
	 * Returns a Promise that resolves when the disconnection is completed.
	 */
	disconnect: () => Promise<void>;

	/**
	 * Sets a callback function to handle received data.
	 * @param func The function to be called when data is received. It takes a string parameter representing the received data.
	 */
	setOnResiveFunc: (func: (data: string) => void) => void;

	/**
	 * Writes data to the communication device.
	 * @param data The data string to be sent through the communicator.
	 */
	write: (data: string) => void;
}
