import { Helper } from '../Helper';

export interface TypeParams {
	replyPath: number;
	userDataHeader: number;
	statusReportRequest: number;
	validityPeriodFormat: number;
	rejectDuplicates: number;
}

export abstract class PDUType {
	static readonly SMS_SUBMIT = 0x01;
	static readonly SMS_DELIVER = 0x00;
	static readonly SMS_REPORT = 0x02;

	static readonly VPF_NONE = 0x00;
	static readonly VPF_SIEMENS = 0x01;
	static readonly VPF_RELATIVE = 0x02;
	static readonly VPF_ABSOLUTE = 0x03;

	private readonly replyPath: number;
	private _userDataHeader: number;
	private _statusReportRequest: number;
	private _validityPeriodFormat: number;
	private readonly rejectDuplicates: number;
	abstract messageTypeIndicator: number;

	constructor(params: TypeParams) {
		this.replyPath = params.replyPath;
		this._userDataHeader = params.userDataHeader;
		this._statusReportRequest = params.statusReportRequest;
		this._validityPeriodFormat = params.validityPeriodFormat;
		this.rejectDuplicates = params.rejectDuplicates;
	}

	/*
	 * getter & setter
	 */

	get userDataHeader() {
		return this._userDataHeader;
	}

	setUserDataHeader(userDataHeader: number) {
		this._userDataHeader = 0x01 & userDataHeader;
		return this;
	}

	get statusReportRequest() {
		return this._statusReportRequest;
	}

	setStatusReportRequest(srr: number) {
		this._statusReportRequest = 0x01 & srr;
		return this;
	}

	get validityPeriodFormat() {
		return this._validityPeriodFormat;
	}

	setValidityPeriodFormat(validityPeriodFormat: number) {
		this._validityPeriodFormat = 0x03 & validityPeriodFormat;

		switch (this._validityPeriodFormat) {
			case PDUType.VPF_NONE:
				break;
			case PDUType.VPF_SIEMENS:
				break;
			case PDUType.VPF_RELATIVE:
				break;
			case PDUType.VPF_ABSOLUTE:
				break;
			default:
				throw new Error('node-pdu: Wrong validity period format!');
		}

		return this;
	}

	/*
	 * public functions
	 */

	getValue() {
		return (
			((1 & this.replyPath) << 7) |
			((1 & this._userDataHeader) << 6) |
			((1 & this._statusReportRequest) << 5) |
			((3 & this._validityPeriodFormat) << 3) |
			((1 & this.rejectDuplicates) << 2) |
			(3 & this.messageTypeIndicator)
		);
	}

	toString() {
		return Helper.toStringHex(this.getValue());
	}
}
