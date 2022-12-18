import { Helper } from '../Helper';
import { SCAType } from './SCAType';

export interface SCAOptions {
	type?: SCAType;
}

export class SCA {
	type: SCAType;

	private _isAddress: boolean;
	private _size = 0x00;
	private encoded = '';
	private _phone: string | null = null;

	constructor(isAddress = false, options: SCAOptions = {}) {
		this.type = options.type || new SCAType();
		this._isAddress = isAddress;
	}

	/*
	 * getter & setter
	 */

	get isAddress() {
		return this._isAddress;
	}

	get size() {
		return this._size;
	}

	get phone() {
		return this._phone;
	}

	setPhone(phone: string, SC = false) {
		this._phone = phone;
		this._isAddress = !SC;

		if (this.type.type === SCAType.TYPE_ALPHANUMERICAL) {
			const tmp = Helper.encode7Bit(phone);

			this._size = Math.ceil((tmp.length * 7) / 4); // septets to semi-octets
			this.encoded = tmp.result;

			return this;
		}

		const clear = phone.replace(/[^a-c0-9*#]/gi, '');

		// get size
		// service center addres counting by octets OA or DA as length numbers
		this._size = SC ? 1 + Math.ceil(clear.length / 2) : clear.length;

		this.encoded = clear
			.split('')
			.map((s) => {
				return SCA.mapFilterEncode(s);
			})
			.join('');

		return this;
	}

	/*
	 * public functions
	 */

	getOffset() {
		return !this._size ? 2 : this._size + 4;
	}

	toString() {
		let str = Helper.toStringHex(this.size);

		if (this.size !== 0) {
			str += this.type.toString();

			if (this.type.type !== SCAType.TYPE_ALPHANUMERICAL) {
				// reverse octets
				const l = this.encoded.length;

				for (let i = 0; i < l; i += 2) {
					const b1 = this.encoded.substring(i, i + 1);
					const b2 = i + 1 >= l ? 'F' : this.encoded.substring(i + 1, i + 2);

					// add to pdu
					str += b2 + b1;
				}
			} else {
				str += this.encoded;
			}
		}

		return str;
	}

	/*
	 * static functions
	 */

	static mapFilterDecode(letter: string) {
		const buffer = Buffer.from(letter, 'hex');

		switch (buffer[0]) {
			case 0x0a:
				return '*';
			case 0x0b:
				return '#';
			case 0x0c:
				return 'a';
			case 0x0d:
				return 'b';
			case 0x0e:
				return 'c';
			default:
				return letter;
		}
	}

	static mapFilterEncode(letter: string) {
		switch (letter) {
			case '*':
				return 'A';
			case '#':
				return 'B';
			case 'a':
				return 'C';
			case 'b':
				return 'D';
			case 'c':
				return 'E';
			default:
				return letter;
		}
	}
}
