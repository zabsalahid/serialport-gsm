import { EventEmitter } from 'events';
import { CommandResponse, OnIncomingCall, OnIncomingUSSD, SendSmsFailed, SendSmsSuccess, SimMemoryInformation } from './types';

export class Events extends EventEmitter {
	constructor() {
		super();
		this.setMaxListeners(50);
	}

	emit<T extends keyof EventTypes>(event: T, ...parameters: Parameters<EventTypes[T]>) {
		return super.emit(event, ...parameters);
	}

	on<T extends keyof EventTypes>(event: T, listener: EventTypes[T]) {
		return super.on(event, listener);
	}

	once<T extends keyof EventTypes>(event: T, listener: EventTypes[T]) {
		return super.once(event, listener);
	}
}

export type EventTypes = {
	/**
	 * Event triggered when the modem is successfully opened.
	 */
	onOpen: () => void;

	/**
	 * Event triggered when the modem is successfully closed.
	 */
	onClose: () => void;

	/**
	 * Event triggered when the modem is successfully initialized.
	 */
	onInitialized: () => void;

	/**
	 * Event triggered when an SMS is successfully sent.
	 * @param data The successfully sent SMS.
	 */
	onSmsSent: (data: SendSmsSuccess) => void;

	/**
	 * Event triggered when an attempt to send an SMS fails.
	 * @param data The failed SMS.
	 */
	onSmsSentFailed: (data: SendSmsFailed) => void;

	/**
	 * Event triggered when data is written to the modem.
	 * @param data The data written to the modem.
	 */
	onWriteToModem: (data: string) => void;

	/**
	 * Event triggered when data is received from the modem.
	 * @param data The data received from the modem.
	 */
	onDataReceived: (data: string) => void;

	/**
	 * Event triggered when a new SMS is received.
	 * @param id The id of the received SMS.
	 */
	onNewSms: (id: number) => void;

	/**
	 * Event triggered when a command response is received from the modem.
	 * @param data The response received from the modem after executing a command.
	 */
	onCommandResponse: (data: CommandResponse) => void;

	/**
	 * Event triggered when a new incoming call is detected.
	 * @param data Information about the incoming call.
	 */
	onNewIncomingCall: (data: OnIncomingCall) => void;

	/**
	 * Event triggered when a new incoming USSD message is detected.
	 * @param data Information about the incoming USSD message.
	 */
	onNewIncomingUSSD: (data: OnIncomingUSSD) => void;

	/**
	 * Event triggered when the modem reports that the memory is full.
	 * @param data Information about the SIM memory usage.
	 */
	onMemoryFull: (data: SimMemoryInformation) => void;
};
