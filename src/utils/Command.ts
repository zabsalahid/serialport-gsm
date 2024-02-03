import { CommandResponse } from './types';

/**
 * Represents a command that can be sent to a modem.
 */
export class Command {
	/**
	 * Indicates if the command is considered deprecated.
	 * If deprecated, the command will be skipped.
	 */
	deprecated = false;

	/**
	 * Constructs a new instance of the Command class.
	 *
	 * @param ATCommand The AT command string to be sent to the device.
	 * @param timeout The maximum time in milliseconds to wait for a response from the device.
	 * @param callback A callback function that is called when a response is received or an error occurs.
	 * @param awaitResponse Whether to await a response from the device after sending the command.
	 */
	constructor(
		readonly ATCommand: string,
		readonly timeout = 3000,
		readonly callback: (result: CommandResponse | Error) => void = () => undefined,
		readonly awaitResponse = true
	) {}
}
