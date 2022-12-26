import { SerialPort } from 'serialport';
import * as pdu from './lib/node-pdu/index';
import {
	CommandResponse,
	ModemConstructorOptions,
	ModemMode,
	PduSms,
	SendSMSFailed,
	SendSMSSuccess,
	SerialPortOptions,
	TxtSms
} from './types';
import { Command } from './utils/Command';
import { CommandHandler } from './utils/CommandHandler';
import { Events } from './utils/Events';
import { CmdStack, ModemOptions, resultCode, simplifyResponse, splitToChunks } from './utils/utils';

export class Modem {
	// options
	private _mode: ModemMode;
	private readonly pinCode: string | null;
	private readonly options: ModemOptions;

	// system
	private readonly port: SerialPort;
	private readonly events = new Events();
	private readonly cmdHandler: CommandHandler;

	constructor(targetDevice: string, mode: ModemMode = 'PDU', options: ModemConstructorOptions = {}) {
		this._mode = mode;
		this.pinCode = options.pin || null;

		this.options = {
			autoDeleteOnReceive: options.autoDeleteOnReceive !== undefined ? options.autoDeleteOnReceive : false,
			enableConcatenation: options.enableConcatenation !== undefined ? options.enableConcatenation : false,
			customInitCommand: options.customInitCommand !== undefined ? options.customInitCommand : null,
			autoInitOnOpen: options.autoInitOnOpen !== undefined ? options.autoInitOnOpen : true,
			cnmiCommand: options.cnmiCommand !== undefined ? options.cnmiCommand : 'AT+CNMI=2,1,0,2,1'
		};

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
			options.serialPortOptions,
			// overide options
			{
				path: targetDevice,
				autoOpen: false
			}
		);

		this.port = new SerialPort(serialPortOptions);
		this.cmdHandler = new CommandHandler(this, this.port, this.events);
	}

	/*
	 * getter
	 */

	get targetDevice() {
		return this.port.path;
	}

	get isOpen() {
		return this.port.isOpen;
	}

	get mode() {
		return this._mode;
	}

	get queueLength() {
		return this.cmdHandler.prioQueue.length + this.cmdHandler.queue.length;
	}

	/*
	 * private functions
	 */

	private async checkPinRequired(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CPIN?', prio));

		if (!response.toUpperCase().startsWith('+CPIN:') || response.toUpperCase().includes('ERROR')) {
			throw new Error(`serialport-gsm/${this.port.path}: Failed to detect if the modem requires a pin!`);
		}

		return !response.toUpperCase().includes('READY');
	}

	private async enableClip(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CLIP=1', prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Modem clip can not be activated!`);
		}
	}

	private async enableCNMI(prio = false) {
		const response = await simplifyResponse(this.executeATCommand(this.options.cnmiCommand, prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Failed to execute the cnmiCommand!`);
		}
	}

	private async setEchoMode(enable: boolean, prio = false) {
		const response = await simplifyResponse(this.executeATCommand(enable ? 'ATE1' : 'ATE0', prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Modem echo can not be activated!`);
		}
	}

	private async providePin(prio = false) {
		const response = await simplifyResponse(this.executeATCommand(`AT+CPIN=${this.pinCode}`, prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Modem could not be unlocked with pin!`);
		}
	}

	private async resetModem(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('ATZ', prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Modem failed to reset!`);
		}
	}

	/*
	 * public functions
	 */

	async open() {
		if (this.port.isOpen) {
			return;
		}

		await new Promise((resolve: (success: true) => void, reject: (error: Error) => void) => {
			this.port.open((error) => {
				if (error !== null) {
					reject(error);
				}

				resolve(true);
			});
		});

		this.events.emit('onOpen');
		this.cmdHandler.startProcessing();

		if (this.options.autoInitOnOpen) {
			await this.initializeModem(true);
		}
	}

	async close() {
		this.cmdHandler.stopProcessing();

		if (!this.port.isOpen) {
			return;
		}

		await new Promise((resolve: (success: true) => void, reject: (error: Error) => void) => {
			this.port.close((error) => {
				if (error !== null) {
					reject(error);
				}

				resolve(true);
			});
		});

		this.events.emit('onClose');
	}

	async executeATCommand(command: string, prio = false, cmdtimeout?: number) {
		return await new Promise((resolve: (response: CommandResponse) => void, reject: (error: Error) => void) => {
			this.cmdHandler.pushToQueue(
				new Command(command, cmdtimeout, (result) => {
					if (result instanceof Error) {
						reject(result);
						return;
					}

					resolve(result);
				}),
				prio
			);
		});
	}

	async initializeModem(prio = true) {
		await this.checkModem(prio);
		await this.resetModem(prio);
		await this.setEchoMode(true, prio);

		if (await this.checkPinRequired(prio)) {
			if (this.pinCode === null) {
				throw new Error(`serialport-gsm/${this.port.path}: The modem needs a pin!`);
			}

			await this.providePin(prio);
		}

		const initCommand = this.options.customInitCommand !== null ? this.options.customInitCommand : 'AT+CMEE=1;+CREG=2';
		const response = await simplifyResponse(this.executeATCommand(initCommand, prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Initialization of the modem failed`);
		}

		await this.setMode(this.mode);
		await this.enableClip(prio);

		this.events.emit('onInitialized');
	}

	async checkModem(prio = false): Promise<{ status: 'OK' }> {
		const response = await simplifyResponse(this.executeATCommand('AT', prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Check modem failed because the response from the modem was invalid!`);
		}

		return { status: 'OK' };
	}

	async setMode(mode: ModemMode, prio = false) {
		const x = mode === 'PDU' ? 0 : 1;
		const response = await simplifyResponse(this.executeATCommand(`AT+CMGF=${x}`, prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: The setting of the mode failed!`);
		}

		if (mode === 'PDU') {
			await this.enableCNMI(prio);
		}

		return (this._mode = mode);
	}

	async sendSMS(number: string, message: string, flashSMS = false, prio = false): Promise<SendSMSSuccess> {
		message = message.replace(/\r|\\x1a/g, '');
		const messageID = `${Date.now()}`;

		const cmdSequence: CmdStack = {
			cmds: [],
			cancelOnFailure: true
		};

		const checkReponse = (response: CommandResponse | Error) => {
			if (response instanceof Error || resultCode(response.pop() || '') !== 'OK') {
				throw new Error(`serialport-gsm/${this.port.path}: Failed to send SMS!`);
			}
		};

		const executeCmdStack = () =>
			new Promise((resolve: (success: true) => void, reject: (error: Error) => void) => {
				cmdSequence.onFinish = () => resolve(true);

				cmdSequence.onFailed = (error) => {
					const result: SendSMSFailed = {
						success: false,
						messageID,
						error
					};

					this.events.emitMessageSendingFailed(result);
					reject(error);
				};

				this.cmdHandler.pushToQueue(cmdSequence, prio);
			});

		if (this.mode === 'SMS') {
			for (const part of splitToChunks(message, 160)) {
				cmdSequence.cmds.push(
					...[new Command(`AT+CMGS="${number}"`, 250, undefined, false), new Command(part + '\x1a', 10000, checkReponse)]
				);
			}

			await executeCmdStack();

			const result: SendSMSSuccess = {
				success: true,
				messageID,
				data: {
					message,
					recipient: number,
					alert: false
				}
			};

			this.events.emitSMSsent(result);
			return result;
		}

		const submit = new pdu.Submit(number, message);
		submit.dataCodingScheme.setUseMessageClass(flashSMS);

		for (const part of submit.getParts()) {
			cmdSequence.cmds.push(
				...[
					new Command(`AT+CMGS=${part.toString(submit).length / 2 - 1}`, 250, undefined, false),
					new Command(part.toString(submit) + '\x1a', 10000, checkReponse)
				]
			);
		}

		await executeCmdStack();

		const result: SendSMSSuccess = {
			success: true,
			messageID,
			data: {
				message,
				recipient: number,
				alert: flashSMS,
				pdu: submit
			}
		};

		this.events.emit('onSMSsent', result);
		return result;
	}

	async getSignalInfo(prio = false) {
		const response = await this.executeATCommand('AT+CSQ', prio);

		if (resultCode(response.pop() || '') !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: The network signal could not be read!`);
		}

		const signal = Number(response[0]?.match(/(\d+)(,\d+)?/g)?.[0]?.replace(',', '.') || NaN);

		if (isNaN(signal) || signal < 0 || signal > 31) {
			throw new Error(`serialport-gsm/${this.port.path}: The signal strength could not be parsed!`);
		}

		return {
			signalQuality: signal,
			signalStrength: 113 - signal * 2
		};
	}

	async checkSimMemory(prio = false) {
		const response = await this.executeATCommand('AT+CPMS="SM"', prio);

		if (resultCode(response.pop() || '') !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: The required memory space of the SMS, could not be read!`);
		}

		const used = Number(response[0]?.match(/\d+/g)?.[0] || NaN);
		const total = Number(response[0]?.match(/\d+/g)?.[1] || NaN);

		if (isNaN(used) || isNaN(total)) {
			throw new Error(`serialport-gsm/${this.port.path}: The required memory space of the SMS, could not be parsed!`);
		}

		const result = { used, total };

		if (result.used >= result.total) {
			this.events.emit('onMemoryFull', result);
		}

		return result;
	}

	async selectPhonebookStorage(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CPBS="ON"', prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: The storage of the phone book could not be selected!`);
		}
	}

	async writeToPhonebook(phoneNumber: string, name: string, prio = false) {
		const response = await simplifyResponse(this.executeATCommand(`AT+CPBW=1,"${phoneNumber}",129,"${name}"`, prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: The entry could not be written in the phone book!`);
		}
	}

	async setOwnPhoneNumber(phoneNumber: string, name = 'OwnNumber', prio = false) {
		await this.selectPhonebookStorage(prio);
		await this.writeToPhonebook(phoneNumber, name, prio);
	}

	async getProductSerialNumber(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CGSN', prio));

		if (!/^\d+$/.test(response) || response.toUpperCase().includes('ERROR')) {
			throw new Error(`serialport-gsm/${this.port.path}: Cannot read the serial number of the modem!`);
		}

		return response;
	}

	async getOwnNumber(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CNUM', prio));

		if (!response.toUpperCase().startsWith('+CNUM') || response.toUpperCase().includes('ERROR')) {
			throw new Error(`serialport-gsm/${this.port.path}: The own phone number could not be read!`);
		}

		const regExp = /"(.*?)"/g;
		const splitedResponse = response.split(',');

		const name = regExp.exec(splitedResponse[0] || '')?.[1];
		const phoneNumber = regExp.exec(splitedResponse[1] || '')?.[1];

		if (name === undefined || phoneNumber === undefined) {
			throw new Error(`serialport-gsm/${this.port.path}: The own phone number could not be parsed!`);
		}

		return { name, phoneNumber };
	}

	async hangupCall(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('ATH', prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: The hang up of the call failed!`);
		}
	}

	async sendUSSD(command: string, prio = false) {
		const response = await simplifyResponse(this.executeATCommand(`AT+CUSD=1,"${command}",15`, prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Execution USSD failed failed!`);
		}
	}

	async deleteAllSMS(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CMGD=1,4', prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Deleting all SMS messages failed!`);
		}
	}

	async deleteSMS(id: number, prio = false) {
		const response = await simplifyResponse(this.executeATCommand(`AT+CMGD=${id}`, prio));

		if (resultCode(response) !== 'OK') {
			throw new Error(`serialport-gsm/${this.port.path}: Deleting SMS message failed!`);
		}
	}

	async deleteMessage(message: PduSms | TxtSms, prio = false) {
		if (!message.pdu || message.concatenatedMessages === undefined || !this.options.enableConcatenation) {
			try {
				await this.deleteSMS(message.index);
				return { deleted: [message.index], failed: [] };
			} catch (e) {
				return { deleted: [], failed: [message.index] };
			}
		}

		const indexes = message.concatenatedMessages.sort((a, b) => b - a);
		const deleted: number[] = [];
		const failed: number[] = [];

		for (const id of indexes) {
			try {
				await this.deleteSMS(id, prio);
				deleted.push(id);
			} catch (e) {
				failed.push(id);
			}
		}

		return { deleted, failed };
	}

	async getSimInbox(prio = false) {
		const reponse = await this.executeATCommand(this.mode === 'PDU' ? 'AT+CMGL=4' : 'AT+CMGL="ALL"', prio);

		if (resultCode(reponse.pop() || '') !== 'OK' || reponse.length % 2 !== 0) {
			throw new Error(`serialport-gsm/${this.port.path}: Reading the SMS inbox failed!`);
		}

		let preInformation;
		const result: (PduSms | TxtSms)[] = [];

		for (const [i, part] of reponse.entries()) {
			if (i % 2 === 0 && part.toUpperCase().startsWith('+CMGL:')) {
				const splitedPart = part.split(',');

				if (!isNaN(Number(splitedPart[1]))) {
					preInformation = {
						index: parseInt(splitedPart[0].replace('+CMGL: ', ''), 10),
						status: parseInt(splitedPart[1], 10)
					};

					continue;
				}

				preInformation = {
					index: parseInt(splitedPart[0].replace('+CMGL: ', ''), 10),
					status: parseInt(splitedPart[1].replace('"', ''), 10),
					sender: splitedPart[2].replace('"', ''),
					timestamp: splitedPart[4].replace('"', '') + ', ' + splitedPart[5].replace('"', '')
				};

				continue;
			}

			if (i % 2 === 1 && preInformation && /[0-9A-Fa-f]{15}/g.test(part)) {
				// read PDU mode message
				const pduMessage = pdu.parse(part);

				result.push({
					index: preInformation.index,
					status: preInformation.status,
					sender: pduMessage.address.phone || undefined,
					message: pduMessage instanceof pdu.Report ? '' : pduMessage.data.getText(),
					timestamp: pduMessage instanceof pdu.Deliver ? pduMessage.serviceCenterTimeStamp.getIsoString() : undefined,
					pdu: pduMessage
				});

				continue;
			}

			if (i % 2 === 1 && preInformation && part.length > 0 && isNaN(preInformation.status)) {
				// read SMS mode message

				if (result[result.length - 1]?.index === preInformation.index) {
					result[result.length - 1].message += `\n${part}`;
					continue;
				}

				result.push({
					index: preInformation.index,
					status: preInformation.status,
					sender: preInformation.sender,
					timestamp: preInformation.timestamp,
					message: part
				});

				continue;
			}
		}

		if (this.options.enableConcatenation) {
			const pduSms = new Map<number, PduSms>();
			const notConnectable = [];

			for (const item of result) {
				if (item.pdu === undefined || item.pdu instanceof pdu.Report) {
					notConnectable.push(item);
					continue;
				}

				const pointer = item.pdu.data.parts[0]?.header?.getPointer();

				if (!pointer) {
					continue;
				}

				const existingReference = pduSms.get(pointer);

				if (!existingReference || existingReference.pdu instanceof pdu.Report) {
					pduSms.set(pointer, item);
					continue;
				}

				existingReference.pdu.data.append(item.pdu);

				pduSms.set(
					pointer,
					Object.assign(existingReference, {
						message: existingReference.pdu.data.getText(),
						concatenatedMessages: [...(existingReference.concatenatedMessages || []), item.index]
					})
				);
			}

			return [...Array.from(pduSms.values()), ...notConnectable];
		}

		return result;
	}

	/*
	 * bind the events
	 */

	on = this.events.on.bind(this.events);
	once = this.events.once.bind(this.events);
	removeListener = this.events.removeListener.bind(this.events);
}
