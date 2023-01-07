import { Deliver, Report, Submit } from '@killerjulian/node-pdu';

/*
 * public types
 */

// ConstructorOptions

export interface ModemConstructorOptions {
	pin?: string;
	deleteSmsOnReceive?: boolean;
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

export interface SimMemoryInformation {
	used: number;
	total: number;
}

export interface SendSmsSuccess {
	success: true;
	data: {
		message: string;
		recipient: string;
		alert: boolean;
		pdu: Submit;
	};
}

export interface SendSmsFailed {
	success: false;
	data: {
		message: string;
		recipient: string;
		alert: boolean;
		pdu: Submit;
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

// SerialPortOptions

import { AutoDetectTypes } from '@serialport/bindings-cpp';
import { SerialPortOpenOptions } from 'serialport/dist/index';

/**
 * @see https://serialport.io/docs/api-bindings-cpp#open
 */
export type SerialPortOptions = SerialPortOpenOptions<AutoDetectTypes>;
