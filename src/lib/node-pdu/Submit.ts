import { Data } from './utils/Data/Data';
import { Helper } from './utils/Helper';
import { PDU, PDUOptions } from './utils/PDU';
import { SCA } from './utils/SCA/SCA';
import { SubmitType } from './utils/Type/SubmitType';
import { VP } from './utils/VP';

export interface SubmitOptions extends PDUOptions {
	type?: SubmitType;
	messageReference?: number;
	validityPeriod?: VP;
}

export class Submit extends PDU {
	type: SubmitType;

	data: Data;
	messageReference: number;
	validityPeriod: VP;

	constructor(address: string | SCA, data: string | Data, options: SubmitOptions = {}) {
		super(address, options);

		this.type = options.type || new SubmitType();
		this.data = this.findData(data);
		this.messageReference = options.messageReference || 0x00;
		this.validityPeriod = options.validityPeriod || new VP();
	}

	/*
	 * setter
	 */

	setType(type: SubmitType) {
		this.type = type;
		return this;
	}

	setData(data: string | Data) {
		this.data = this.findData(data);
		return this;
	}

	setMessageReference(messageReference: number) {
		this.messageReference = messageReference;
		return this;
	}

	setValidityPeriod(value: VP | string | number) {
		if (value instanceof VP) {
			this.validityPeriod = value;
			return this;
		}

		this.validityPeriod = new VP();

		if (typeof value === 'string') {
			this.validityPeriod.setDateTime(value);
		} else {
			this.validityPeriod.setInterval(value);
		}

		return this;
	}

	/*
	 * private functions
	 */

	private findData(data: string | Data) {
		if (data instanceof Data) {
			return data;
		}

		return new Data().setData(data, this);
	}

	/*
	 * public functions
	 */

	getParts() {
		return this.data.parts;
	}

	toString() {
		return this.getParts()
			.map((part) => {
				return part.toString(this);
			})
			.join('\n');
	}

	getStart() {
		let str = '';

		str += this.serviceCenterAddress.toString();
		str += this.type.toString();
		str += Helper.toStringHex(this.messageReference);
		str += this.address.toString();
		str += Helper.toStringHex(this.protocolIdentifier.getValue());
		str += this.dataCodingScheme.toString();
		str += this.validityPeriod.toString(this);

		return str;
	}
}
