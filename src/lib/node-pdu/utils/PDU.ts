import { DCS } from './DCS';
import { PID } from './PID';
import { SCA } from './SCA/SCA';
import { DeliverType } from './Type/DeliverType';
import { ReportType } from './Type/ReportType';
import { SubmitType } from './Type/SubmitType';

export interface PDUOptions {
	serviceCenterAddress?: SCA;
	protocolIdentifier?: PID;
	dataCodingScheme?: DCS;
}

/*
 * Protocol Description Unit
 */

export abstract class PDU {
	abstract type: DeliverType | ReportType | SubmitType;

	address: SCA;
	serviceCenterAddress: SCA;
	protocolIdentifier: PID;
	dataCodingScheme: DCS;

	constructor(address: string | SCA, options: PDUOptions = {}) {
		this.address = this.findAddress(address);

		this.serviceCenterAddress = options.serviceCenterAddress || new SCA(false);
		this.protocolIdentifier = options.protocolIdentifier || new PID();
		this.dataCodingScheme = options.dataCodingScheme || new DCS();
	}

	/*
	 * setter
	 */

	setAddress(address: string | SCA) {
		this.address = this.findAddress(address);
		return this;
	}

	setServiceCenterAddress(address: SCA | string) {
		if (address instanceof SCA) {
			this.serviceCenterAddress = address;
			return this;
		}

		this.serviceCenterAddress.setPhone(address, true);
		return this;
	}

	setProtocolIdentifier(pid: PID) {
		this.protocolIdentifier = pid;
		return this;
	}

	setDataCodingScheme(dcs: DCS) {
		this.dataCodingScheme = dcs;
		return this;
	}

	/*
	 * private functions
	 */

	private findAddress(address: string | SCA) {
		if (address instanceof SCA) {
			return address;
		}

		return new SCA().setPhone(address);
	}
}
