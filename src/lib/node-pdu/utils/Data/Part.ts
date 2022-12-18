import { Deliver } from '../../Deliver';
import { Submit } from '../../Submit';
import { Helper } from '../Helper';
import { Header } from './Header';

export class Part {
	readonly data: string;
	readonly size: number;
	readonly text: string;
	readonly header: Header | null;

	constructor(data: string, size: number, text: string, header?: Header) {
		this.data = data;
		this.size = size;
		this.text = text;
		this.header = header || null;
	}

	/*
	 * private functions
	 */

	private getPduString(pdu: Deliver | Submit) {
		return pdu.getStart();
	}

	private getPartSize() {
		return Helper.toStringHex(this.size);
	}

	/*
	 * public functions
	 */

	toString(pdu: Deliver | Submit) {
		// concate pdu, size of part, headers, data
		return this.getPduString(pdu) + this.getPartSize() + (this.header || '') + this.data;
	}
}
