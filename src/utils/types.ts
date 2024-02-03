import { Deliver, Report, Submit } from 'node-pdu';

/*
 * Modem options
 */

export type ModemOptions = {
	pinCode: string | null;
	deleteSmsOnReceive: boolean;
	enableConcatenation: boolean;
	customInitCommand: string | null;
	autoInitOnOpen: boolean;
	cnmiCommand: string;
};

/*
 * Public function types and event types
 */

export { EventTypes } from './Events';

export type CommandResponse = string[];
export type OnIncomingCall = { phoneNumber: string; scheme: string };
export type OnIncomingUSSD = { text?: string; follow?: string; followCode?: number };

export type SimMemoryInformation = {
	used: number;
	total: number;
};

export type SendSmsSuccess<T extends Deliver | Submit = Deliver | Submit> = {
	success: true;
	data: {
		message: string;
		recipient: string;
		alert: boolean;
		pdu: T;
	};
};

export type SendSmsFailed<T extends Deliver | Submit = Deliver | Submit> = {
	success: false;
	data: {
		message: string;
		recipient: string;
		alert: boolean;
		pdu: T;
	};
	error: Error;
};

export type PduSms = {
	index: number;
	status: number;
	sender?: string;
	message: string;
	timestamp?: string;
	pdu: Deliver | Report | Submit;
	referencedSmsIDs?: number[];
};

/*
 * Types to build your own `Communicator`
 */

export { Communicator } from './Communicator';
