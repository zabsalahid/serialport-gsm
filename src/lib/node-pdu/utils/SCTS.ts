import moment from 'moment';
import { Helper } from './Helper';

/*
 * Service Center Time Stamp
 */

export class SCTS {
	readonly time: number;
	readonly tzOff: number;

	constructor(date: Date, tzOff?: number) {
		this.time = date.getTime() / 1000;
		this.tzOff = tzOff || -1 * date.getTimezoneOffset();
	}

	/*
	 * private functions
	 */

	private getDateTime() {
		const tzAbs = Math.floor(Math.abs(this.tzOff) / 15); // To quarters of an hour
		const x = Math.floor(tzAbs / 10) * 16 + (tzAbs % 10) + (this.tzOff < 0 ? 0x80 : 0x00);

		return moment.unix(this.time).utcOffset(this.tzOff).format('YYMMDDHHmmss') + Helper.toStringHex(x);
	}

	/*
	 * public functions
	 */

	getIsoString() {
		return moment.unix(this.time).utcOffset(this.tzOff).format('YYYY-MM-DDTHH:mm:ssZ');
	}

	toString() {
		return (this.getDateTime().match(/.{1,2}/g) || [])
			.map((s) => {
				return s.split('').reverse().join('');
			})
			.join('');
	}
}
