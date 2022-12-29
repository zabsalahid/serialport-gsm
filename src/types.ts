import { Deliver, Report, Submit } from './lib/node-pdu/index';

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
export type IncomingCall = { phoneNumber: string; scheme: string };
export type IncomingUSSD = { text?: string; follow?: string; followCode?: number };

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

/**
 * @see https://serialport.io/docs/api-bindings-cpp#open
 */
export type SerialPortOptions = SerialPortOpenOptions<AutoDetectTypes>;
