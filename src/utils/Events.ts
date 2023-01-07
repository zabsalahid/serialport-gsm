import { EventEmitter } from 'events';
import { CommandResponse, OnIncomingCall, OnIncomingUSSD, SendSmsFailed, SendSmsSuccess, SimMemoryInformation } from '../types';

export declare interface Events {
	emit(event: 'onOpen'): boolean;
	emit(event: 'onClose'): boolean;
	emit(event: 'onInitialized'): boolean;
	emit(event: 'onSmsSent', data: SendSmsSuccess): boolean;
	emit(event: 'onSmsSentFailed', data: SendSmsFailed): boolean;
	emit(event: 'onWriteToModem', data: string): boolean;
	emit(event: 'onDataReceived', data: string): boolean;
	emit(event: 'onNewSms', id: number): boolean;
	emit(event: 'onCommandResponse', data: CommandResponse): boolean;
	emit(event: 'onNewIncomingCall', data: OnIncomingCall): boolean;
	emit(event: 'onNewIncomingUSSD', data: OnIncomingUSSD): boolean;
	emit(event: 'onMemoryFull', data: SimMemoryInformation): boolean;

	on(event: 'onOpen', listener: () => void): this;
	on(event: 'onClose', listener: () => void): this;
	on(event: 'onInitialized', listener: () => void): this;
	on(event: 'onSmsSent', listener: (data: SendSmsSuccess) => void): this;
	on(event: 'onSmsSentFailed', listener: (data: SendSmsFailed) => void): this;
	on(event: 'onWriteToModem', listener: (data: string) => void): this;
	on(event: 'onDataReceived', listener: (data: string) => void): this;
	on(event: 'onNewSms', listener: (id: number) => void): this;
	on(event: 'onCommandResponse', listener: (data: CommandResponse) => void): this;
	on(event: 'onNewIncomingCall', listener: (data: OnIncomingCall) => void): this;
	on(event: 'onNewIncomingUSSD', listener: (data: OnIncomingUSSD) => void): this;
	on(event: 'onMemoryFull', listener: (data: SimMemoryInformation) => void): this;

	once(event: 'onOpen', listener: () => void): this;
	once(event: 'onClose', listener: () => void): this;
	once(event: 'onInitialized', listener: () => void): this;
	once(event: 'onSmsSent', listener: (data: SendSmsSuccess) => void): this;
	once(event: 'onSmsSentFailed', listener: (data: SendSmsFailed) => void): this;
	once(event: 'onWriteToModem', listener: (data: string) => void): this;
	once(event: 'onDataReceived', listener: (data: string) => void): this;
	once(event: 'onNewSms', listener: (id: number) => void): this;
	once(event: 'onCommandResponse', listener: (data: CommandResponse) => void): this;
	once(event: 'onNewIncomingCall', listener: (data: OnIncomingCall) => void): this;
	once(event: 'onNewIncomingUSSD', listener: (data: OnIncomingUSSD) => void): this;
	once(event: 'onMemoryFull', listener: (data: SimMemoryInformation) => void): this;

	removeListener(...params: Parameters<EventEmitter['removeListener']>): this;
}

export class Events extends EventEmitter {
	constructor() {
		super();
		this.setMaxListeners(0);
	}
}
