import { CommandResponse } from '../types';
import { Command } from './Command';

export async function simplifyResponse(response: Promise<CommandResponse>) {
	return (await response)[0] || '';
}

export function resultCode(response: string) {
	if (response.toUpperCase().includes('ERROR') || response.toLocaleUpperCase().trim() !== 'OK') {
		return 'ERROR';
	}

	return 'OK';
}

export type ModemMode = 'PDU' | 'SMS';

export interface ModemOptions {
	deleteSmsOnReceive: boolean;
	enableConcatenation: boolean;
	customInitCommand: string | null;
	autoInitOnOpen: boolean;
	cnmiCommand: string;
}

export interface CmdStack {
	cmds: Command[];
	cancelOnFailure: boolean;
	onFinish?: () => void;
	onFailed?: (e: Error) => void;
}
