import { DeliverType } from '../../utils/Type/DeliverType';
import { PDUType } from '../../utils/Type/PDUType';
import { ReportType } from '../../utils/Type/ReportType';
import { SubmitType } from '../../utils/Type/SubmitType';
import { GetSubstr } from '../index';

export default function parseType(getPduSubstr: GetSubstr) {
	const buffer = Buffer.from(getPduSubstr(2), 'hex');
	const byte = buffer[0];

	const params = {
		replyPath: 1 & (byte >> 7),
		userDataHeader: 1 & (byte >> 6),
		statusReportRequest: 1 & (byte >> 5),
		validityPeriodFormat: 3 & (byte >> 3),
		rejectDuplicates: 1 & (byte >> 2),
		messageTypeIndicator: 3 & byte
	};

	switch (3 & byte) {
		case PDUType.SMS_DELIVER:
			return new DeliverType(params);
		case PDUType.SMS_SUBMIT:
			return new SubmitType(params);
		case PDUType.SMS_REPORT:
			return new ReportType(params);
		default:
			throw new Error('node-pdu: Unknown SMS type!');
	}
}
