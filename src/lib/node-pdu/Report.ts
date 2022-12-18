import { PDU, PDUOptions } from './utils/PDU';
import { SCA } from './utils/SCA/SCA';
import { SCTS } from './utils/SCTS';
import { ReportType } from './utils/Type/ReportType';

export interface ReportOptions extends PDUOptions {
	type?: ReportType;
}

export class Report extends PDU {
	type: ReportType;

	reference: number;
	dateTime: SCTS;
	discharge: SCTS;

	/*
	 * report status
	 * 0x00 Short message received succesfully
	 * 0x01 Short message forwarded to the mobile phone, but unable to confirm delivery
	 * 0x02 Short message replaced by the service center
	 * 0x20 Congestion
	 * 0x21 SME busy
	 * 0x22 No response from SME
	 * 0x23 Service rejected
	 * 0x24 Quality of service not available
	 * 0x25 Error in SME
	 * 0x40 Remote procedure error
	 * 0x41 Incompatible destination
	 * 0x42 Connection rejected by SME
	 * 0x43 Not obtainable
	 * 0x44 Quality of service not available
	 * 0x45 No interworking available
	 * 0x46 SM validity period expired
	 * 0x47 SM deleted by originating SME
	 * 0x48 SM deleted by service center administration
	 * 0x49 SM does not exist
	 * 0x60 Congestion
	 * 0x61 SME busy
	 * 0x62 No response from SME
	 * 0x63 Service rejected
	 * 0x64 Quality of service not available
	 * 0x65 Error in SME
	 */
	status: number;

	constructor(address: string | SCA, reference: number, dateTime: SCTS, discharge: SCTS, status: number, options: ReportOptions = {}) {
		super(address, options);

		this.type = options.type || new ReportType();
		this.reference = reference;
		this.dateTime = dateTime;
		this.discharge = discharge;
		this.status = status;
	}

	/*
	 * setter
	 */

	setType(type: ReportType) {
		this.type = type;
		return this;
	}

	setReference(reference: number) {
		this.reference = reference;
		return this;
	}

	setDateTime(dateTime: SCTS) {
		this.dateTime = dateTime;
		return this;
	}

	setDischarge(discharge: SCTS) {
		this.discharge = discharge;
		return this;
	}

	setStatus(status: number) {
		this.status = status;
		return this;
	}
}
