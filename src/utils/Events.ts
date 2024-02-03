import { EventEmitter } from 'events';
import { CommandResponse, OnIncomingCall, OnIncomingUSSD, SendSmsFailed, SendSmsSuccess, SimMemoryInformation } from '../types';

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
	onOpen: () => void;
	onClose: () => void;
	onInitialized: () => void;
	onSmsSent: (data: SendSmsSuccess) => void;
	onSmsSentFailed: (data: SendSmsFailed) => void;
	onWriteToModem: (data: string) => void;
	onDataReceived: (data: string) => void;
	onNewSms: (id: number) => void;
	onCommandResponse: (data: CommandResponse) => void;
	onNewIncomingCall: (data: OnIncomingCall) => void;
	onNewIncomingUSSD: (data: OnIncomingUSSD) => void;
	onMemoryFull: (data: SimMemoryInformation) => void;
}


