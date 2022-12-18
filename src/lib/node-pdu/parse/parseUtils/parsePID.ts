import { PID } from '../../utils/PID';
import { GetSubstr } from '../index';

export default function parsePID(getPduSubstr: GetSubstr) {
	const buffer = Buffer.from(getPduSubstr(2), 'hex');
	const byte = buffer[0];
	const pid = new PID();

	pid.setPid(byte >> 6);
	pid.setIndicates(byte >> 5);
	pid.setType(byte);

	return pid;
}
