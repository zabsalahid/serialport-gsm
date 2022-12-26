import { CommandResponse } from '../types';

export class Command {
	deprecated = false;

	constructor(
		readonly ATCommand: string,
		readonly timeout = 3000,
		readonly callback: (result: CommandResponse | Error) => void = () => undefined,
		readonly awaitResponse = true
	) {}
}
