import { Helper } from '../Helper';

export class SCAType {
	static readonly TYPE_UNKNOWN = 0x00;
	static readonly TYPE_INTERNATIONAL = 0x01;
	static readonly TYPE_NATIONAL = 0x02;
	static readonly TYPE_ACCEPTER_INTO_NET = 0x03;
	static readonly TYPE_SUBSCRIBER_NET = 0x04;
	static readonly TYPE_ALPHANUMERICAL = 0x05;
	static readonly TYPE_TRIMMED = 0x06;
	static readonly TYPE_RESERVED = 0x07;

	static readonly PLAN_UNKNOWN = 0x00;
	static readonly PLAN_ISDN = 0x01;
	static readonly PLAN_X_121 = 0x02;
	static readonly PLAN_TELEX = 0x03;
	static readonly PLAN_NATIONAL = 0x08;
	static readonly PLAN_INDIVIDUAL = 0x09;
	static readonly PLAN_ERMES = 0x0a;
	static readonly PLAN_RESERVED = 0x0f;

	private _type: number;
	private _plan: number;

	constructor(value = 0x91) {
		this._type = 0x07 & (value >> 4);
		this._plan = 0x0f & value;
	}

	/*
	 * getter & setter
	 */

	get type() {
		return this._type;
	}

	setType(type: number) {
		this._type = 0x07 & type;
		return this;
	}

	get plan() {
		return this._plan;
	}

	setPlan(plan: number) {
		this._plan = 0x0f & plan;
		return this;
	}

	/*
	 * public functions
	 */

	getValue() {
		return (1 << 7) | (this._type << 4) | this._plan;
	}

	toString() {
		return Helper.toStringHex(this.getValue());
	}
}
