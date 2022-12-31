import { Deliver, Report, Submit } from '@killerjulian/node-pdu';

/*
 * public types
 */

// ConstructorOptions

export interface ModemConstructorOptions {
	pin?: string;
	autoDeleteOnReceive?: boolean;
	enableConcatenation?: boolean;
	customInitCommand?: string;
	autoInitOnOpen?: boolean;
	cnmiCommand?: string;
	serialPortOptions?: SerialPortOptions;
}

// public function types and event types

export type CommandResponse = string[];
export type OnIncomingCall = { phoneNumber: string; scheme: string };
export type OnIncomingUSSD = { text?: string; follow?: string; followCode?: number };
export type OnMemoryFull = { used: number; total: number };

export interface SendSMSSuccess {
	success: true;
	messageID: string;
	data: {
		message: string;
		recipient: string;
		alert: boolean;
		pdu: Submit;
	};
}

export interface SendSMSFailed {
	success: false;
	messageID: string;
	error: Error;
}

export interface PduSms {
	index: number;
	status: number;
	sender?: string;
	message: string;
	timestamp?: string;
	pdu: Deliver | Report | Submit;
	concatenatedMessages?: number[];
}

// SerialPortOptions

import { AutoDetectTypes } from '@serialport/bindings-cpp';
import { SerialPortOpenOptions } from 'serialport/dist/index';
export type SerialPortOptions = SerialPortOpenOptions<AutoDetectTypes>;
