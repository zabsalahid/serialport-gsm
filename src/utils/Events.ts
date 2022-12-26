import { EventEmitter } from 'events';
import { CommandResponse, IncomingCall, IncomingUSSD, SendSMSFailed, SendSMSSuccess } from '../types';

export declare interface Events {
	emit(event: 'onOpen'): boolean;
	emit(event: 'onClose'): boolean;
	emit(event: 'onInitialized'): boolean;
	emit(event: 'onSMSsent', data: SendSMSSuccess): boolean;
	emit(event: 'onSMSsentFailed', data: SendSMSFailed): boolean;
	emit(event: 'onWriteToModem', data: string): boolean;
	emit(event: 'onDataReceived', data: string): boolean;
	emit(event: 'onNewSMS', id: number): boolean;
	emit(event: 'onNewIncomingCall', data: IncomingCall): boolean;
	emit(event: 'onNewIncomingUSSD', data: IncomingUSSD): boolean;
	emit(event: 'onCommandResponse', data: CommandResponse): boolean;
	emit(event: 'onMemoryFull', data: { used: number; total: number }): boolean;

	on(event: 'onOpen', listener: () => void): this;
	on(event: 'onClose', listener: () => void): this;
	on(event: 'onInitialized', listener: () => void): this;
	on(event: 'onSMSsent', listener: (data: SendSMSSuccess) => void): this;
	on(event: 'onSMSsentFailed', listener: (data: SendSMSFailed) => void): this;
	on(event: 'onWriteToModem', listener: (data: string) => void): this;
	on(event: 'onDataReceived', listener: (data: string) => void): this;
	on(event: 'onNewSMS', listener: (id: number) => void): this;
	on(event: 'onNewIncomingCall', listener: (data: IncomingCall) => void): this;
	on(event: 'onNewIncomingUSSD', listener: (data: IncomingUSSD) => void): this;
	on(event: 'onCommandResponse', listener: (data: CommandResponse) => void): this;
	on(event: 'onMemoryFull', listener: (data: { used: number; total: number }) => void): this;

	once(event: 'onOpen', listener: () => void): this;
	once(event: 'onClose', listener: () => void): this;
	once(event: 'onInitialized', listener: () => void): this;
	once(event: 'onSMSsent', listener: (data: SendSMSSuccess) => void): this;
	once(event: 'onSMSsentFailed', listener: (data: SendSMSFailed) => void): this;
	once(event: 'onWriteToModem', listener: (data: string) => void): this;
	once(event: 'onDataReceived', listener: (data: string) => void): this;
	once(event: 'onNewSMS', listener: (id: number) => void): this;
	once(event: 'onNewIncomingCall', listener: (data: IncomingCall) => void): this;
	once(event: 'onNewIncomingUSSD', listener: (data: IncomingUSSD) => void): this;
	once(event: 'onCommandResponse', listener: (data: CommandResponse) => void): this;
	once(event: 'onMemoryFull', listener: (data: { used: number; total: number }) => void): this;
}

export class Events extends EventEmitter {
	constructor() {
		super();
		this.setMaxListeners(0);
	}
}

