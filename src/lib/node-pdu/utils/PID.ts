export interface PIDOptions {
	pid?: number;
	indicates?: number;
	type?: number;
}

/*
 * Protocol Identifier
 */

export class PID {
	static readonly PID_ASSIGNED = 0x00; // Assigns bits 0..5 as defined below
	static readonly PID_GSM_03_40 = 0x01; // See GSM 03.40 TP-PID complete definition
	static readonly PID_RESERVED = 0x02; // Reserved
	static readonly PID_SPECIFIC = 0x03; // Assigns bits 0-5 for SC specific use

	static readonly TYPE_IMPLICIT = 0x00; // Implicit
	static readonly TYPE_TELEX = 0x01; // telex (or teletex reduced to telex format)
	static readonly TYPE_TELEFAX = 0x02; // group 3 telefax
	static readonly TYPE_VOICE = 0x04; // voice telephone (i.e. conversion to speech)
	static readonly TYPE_ERMES = 0x05; // ERMES (European Radio Messaging System)
	static readonly TYPE_NPS = 0x06; // National Paging system (known to the SC
	static readonly TYPE_X_400 = 0x11; // any public X.400-based message handling system
	static readonly TYPE_IEM = 0x12; // Internet Electronic Mail

	private _pid: number;
	private _indicates: number;
	private _type: number;

	constructor(options: PIDOptions = {}) {
		this._pid = options.pid || PID.PID_ASSIGNED;
		this._indicates = options.indicates || 0x00;
		this._type = options.type || PID.TYPE_IMPLICIT;
	}

	/*
	 * getter & setter
	 */

	get pid() {
		return this._pid;
	}

	setPid(pid: number) {
		this._pid = 0x03 & pid;
		return this;
	}

	get indicates() {
		return this._indicates;
	}

	setIndicates(indicates: number) {
		this._indicates = 0x01 & indicates;
		return this;
	}

	get type() {
		return this._type;
	}

	setType(type: number) {
		this._type = 0x1f & type;
		return this;
	}

	/*
	 * public functions
	 */

	getValue() {
		return (this._pid << 6) | (this._indicates << 5) | this._type;
	}

	toString() {
		return '' + this.getValue();
	}
}
