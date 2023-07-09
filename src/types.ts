import { Deliver, Report, Submit } from 'node-pdu';

/*
 * Modem options
 */

export interface ModemOptions {
	pinCode: string | null;
	deleteSmsOnReceive: boolean;
	enableConcatenation: boolean;
	customInitCommand: string | null;
	autoInitOnOpen: boolean;
	cnmiCommand: string;
}

/*
 * Public function types and event types
 */

export { EventTypes } from './utils/Events';

export type CommandResponse = string[];
export type OnIncomingCall = { phoneNumber: string; scheme: string };
export type OnIncomingUSSD = { text?: string; follow?: string; followCode?: number };

export interface SimMemoryInformation {
	used: number;
	total: number;
}

export interface SendSmsSuccess<T extends Deliver | Submit = Deliver | Submit> {
	success: true;
	data: {
		message: string;
		recipient: string;
		alert: boolean;
		pdu: T;
	};
}

export interface SendSmsFailed<T extends Deliver | Submit = Deliver | Submit> {
	success: false;
	data: {
		message: string;
		recipient: string;
		alert: boolean;
		pdu: T;
	};
	error: Error;
}

export interface PduSms {
	index: number;
	status: number;
	sender?: string;
	message: string;
	timestamp?: string;
	pdu: Deliver | Report | Submit;
	referencedSmsIDs?: number[];
}

/*
 * Types to build your own `Communicator`
 */

export { Communicator } from './utils/Communicator';
