import moment from 'moment';
import { SCTS } from '../../utils/SCTS';
import { GetSubstr } from '../index';

export default function parseSCTS(getPduSubstr: GetSubstr) {
	const hex = getPduSubstr(14);
	const params: number[] = [];

	if (!hex) {
		throw new Error('node-pdu: Not enough bytes!');
	}

	(hex.match(/.{1,2}/g) || []).map((s) => {
		// NB: 7'th element (index = 6) is TimeZone and it can be a HEX
		if ((params.length < 6 && /\D+/.test(s)) || (params.length === 6 && /[^0-9A-Fa-f]/.test(s))) {
			params.push(0);
			return;
		}

		params.push(parseInt(s.split('').reverse().join(''), params.length < 6 ? 10 : 16));
	});

	if (params.length < 6) {
		throw new Error('node-pdu: Parsing failed!');
	}

	// Parse TimeZone field (see 3GPP TS 23.040 section 9.2.3.11)
	let tzOff = params[6] & 0x7f;
	tzOff = (tzOff >> 4) * 10 + (tzOff & 0x0f); // Semi-octet to int
	tzOff = tzOff * 15; // Quarters of an hour to minutes

	// Check sign
	if (params[6] & 0x80) {
		tzOff *= -1;
	}

	// Build ISO8601 datetime
	const isoTime = moment()
		.year(params[0] > 70 ? 1900 + params[0] : 2000 + params[0])
		.month(params[1] - 1)
		.date(params[2])
		.hour(params[3])
		.minute(params[4])
		.second(params[5])
		.utcOffset(tzOff, true);

	return new SCTS(isoTime.toDate(), tzOff);
}
