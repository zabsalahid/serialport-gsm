import { Helper } from '../../utils/Helper';
import { SCA } from '../../utils/SCA/SCA';
import { SCAType } from '../../utils/SCA/SCAType';
import { GetSubstr } from '../index';

export default function parseSCA(getPduSubstr: GetSubstr, isAddress: boolean) {
	const buffer = Buffer.from(getPduSubstr(2), 'hex');
	const sca = new SCA(isAddress);
	let size = buffer[0];
	let octets;

	if (size) {
		// if is OA or DA then the size in semi-octets
		if (isAddress) {
			octets = Math.ceil(size / 2); // to full octets
			// else size in octets
		} else {
			size--;
			octets = size;
			size *= 2; // to semi-octets for future usage
		}

		const buffer2 = Buffer.from(getPduSubstr(2), 'hex');
		sca.type = new SCAType(buffer2[0]);

		const hex = getPduSubstr(octets * 2);

		switch (sca.type.type) {
			case SCAType.TYPE_UNKNOWN:
			case SCAType.TYPE_INTERNATIONAL:
			case SCAType.TYPE_ACCEPTER_INTO_NET:
			case SCAType.TYPE_SUBSCRIBER_NET:
			case SCAType.TYPE_TRIMMED:
				// Detect padding char
				if (!isAddress && hex.charAt(size - 2) === 'F') {
					size--;
				}

				sca.setPhone(
					(hex.match(/.{1,2}/g) || [])
						.map((b) => {
							return SCA.mapFilterDecode(b).split('').reverse().join('');
						})
						.join('')
						.slice(0, size),
					!isAddress
				);

				break;

			case SCAType.TYPE_ALPHANUMERICAL:
				size = Math.floor((size * 4) / 7); // semi-octets to septets
				sca.setPhone(Helper.decode7Bit(hex, size), !isAddress);

				break;
		}
	}

	return sca;
}
