import { DCS, DCSOptions } from '../../utils/DCS';
import { GetSubstr } from '../index';

export default function parseDCS(getPduSubstr: GetSubstr) {
	const buffer = Buffer.from(getPduSubstr(2), 'hex');
	const byte = buffer[0];
	const dcsOptions: DCSOptions = {};

	dcsOptions.encodeGroup = 0x0f & (byte >> 4);
	dcsOptions.dataEncoding = 0x0f & byte;

	dcsOptions.textAlphabet = 3 & (dcsOptions.dataEncoding >> 2);
	dcsOptions.classMessage = 3 & dcsOptions.dataEncoding;

	switch (dcsOptions.encodeGroup) {
		case 0x0c:
			dcsOptions.discardMessage = true;
			dcsOptions.textAlphabet = DCS.ALPHABET_DEFAULT;
			break;

		case 0x0d:
			dcsOptions.storeMessage = true;
			break;

		case 0x0e:
			dcsOptions.storeMessageUCS2 = true;
			break;

		case 0x0f:
			dcsOptions.dataCodingAndMessageClass = true;

			if (dcsOptions.dataEncoding & (1 << 2)) {
				dcsOptions.textAlphabet = DCS.ALPHABET_8BIT;
			}

			break;

		default:
			dcsOptions.useMessageClass = !!(dcsOptions.encodeGroup & (1 << 0));
			dcsOptions.compressedText = !!(dcsOptions.encodeGroup & (1 << 1));
	}

	if (dcsOptions.discardMessage || dcsOptions.storeMessage || dcsOptions.storeMessageUCS2) {
		if (dcsOptions.dataEncoding & (1 << 3)) {
			dcsOptions.messageIndication = 1;
			dcsOptions.messageIndicationType = 3 & dcsOptions.dataEncoding;
		}
	}

	return new DCS(dcsOptions);
}
