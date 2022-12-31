import { EventEmitter } from 'events';
import { CommandResponse, OnIncomingCall, OnIncomingUSSD, OnMemoryFull, SendSMSFailed, SendSMSSuccess } from '../types';

export declare interface Events {
	emit(event: 'onOpen'): boolean;
	emit(event: 'onClose'): boolean;
	emit(event: 'onInitialized'): boolean;
	emit(event: 'onSMSsent', data: SendSMSSuccess): boolean;
	emit(event: 'onSMSsentFailed', data: SendSMSFailed): boolean;
	emit(event: 'onWriteToModem', data: string): boolean;
	emit(event: 'onDataReceived', data: string): boolean;
	emit(event: 'onNewSMS', id: number): boolean;
	emit(event: 'onCommandResponse', data: CommandResponse): boolean;
	emit(event: 'onNewIncomingCall', data: OnIncomingCall): boolean;
	emit(event: 'onNewIncomingUSSD', data: OnIncomingUSSD): boolean;
	emit(event: 'onMemoryFull', data: OnMemoryFull): boolean;

	on(event: 'onOpen', listener: () => void): this;
	on(event: 'onClose', listener: () => void): this;
	on(event: 'onInitialized', listener: () => void): this;
	on(event: 'onSMSsent', listener: (data: SendSMSSuccess) => void): this;
	on(event: 'onSMSsentFailed', listener: (data: SendSMSFailed) => void): this;
	on(event: 'onWriteToModem', listener: (data: string) => void): this;
	on(event: 'onDataReceived', listener: (data: string) => void): this;
	on(event: 'onNewSMS', listener: (id: number) => void): this;
	on(event: 'onCommandResponse', listener: (data: CommandResponse) => void): this;
	on(event: 'onNewIncomingCall', listener: (data: OnIncomingCall) => void): this;
	on(event: 'onNewIncomingUSSD', listener: (data: OnIncomingUSSD) => void): this;
	on(event: 'onMemoryFull', listener: (data: OnMemoryFull) => void): this;

	once(event: 'onOpen', listener: () => void): this;
	once(event: 'onClose', listener: () => void): this;
	once(event: 'onInitialized', listener: () => void): this;
	once(event: 'onSMSsent', listener: (data: SendSMSSuccess) => void): this;
	once(event: 'onSMSsentFailed', listener: (data: SendSMSFailed) => void): this;
	once(event: 'onWriteToModem', listener: (data: string) => void): this;
	once(event: 'onDataReceived', listener: (data: string) => void): this;
	once(event: 'onNewSMS', listener: (id: number) => void): this;
	once(event: 'onCommandResponse', listener: (data: CommandResponse) => void): this;
	once(event: 'onNewIncomingCall', listener: (data: OnIncomingCall) => void): this;
	once(event: 'onNewIncomingUSSD', listener: (data: OnIncomingUSSD) => void): this;
	once(event: 'onMemoryFull', listener: (data: OnMemoryFull) => void): this;

	removeListener(...params: Parameters<EventEmitter['removeListener']>): this;
}

export class Events extends EventEmitter {
	constructor() {
		super();
		this.setMaxListeners(0);
	}
}
