import { EventEmitter } from 'events';
import { CommandResponse, OnIncomingCall, OnIncomingUSSD, SendSmsFailed, SendSmsSuccess, SimMemoryInformation } from '../types';

export interface EventTypes {
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

export declare interface Events {
	emit<T extends keyof EventTypes>(event: T, ...parameters: Parameters<EventTypes[T]>): boolean;
	on<T extends keyof EventTypes>(event: T, listener: EventTypes[T]): this;
	once<T extends keyof EventTypes>(event: T, listener: EventTypes[T]): this;
}

export class Events extends EventEmitter {
	constructor() {
		super();
		this.setMaxListeners(50);
	}
}
