import moment from 'moment';
import { Data } from './utils/Data/Data';
import { Helper } from './utils/Helper';
import { PDU, PDUOptions } from './utils/PDU';
import { SCA } from './utils/SCA/SCA';
import { SCTS } from './utils/SCTS';
import { DeliverType } from './utils/Type/DeliverType';

export interface DeliverOptions extends PDUOptions {
	type?: DeliverType;
	serviceCenterTimeStamp?: SCTS;
}

export class Deliver extends PDU {
	type: DeliverType;

	data: Data;
	serviceCenterTimeStamp: SCTS;

	constructor(address: string | SCA, data: string | Data, options: DeliverOptions = {}) {
		super(address, options);

		this.type = options.type || new DeliverType();
		this.data = this.findData(data);
		this.serviceCenterTimeStamp = options.serviceCenterTimeStamp || new SCTS(this.getDateTime());
	}

	/*
	 * setter
	 */

	setType(type: DeliverType) {
		this.type = type;
		return this;
	}

	setData(data: string | Data) {
		this.data = this.findData(data);
		return this;
	}

	setServiceCenterTimeStamp(time: Date | SCTS = this.getDateTime()) {
		if (time instanceof SCTS) {
			this.serviceCenterTimeStamp = time;
			return this;
		}

		this.serviceCenterTimeStamp = new SCTS(time);

		return this;
	}

	/*
	 * private functions
	 */

	private getDateTime() {
		return moment().add(10, 'days').toDate();
	}

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
		return this.getStart();
	}

	getStart() {
		let str = '';

		str += this.serviceCenterAddress.toString();
		str += this.type.toString();
		str += this.address.toString();
		str += Helper.toStringHex(this.protocolIdentifier.getValue());
		str += this.dataCodingScheme.toString();
		str += this.serviceCenterTimeStamp.toString();

		return str;
	}
}
