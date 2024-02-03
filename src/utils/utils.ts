import { Modem } from '../Modem';
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

export class ModemError extends Error {
	constructor(modem: Modem, message: string) {
		super(`serialport-gsm/${modem.device}: ${message}`);
	}
}

export type ModemMode = 'PDU' | 'SMS';

export interface CmdStack {
	cmds: Command[];
	cancelOnFailure: boolean;
	onFinish?: () => void;
	onFailed?: (e: Error) => void;
}
