import { Data, DataOptions } from '../../utils/Data/Data';
import { Header } from '../../utils/Data/Header';
import { Part } from '../../utils/Data/Part';
import { DCS } from '../../utils/DCS';
import { Helper } from '../../utils/Helper';
import { PDUType } from '../../utils/Type/PDUType';
import { GetSubstr } from '../index';

export default function parseData(type: PDUType, dataCodingScheme: DCS, userDataLength: number, getPduSubstr: GetSubstr) {
	const dataOptions: DataOptions = {};

	if (dataCodingScheme.textAlphabet === DCS.ALPHABET_UCS2) {
		dataOptions.isUnicode = true;
	}

	const tmp = parsePart(type, dataCodingScheme, userDataLength, getPduSubstr);

	dataOptions.data = tmp.text;
	dataOptions.size = tmp.size;
	dataOptions.parts = [tmp.part];

	return new Data(dataOptions);
}

function parsePart(type: PDUType, dataCodingScheme: DCS, userDataLength: number, getPduSubstr: GetSubstr) {
	let length = 0;

	if (dataCodingScheme.textAlphabet === DCS.ALPHABET_DEFAULT) {
		length = Math.ceil((userDataLength * 7) / 8); // Convert septets to octets
	} else {
		length = userDataLength; // Length already in octets
	}

	let header: Header | undefined;
	let hdrSz = 0; // Header full size: UDHL + UDH

	if (type.userDataHeader === 1) {
		header = parseHeader(getPduSubstr);
		hdrSz = 1 + header.getSize(); // UDHL field length + UDH length
		length -= hdrSz;
	}

	const hex = getPduSubstr(length * 2); // Extract Octets x2 chars

	const text = (() => {
		if (dataCodingScheme.textAlphabet === DCS.ALPHABET_DEFAULT) {
			const inLen = userDataLength - Math.ceil((hdrSz * 8) / 7); // Convert octets to septets
			const alignBits = Math.ceil((hdrSz * 8) / 7) * 7 - hdrSz * 8;

			return Helper.decode7Bit(hex, inLen, alignBits);
		}

		if (dataCodingScheme.textAlphabet === DCS.ALPHABET_8BIT) {
			return Helper.decode8Bit(hex);
		}

		if (dataCodingScheme.textAlphabet === DCS.ALPHABET_UCS2) {
			return Helper.decode16Bit(hex);
		}

		throw new Error('node-pdu: Unknown alpabet!');
	})();

	const part = new Part(hex, userDataLength, text, header);

	return { text, size: userDataLength, part };
}

function parseHeader(getPduSubstr: GetSubstr) {
	let buf = Buffer.from(getPduSubstr(2), 'hex');
	let ieLen = 0;
	const ies: { type: number; dataHex: string }[] = [];

	/*
	 * NB: this parser does not perform the IE data parsing, it only
	 * splits the header onto separate IE(s) and then create a new Header
	 * object using the extracted IE(s) as an initializer. IE data parsing
	 * (if any) will beb performed later by the Header class constructor.
	 */

	// Parse IE(s) as TLV
	for (let udhl = buf[0]; udhl > 0; udhl -= 2 + ieLen) {
		buf = Buffer.from(getPduSubstr(4), 'hex');
		ieLen = buf[1];

		ies.push({ type: buf[0], dataHex: getPduSubstr(ieLen * 2) });
	}

	return new Header(ies);
}
