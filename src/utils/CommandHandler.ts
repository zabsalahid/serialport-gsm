import { utils as pduUtils } from 'node-pdu';
import { SerialPort } from 'serialport';
import { Modem } from '../Modem';
import { CommandResponse } from '../types';
import { Command } from './Command';
import { Events } from './Events';
import { CmdStack } from './utils';

export class CommandHandler {
	// references
	private readonly modem: Modem;
	private readonly serialPort: SerialPort;
	private readonly events: Events;

	// queued commands
	readonly prioQueue: (Command | CmdStack)[] = [];
	readonly queue: (Command | CmdStack)[] = [];

	// sending commands
	private isLocked = false;
	private interval: NodeJS.Timer | null = null;

	// receiving data
	private receivedData = '';
	private receivedCmdResponse: CommandResponse = [];

	constructor(modem: Modem, serialPort: SerialPort, events: Events) {
		this.modem = modem;
		this.serialPort = serialPort;
		this.events = events;

		this.serialPort.on('data', (data) => this.dataReceived(data));
	}

	/*
	 * sending commands
	 */

	private async executeNextCmd() {
		if (this.isLocked || !this.serialPort.isOpen) {
			return;
		}

		const item = this.prioQueue.shift() || this.queue.shift();

		if (item === undefined) {
			return;
		}

		this.isLocked = true;

		if (item instanceof Command) {
			await this.executeCMD(item);
		} else {
			for (const cmd of item.cmds) {
				const result = await this.executeCMD(cmd);

				if (result instanceof Error && item.cancelOnFailure) {
					if (item.onFailed) {
						item.onFailed(result);
					}

					break;
				}
			}

			if (item.onFinish) {
				item.onFinish();
			}
		}

		this.isLocked = false;
		return item;
	}

	private async executeCMD(cmd: Command) {
		const result = await new Promise((resolve: (result: CommandResponse | Error) => void) => {
			if (cmd.deprecated) {
				return resolve(new Error('Command marked as deprecated'));
			}

			const write = `${cmd.ATCommand}\r`;

			this.events.emit('onWriteToModem', write);
			this.serialPort.write(write);

			if (cmd.awaitResponse === false) {
				return setTimeout(() => resolve([]), cmd.timeout);
			}

			let timeout = setTimeout(() => resolve(new Error('Command is timeouted!')), cmd.timeout);

			const resetTimeout = () => {
				clearTimeout(timeout);
				timeout = setTimeout(() => {
					this.events.removeListener('onDataReceived', resetTimeout);
					resolve(new Error('Command is timeouted!'));
				}, cmd.timeout);
			};

			this.events.on('onDataReceived', () => resetTimeout());

			this.events.once('onCommandResponse', (data) => {
				this.events.removeListener('onDataReceived', resetTimeout);
				clearTimeout(timeout);
				resolve(data);
			});
		});

		try {
			cmd.callback(result);
		} catch (error) {
			if (error instanceof Error) {
				return error;
			}
		}

		return result;
	}

	/*
	 * receiving data
	 */

	private dataReceived(received: Buffer) {
		this.receivedData += received.toString();
		const parts = this.receivedData.split('\r\n');
		this.receivedData = parts.pop() || '';

		for (const part of parts) {
			this.events.emit('onDataReceived', part + '\r\n');

			if (part.trim() === '') {
				continue;
			}

			// skip echoes from commands
			if (part.toUpperCase().startsWith('AT')) {
				continue;
			}

			// new incomming SMS
			if (part.toUpperCase().startsWith('+CMTI:')) {
				const smsID = Number(part.match(/\d+/g)?.[1] || NaN);

				if (!isNaN(smsID)) {
					this.events.emit('onNewSms', smsID);
				}

				continue;
			}

			// new incomming call
			if (part.toUpperCase().startsWith('+CLIP')) {
				const splitted_newpart = part.substring(6).split(',');

				if (splitted_newpart[0] && splitted_newpart[1]) {
					const foundNumbers = /"(.*?)"/g.exec(splitted_newpart[0]);

					this.events.emit('onNewIncomingCall', {
						phoneNumber: foundNumbers !== null && foundNumbers[1] ? foundNumbers[1] : 'unknown',
						scheme: splitted_newpart[1]
					});
				}

				continue;
			}

			if (part.toUpperCase().includes('^SMMEMFULL')) {
				this.modem.checkSimMemory(true);
				continue;
			}

			if (part.toUpperCase().startsWith('+CUSD:')) {
				const splitted_newpart = part.substring(7).split(',');
				const followCode = Number(splitted_newpart[0]);
				let text;
				let follow;

				switch (followCode) {
					case 0:
						follow = 'no further action required';
						break;
					case 1:
						follow = 'further action required';
						break;
					case 2:
						follow = 'terminated by network';
						break;
					case 3:
						follow = 'operation not supported';
						break;
				}

				if (splitted_newpart.length > 1) {
					const decodable = /"(.*?)"/g.exec(splitted_newpart[1]);

					if (decodable !== null && decodable.length > 1) {
						text = pduUtils.Helper.decode16Bit(decodable[1]);
					} else {
						text = splitted_newpart[1];
					}
				}

				this.events.emit('onNewIncomingUSSD', { text, follow, followCode });
				continue;
			}

			this.receivedCmdResponse.push(part);

			if ((part.trim().toUpperCase() === 'OK' || part.toUpperCase().includes('ERROR')) && this.receivedCmdResponse.length > 0) {
				this.events.emit('onCommandResponse', this.receivedCmdResponse);
				this.receivedCmdResponse = [];
			}
		}
	}

	/*
	 * public functions
	 */

	startProcessing() {
		if (this.interval !== null) {
			return;
		}

		this.interval = setInterval(() => this.executeNextCmd().catch(() => (this.isLocked = false)), 10);
	}

	stopProcessing() {
		if (this.interval === null) {
			return;
		}

		clearInterval(this.interval);
		this.interval = null;
	}

	pushToQueue(cmd: Command | CmdStack, prio = false) {
		if (prio) {
			this.prioQueue.push(cmd);
			return;
		}

		this.queue.push(cmd);
	}
}
