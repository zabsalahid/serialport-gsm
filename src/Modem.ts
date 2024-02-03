import { Deliver, Report, Submit, parse as parsePdu, utils as pduUtils } from 'node-pdu';
import { Command } from './utils/Command';
import { CommandHandler } from './utils/CommandHandler';
import { Communicator } from './utils/Communicator';
import { EventTypes, Events } from './utils/Events';
import { CommandResponse, ModemOptions, PduSms, SendSmsFailed, SendSmsSuccess, SimMemoryInformation } from './utils/types';
import { CmdStack, ModemError, ModemMode, resultCode, simplifyResponse } from './utils/utils';

export class Modem {
	// options
	private readonly options: ModemOptions;

	// system
	private readonly communicator: Communicator;
	private readonly events = new Events();
	private readonly cmdHandler: CommandHandler;

	constructor(communicator: Communicator, options: Partial<ModemOptions> = {}) {
		this.options = {
			pinCode: options.pinCode ?? null,
			deleteSmsOnReceive: options.deleteSmsOnReceive ?? false,
			enableConcatenation: options.enableConcatenation ?? true,
			customInitCommand: options.customInitCommand ?? null,
			autoInitOnOpen: options.autoInitOnOpen ?? true,
			cnmiCommand: options.cnmiCommand ?? 'AT+CNMI=2,1,0,2,1'
		};

		this.communicator = communicator;
		this.cmdHandler = new CommandHandler(this, this.communicator, this.events);

		this.on('onNewSms', (id) => this.options.deleteSmsOnReceive && this.deleteSms(id).catch());
	}

	/*
	 * ================================================
	 *                      Getter
	 * ================================================
	 */

	/**
	 * A getter method to retrieve a unique identifier for the modem device.
	 *
	 * @returns A string that represents the unique device identifier.
	 */
	get device() {
		return `${this.communicator.constructor.name}-${this.communicator.deviceIndentifier}`;
	}

	/**
	 * Checks whether the modem is currently open and connected. This can be used to verify
	 * the connection status before attempting to send commands or messages.
	 *
	 * @returns True if the modem is connected, otherwise false.
	 */
	get isOpen() {
		return this.communicator.isConnected;
	}

	/**
	 * Retrieves the total length of the command queue.
	 *
	 * @returns The total number of commands currently queued for execution.
	 */
	get queueLength() {
		return this.cmdHandler.prioQueue.length + this.cmdHandler.queue.length;
	}

	/*
	 * ================================================
	 *                Private functions
	 * ================================================
	 */

	/**
	 * Checks if the modem requires a PIN for operation.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @returns True if a PIN is required, false otherwise.
	 */
	private async checkPinRequired(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CPIN?', prio));

		if (!response.toUpperCase().startsWith('+CPIN:') || response.toUpperCase().includes('ERROR')) {
			throw new ModemError(this, 'Failed to detect if the modem requires a pin!');
		}

		return !response.toUpperCase().includes('READY');
	}

	/**
	 * Enables the Caller Line Identification Presentation (CLIP) feature on the modem, allowing
	 * the modem to present the caller's number when receiving a call.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	private async enableClip(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CLIP=1', prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Modem clip can not be activated!');
		}
	}

	/**
	 * Configures the modem to notify the host when new SMS messages are received,
	 * using the CNMI (New SMS Message Indications) setting.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	private async enableCNMI(prio = false) {
		const response = await simplifyResponse(this.executeATCommand(this.options.cnmiCommand, prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Failed to execute the cnmiCommand!');
		}
	}

	/**
	 * Sets the modem's echo mode. When enabled, the modem echoes characters received from the terminal.
	 *
	 * @param enable Whether to enable or disable echo mode.
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	private async setEchoMode(enable: boolean, prio = false) {
		const response = await simplifyResponse(this.executeATCommand(enable ? 'ATE1' : 'ATE0', prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Modem echo can not be activated!');
		}
	}

	/**
	 * Provides the SIM card's PIN to the modem, if required. This is necessary for unlocking the modem
	 * for use when a PIN code is set on the SIM card.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	private async providePin(prio = false) {
		if (!this.options.pinCode) {
			throw new ModemError(this, 'No pin was provided to unlock the modem!');
		}

		const response = await simplifyResponse(this.executeATCommand(`AT+CPIN=${this.options.pinCode}`, prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Modem could not be unlocked with pin!');
		}
	}

	/**
	 * Resets the modem to its factory settings. This is often used to ensure a clean state before
	 * configuring the modem for specific tasks.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	private async resetModem(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('ATZ', prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Modem failed to reset!');
		}
	}

	/**
	 * Sets the SMS message format of the modem. Modems support either PDU (Protocol Data Unit) or
	 * Text mode for sending and receiving SMS messages. This method configures the modem to use
	 * one of these formats.
	 *
	 * @param mode The SMS message format mode.
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	private async setMode(mode: ModemMode, prio = false) {
		const response = await simplifyResponse(this.executeATCommand(`AT+CMGF=${mode === ModemMode.PDU ? 0 : 1}`, prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'The setting of the mode failed!');
		}

		if (mode === ModemMode.PDU) {
			await this.enableCNMI(prio);
		}
	}

	/*
	 * ================================================
	 *                 Public functions
	 * ================================================
	 */

	/**
	 * Opens the connection to the modem and initiates the connection.
	 */
	async open() {
		if (this.communicator.isConnected) {
			return;
		}

		await this.communicator.connect();

		this.events.emit('onOpen');
		this.cmdHandler.startProcessing();

		if (this.options.autoInitOnOpen) {
			await this.initializeModem(true);
		}
	}

	/**
	 * Closes the connection to the modem. This method stops processing AT commands,
	 * disconnects the communicator interface.
	 */
	async close() {
		this.cmdHandler.stopProcessing();

		if (!this.communicator.isConnected) {
			return;
		}

		await this.communicator.disconnect();
		this.events.emit('onClose');
	}

	/**
	 * Executes a given AT command on the modem.
	 *
	 * @param command The AT command to be executed.
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @param cmdtimeout Optional timeout for the command execution.
	 *
	 * @returns A promise that resolves with the command response or rejects with an error.
	 */
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

	/**
	 * Initializes the modem with specified settings. This includes checking the modem's status,
	 * resetting it, setting echo mode, providing a PIN if required, executing a custom initialization
	 * command, setting the modem mode to PDU, and enabling caller identification.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	async initializeModem(prio = true) {
		await this.checkModem(prio);
		await this.resetModem(prio);
		await this.setEchoMode(true, prio);

		if (await this.checkPinRequired(prio)) {
			await this.providePin(prio);
		}

		const initCommand = this.options.customInitCommand !== null ? this.options.customInitCommand : 'AT+CMEE=1;+CREG=2';
		const response = await simplifyResponse(this.executeATCommand(initCommand, prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Initialization of the modem failed');
		}

		await this.setMode(ModemMode.PDU, prio);
		await this.enableClip(prio);

		this.events.emit('onInitialized');
	}

	/**
	 * Checks if the modem is responsive by sending a basic AT command.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @returns A promise that resolves if the modem responds correctly.
	 */
	async checkModem(prio = false): Promise<{ status: 'OK' }> {
		const response = await simplifyResponse(this.executeATCommand('AT', prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Check modem failed because the response from the modem was invalid!');
		}

		return { status: 'OK' };
	}

	/**
	 * Sends an SMS message to a specified number. Allows for sending flash SMS by setting the
	 * data coding scheme accordingly.
	 *
	 * @param number The recipient's phone number.
	 * @param message The text message to be sent.
	 * @param flashSms Whether the message should be sent as a flash SMS.
	 * @param prio Whether this action should be prioritised in the command queue.
	 *
	 * @returns A promise that resolves when the SMS has been sent.
	 */
	async sendSms(number: string, message: string, flashSms = false, prio = false) {
		const submit = new Submit(number, message);
		submit.dataCodingScheme.setUseMessageClass(flashSms);

		return await this.sendPdu(submit, prio);
	}

	/**
	 * Sends a PDU (Protocol Data Unit) formatted SMS using the provided PDU class.
	 *
	 * @param pdu The PDU object representing the SMS to be sent.
	 * @param prio Whether this action should be prioritised in the command queue.
	 *
	 * @returns A promise indicating the success of the SMS sending.
	 */
	async sendPdu<T extends Submit | Deliver>(pdu: T, prio = false) {
		const checkReponse = (response: CommandResponse | Error) => {
			if (response instanceof Error || resultCode(response.pop() || '') !== 'OK') {
				throw new ModemError(this, 'Failed to send SMS!');
			}
		};

		const cmdSequence: CmdStack = {
			cmds: pdu
				.getPartStrings()
				.flatMap((partString) => [
					new Command(`AT+CMGS=${partString.length / 2 - 1}`, 250, undefined, false),
					new Command(partString + '\x1a', 10000, checkReponse)
				]),
			cancelOnFailure: true
		};

		await new Promise((resolve: (success: true) => void, reject: (error: Error) => void) => {
			cmdSequence.onFinish = () => resolve(true);

			cmdSequence.onFailed = (error) => {
				const result: SendSmsFailed<T> = {
					success: false,
					data: {
						message: pdu.data.getText(),
						recipient:
							pdu.address.type.type === pduUtils.SCAType.TYPE_INTERNATIONAL && pdu.address.phone !== null
								? `+${pdu.address.phone}`
								: pdu.address.phone || '',
						alert: pdu.dataCodingScheme.useMessageClass,
						pdu: pdu
					},
					error
				};

				this.events.emit('onSmsSentFailed', result);
				reject(error);
			};

			this.cmdHandler.pushToQueue(cmdSequence, prio);
		});

		const result: SendSmsSuccess<T> = {
			success: true,
			data: {
				message: pdu.data.getText(),
				recipient:
					pdu.address.type.type === pduUtils.SCAType.TYPE_INTERNATIONAL && pdu.address.phone !== null
						? `+${pdu.address.phone}`
						: pdu.address.phone || '',
				alert: pdu.dataCodingScheme.useMessageClass,
				pdu: pdu
			}
		};

		this.events.emit('onSmsSent', result);
		return result;
	}

	/**
	 * Retrieves information about the current network signal strength and quality.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @returns A promise with an object containing signal quality and strength.
	 */
	async getSignalInfo(prio = false) {
		const response = await this.executeATCommand('AT+CSQ', prio);

		if (resultCode(response.pop() || '') !== 'OK') {
			throw new ModemError(this, 'The network signal could not be read!');
		}

		const signal = Number(response[0]?.match(/(\d+)(,\d+)?/g)?.[0]?.replace(',', '.') || NaN);

		if (isNaN(signal) || signal < 0 || signal > 31) {
			throw new ModemError(this, 'The signal strength could not be parsed!');
		}

		return {
			signalQuality: signal,
			signalStrength: 113 - signal * 2
		};
	}

	/**
	 * Retrieves information about the currently registered network.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @returns A promise with an object containing network information.
	 */
	async getRegisteredNetwork(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+COPS?', prio));

		if (!response.toUpperCase().startsWith('+COPS: ') || response.toUpperCase().includes('ERROR')) {
			throw new ModemError(this, 'The network signal could not be read!');
		}

		const splitedResponse = response.substring(7).split(',');
		const format = splitedResponse[1];
		const data = splitedResponse[2];

		return {
			mode: splitedResponse[0],
			name: data?.length > 0 && format === '0' ? data.replace(/"/g, '') : undefined,
			shortName: data?.length > 0 && format === '1' ? data.replace(/"/g, '') : undefined,
			numeric: data?.length > 0 && format === '2' ? data.replace(/"/g, '') : undefined
		};
	}

	/**
	 * Retrieves a list of available networks that the modem can see at the moment.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @returns A promise that resolves with a list of available networks.
	 */
	async getAvailableNetworks(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+COPS=?', prio, 60000));

		if (!response.toUpperCase().startsWith('+COPS: ') || response.toUpperCase().includes('ERROR')) {
			throw new ModemError(this, 'The network signal could not be read!');
		}

		const result = [];

		for (const signal of response?.match(/\((\d,".*?")\)(?!")/g) || []) {
			const data = signal.substring(1, signal.length - 2).split(',');

			const name = data[1]?.replace(/"/g, '');
			const shortName = data[2]?.replace(/"/g, '');
			const numeric = data[3]?.replace(/"/g, '');

			result.push({
				status: data[0],
				name: name || '',
				shortName: shortName !== undefined && shortName.length > 0 ? shortName : undefined,
				numeric: numeric !== undefined && numeric.length > 0 ? numeric : undefined
			});
		}

		return result;
	}

	/**
	 * Checks the SIM card memory usage for stored SMS messages.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @returns A promise that resolves with the SIM memory usage information.
	 */
	async checkSimMemory(prio = false): Promise<SimMemoryInformation> {
		const response = await this.executeATCommand('AT+CPMS="SM"', prio);

		if (resultCode(response.pop() || '') !== 'OK') {
			throw new ModemError(this, 'The required memory space of the SMS, could not be read!');
		}

		const used = Number(response[0]?.match(/\d+/g)?.[0] || NaN);
		const total = Number(response[0]?.match(/\d+/g)?.[1] || NaN);

		if (isNaN(used) || isNaN(total)) {
			throw new ModemError(this, 'The required memory space of the SMS, could not be parsed!');
		}

		const result = { used, total };

		if (result.used >= result.total) {
			this.events.emit('onMemoryFull', result);
		}

		return result;
	}

	/**
	 * Selects the phone book storage to be used for subsequent operations.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	async selectPhonebookStorage(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CPBS="ON"', prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'The storage of the phone book could not be selected!');
		}
	}

	/**
	 * Writes an entry to the phone book storage.
	 *
	 * @param phoneNumber The phone number to store.
	 * @param name The name associated with the phone number.
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	async writeToPhonebook(phoneNumber: string, name: string, prio = false) {
		const response = await simplifyResponse(this.executeATCommand(`AT+CPBW=1,"${phoneNumber}",129,"${name}"`, prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'The entry could not be written in the phone book!');
		}
	}

	/**
	 * Sets the own phone number in the modem's phone book storage.
	 * This method first selects the phone book storage and then writes the provided phone number and name into it.
	 *
	 * @param phoneNumber The phone number to set as the own number.
	 * @param name The name associated with the phone number, defaults to 'OwnNumber'.
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	async setOwnPhoneNumber(phoneNumber: string, name = 'OwnNumber', prio = false) {
		await this.selectPhonebookStorage(prio);
		await this.writeToPhonebook(phoneNumber, name, prio);
	}

	/**
	 * Retrieves the product serial number of the modem.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @returns A promise that resolves with the modem's serial number.
	 */
	async getProductSerialNumber(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CGSN', prio));

		if (!/^\d+$/.test(response) || response.toUpperCase().includes('ERROR')) {
			throw new ModemError(this, 'Cannot read the serial number of the modem!');
		}

		return response;
	}

	/**
	 * Retrieves the own phone number stored in the modem.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @returns A promise that resolves with the name and phone number.
	 */
	async getOwnNumber(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CNUM', prio));

		if (!response.toUpperCase().startsWith('+CNUM') || response.toUpperCase().includes('ERROR')) {
			throw new ModemError(this, 'The own phone number could not be read!');
		}

		const regExp = /"(.*?)"/g;
		const splitedResponse = response.split(',');

		const name = regExp.exec(splitedResponse[0] || '')?.[1];
		const phoneNumber = regExp.exec(splitedResponse[1] || '')?.[1];

		if (name === undefined || phoneNumber === undefined) {
			throw new ModemError(this, 'The own phone number could not be parsed!');
		}

		return { name, phoneNumber };
	}

	/**
	 * Hangs up the current call. Sends an ATH command to the modem to terminate the ongoing call.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	async hangupCall(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('ATH', prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'The hang up of the call failed!');
		}
	}

	/**
	 * Sends a USSD command to the modem for execution.
	 *
	 * @param command The USSD command to be executed.
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	async sendUSSD(command: string, prio = false) {
		const response = await simplifyResponse(this.executeATCommand(`AT+CUSD=1,"${command}",15`, prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Execution USSD failed failed!');
		}
	}

	/**
	 * Deletes all SMS messages stored on the modem.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	async deleteAllSms(prio = false) {
		const response = await simplifyResponse(this.executeATCommand('AT+CMGD=1,4', prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Deleting all SMS messages failed!');
		}
	}

	/**
	 * Deletes a specific SMS message by its index.
	 *
	 * @param id The index of the SMS message to be deleted.
	 * @param prio Whether this action should be prioritised in the command queue.
	 */
	async deleteSms(id: number, prio = false) {
		const response = await simplifyResponse(this.executeATCommand(`AT+CMGD=${id}`, prio));

		if (resultCode(response) !== 'OK') {
			throw new ModemError(this, 'Deleting SMS message failed!');
		}
	}

	/**
	 * Deletes a specified SMS message and its referenced messages.
	 * This method is designed to delete both the specified SMS message and any referenced messages.
	 *
	 * @param message The SMS message to be deleted along with its referenced messages.
	 * @param prio Whether this action should be prioritised in the command queue.
	 *
	 * @returns A promise that resolves a object containing arrays of deleted and failed message indexes.
	 */
	async deleteMessage(message: PduSms, prio = false) {
		const indexes = message.referencedSmsIDs?.sort((a, b) => b - a) || [message.index];
		const deleted: number[] = [];
		const failed: number[] = [];

		for (const id of indexes) {
			try {
				await this.deleteSms(id, prio);
				deleted.push(id);
			} catch (e) {
				failed.push(id);
			}
		}

		return { deleted, failed };
	}

	/**
	 * Reads an SMS message by its index.
	 *
	 * @param id The index of the SMS message to be read.
	 * @param prio Whether this action should be prioritised in the command queue.
	 *
	 * @returns A promise that resolves with the parsed SMS message.
	 */
	async readSmsById(id: number, prio = false): Promise<PduSms> {
		const reponse = await this.executeATCommand(`AT+CMGR=${id}`, prio);

		if (resultCode(reponse.pop() || '') !== 'OK' || reponse.length % 2 !== 0) {
			throw new ModemError(this, `Reading the SMS (${id}) failed!`);
		}

		let preInformation;

		for (const part of reponse) {
			if (part.toUpperCase().startsWith('+CMGR:')) {
				const splitedPart = part.split(',');

				if (!isNaN(Number(splitedPart[1]))) {
					preInformation = {
						index: Number(splitedPart[0].substring(7)),
						status: Number(splitedPart[1])
					};

					continue;
				}

				preInformation = {
					index: Number(splitedPart[0].substring(7)),
					status: Number(splitedPart[1].replace(/"/g, '')),
					sender: splitedPart[2].replace(/"/g, ''),
					timestamp: splitedPart[4].replace(/"/g, '') + ', ' + splitedPart[5].replace(/"/g, '')
				};

				continue;
			}

			if (preInformation && /[0-9A-Fa-f]{15}/g.test(part)) {
				const pduMessage = parsePdu(part);

				return {
					index: preInformation.index,
					status: preInformation.status,
					sender: pduMessage.address.phone || undefined,
					message: pduMessage instanceof Report ? '' : pduMessage.data.getText(),
					timestamp: pduMessage instanceof Deliver ? pduMessage.serviceCenterTimeStamp.getIsoString() : undefined,
					pdu: pduMessage
				};
			}
		}

		throw new ModemError(this, `Reading the SMS (${id}) failed!`);
	}

	/**
	 * Retrieves the SMS inbox from the SIM card.
	 * It constructs an array of PduSms objects representing the messages in the inbox.
	 * If message concatenation is enabled, it combines concatenated messages into a single PduSms object.
	 *
	 * @param prio Whether this action should be prioritised in the command queue.
	 * @returns A promise that resolves with an array of PduSms objects representing SMS messages in the inbox.
	 */
	async getSimInbox(prio = false) {
		const reponse = await this.executeATCommand('AT+CMGL=4', prio);

		if (resultCode(reponse.pop() || '') !== 'OK' || reponse.length % 2 !== 0) {
			throw new ModemError(this, 'Reading the SMS inbox failed!');
		}

		let preInformation;
		const result: PduSms[] = [];

		for (const part of reponse) {
			if (part.toUpperCase().startsWith('+CMGL:')) {
				const splitedPart = part.split(',');

				if (!isNaN(Number(splitedPart[1]))) {
					preInformation = {
						index: Number(splitedPart[0].substring(7)),
						status: Number(splitedPart[1])
					};

					continue;
				}

				preInformation = {
					index: Number(splitedPart[0].substring(7)),
					status: Number(splitedPart[1].replace(/"/g, '')),
					sender: splitedPart[2].replace(/"/g, ''),
					timestamp: splitedPart[4].replace(/"/g, '') + ', ' + splitedPart[5].replace(/"/g, '')
				};

				continue;
			}

			if (preInformation && /[0-9A-Fa-f]{15}/g.test(part)) {
				const pduMessage = parsePdu(part);

				result.push({
					index: preInformation.index,
					status: preInformation.status,
					sender: pduMessage.address.phone || undefined,
					message: pduMessage instanceof Report ? '' : pduMessage.data.getText(),
					timestamp: pduMessage instanceof Deliver ? pduMessage.serviceCenterTimeStamp.getIsoString() : undefined,
					pdu: pduMessage
				});

				continue;
			}
		}

		if (this.options.enableConcatenation) {
			const pduSms = new Map<number, PduSms>();
			const notConnectable = [];

			for (const item of result) {
				if (item.pdu instanceof Report) {
					notConnectable.push(item);
					continue;
				}

				const pointer = item.pdu.data.parts[0]?.header?.getPointer();

				if (!pointer) {
					continue;
				}

				const existingReference = pduSms.get(pointer);

				if (!existingReference || existingReference.pdu instanceof Report) {
					pduSms.set(pointer, item);
					continue;
				}

				existingReference.pdu.data.append(item.pdu);

				pduSms.set(
					pointer,
					Object.assign(existingReference, {
						message: existingReference.pdu.data.getText(),
						referencedSmsIDs: [...(existingReference.referencedSmsIDs || []), item.index]
					})
				);
			}

			return [...Array.from(pduSms.values()), ...notConnectable];
		}

		return result;
	}

	/*
	 * ================================================
	 *                     Events
	 * ================================================
	 */

	on<T extends keyof EventTypes>(eventName: T, listener: EventTypes[T]) {
		this.events.on(eventName, listener);
	}

	once<T extends keyof EventTypes>(eventName: T, listener: EventTypes[T]) {
		this.events.once(eventName, listener);
	}

	removeListener(eventName: keyof EventTypes, listener: (...args: unknown[]) => void) {
		this.events.removeListener(eventName, listener);
	}
}
