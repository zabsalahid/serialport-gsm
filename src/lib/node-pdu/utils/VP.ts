import { Helper } from './Helper';
import { PDU } from './PDU';
import { SCTS } from './SCTS';
import { PDUType } from './Type/PDUType';

export interface VPOptions {
	datetime?: Date;
	interval?: number;
}

/*
 * Validity Period
 */

export class VP {
	static readonly PID_ASSIGNED = 0x00;

	private _datetime: Date | null;
	private _interval: number | null;

	constructor(options: VPOptions = {}) {
		this._datetime = options.datetime || null;
		this._interval = options.interval || null;
	}

	/*
	 * setter
	 */

	get dateTime() {
		return this._datetime;
	}

	setDateTime(datetime: string | Date) {
		if (datetime instanceof Date) {
			this._datetime = datetime;
			return this;
		}

		this._datetime = new Date(Date.parse(datetime));
		return this;
	}

	get interval() {
		return this._interval;
	}

	setInterval(interval: number) {
		this._interval = interval;
		return this;
	}

	/*
	 * public functions
	 */

	toString(pdu: PDU): string {
		const type = pdu.type;

		// absolute value
		if (this._datetime !== null) {
			type.setValidityPeriodFormat(PDUType.VPF_ABSOLUTE);

			return new SCTS(this._datetime).toString();
		}

		// relative value in seconds
		if (this._interval) {
			type.setValidityPeriodFormat(PDUType.VPF_RELATIVE);

			const minutes = Math.ceil(this._interval / 60);
			const hours = Math.ceil(this._interval / 60 / 60);
			const days = Math.ceil(this._interval / 60 / 60 / 24);
			const weeks = Math.ceil(this._interval / 60 / 60 / 24 / 7);

			if (hours <= 12) {
				return Helper.toStringHex(Math.ceil(minutes / 5) - 1);
			}

			if (hours <= 24) {
				return Helper.toStringHex(Math.ceil((minutes - 720) / 30) + 143);
			}

			if (hours <= 30 * 24 * 3600) {
				return Helper.toStringHex(days + 166);
			}

			return Helper.toStringHex((weeks > 63 ? 63 : weeks) + 192);
		}

		// vpf not used
		type.setValidityPeriodFormat(PDUType.VPF_NONE);

		return '';
	}
}
