import { Helper } from './Helper';

export interface DCSOptions {
	encodeGroup?: number;
	dataEncoding?: number;
	compressedText?: boolean;
	textAlphabet?: number;
	useMessageClass?: boolean;
	classMessage?: number;
	discardMessage?: boolean;
	storeMessage?: boolean;
	storeMessageUCS2?: boolean;
	dataCodingAndMessageClass?: boolean;
	messageIndication?: number;
	messageIndicationType?: number;
}

/*
 * Data Coding Scheme
 */

export class DCS {
	/*
	 * GSM 03.38 V7.0.0 (1998-07).
	 */

	static readonly CLASS_NONE = 0x00;
	static readonly CLASS_MOBILE_EQUIPMENT = 0x01;
	static readonly CLASS_SIM_SPECIFIC_MESSAGE = 0x02;
	static readonly CLASS_TERMINAL_EQUIPMENT = 0x03;

	static readonly INDICATION_TYPE_VOICEMAIL = 0x00;
	static readonly INDICATION_TYPE_FAX = 0x01;
	static readonly INDICATION_TYPE_EMAIL = 0x02;
	static readonly INDICATION_TYPE_OTHER = 0x03;

	static readonly ALPHABET_DEFAULT = 0x00;
	static readonly ALPHABET_8BIT = 0x01;
	static readonly ALPHABET_UCS2 = 0x02; // 16 bit unicode
	static readonly ALPHABET_RESERVED = 0x03;

	private _encodeGroup: number;
	private _dataEncoding: number;
	compressedText: boolean;
	private _textAlphabet: number;
	private _useMessageClass: boolean;
	private _classMessage: number;
	private _discardMessage: boolean;
	private _storeMessage: boolean;
	private _storeMessageUCS2: boolean;
	private _dataCodingAndMessageClass: boolean;
	private _messageIndication: number;
	private _messageIndicationType: number;

	constructor(options: DCSOptions = {}) {
		this._encodeGroup = options.encodeGroup || 0x00;
		this._dataEncoding = options.dataEncoding || 0x00;
		this.compressedText = options.compressedText || false;
		this._textAlphabet = options.textAlphabet || DCS.ALPHABET_DEFAULT;
		this._useMessageClass = options.useMessageClass || false;
		this._classMessage = options.classMessage || DCS.CLASS_NONE;
		this._discardMessage = options.discardMessage || false;
		this._storeMessage = options.storeMessage || false;
		this._storeMessageUCS2 = options.storeMessageUCS2 || false;
		this._dataCodingAndMessageClass = options.dataCodingAndMessageClass || false;
		this._messageIndication = options.messageIndication || 0;
		this._messageIndicationType = options.messageIndicationType || 0;
	}

	/*
	 * getter & setter
	 */

	get encodeGroup() {
		return this._encodeGroup;
	}

	get dataEncoding() {
		return this._dataEncoding;
	}

	get discardMessage() {
		return this._discardMessage;
	}

	get storeMessage() {
		return this._storeMessage;
	}

	get storeMessageUCS2() {
		return this._storeMessageUCS2;
	}

	get dataCodingAndMessageClass() {
		return this._dataCodingAndMessageClass;
	}

	get messageIndication() {
		return this._messageIndication;
	}

	setMessageIndication(indication: number) {
		this._messageIndication = 1 & indication;
		return this;
	}

	get messageIndicationType() {
		return this._messageIndicationType;
	}

	setMessageIndicationType(type: number) {
		this._messageIndicationType = 0x03 & type;

		switch (this._messageIndicationType) {
			case DCS.INDICATION_TYPE_VOICEMAIL:
				break;

			case DCS.INDICATION_TYPE_FAX:
				break;

			case DCS.INDICATION_TYPE_EMAIL:
				break;

			case DCS.INDICATION_TYPE_OTHER:
				break;

			default:
				throw new Error('node-pdu: Wrong indication type!');
		}

		return this;
	}

	setTextCompressed(compressed = true) {
		this.compressedText = compressed;
		return this;
	}

	get textAlphabet() {
		return this._textAlphabet;
	}

	setTextAlphabet(alphabet: number) {
		this._textAlphabet = 0x03 & alphabet;

		switch (this._textAlphabet) {
			case DCS.ALPHABET_DEFAULT:
				break;

			case DCS.ALPHABET_8BIT:
				break;

			case DCS.ALPHABET_UCS2:
				break;

			case DCS.ALPHABET_RESERVED:
				break;

			default:
				throw new Error('node-pdu: Wrong alphabet!');
		}

		return this;
	}

	get classMessage() {
		return this._classMessage;
	}

	setClass(cls: number) {
		this.setUseMessageClass();
		this._classMessage = 0x03 & cls;

		switch (this._classMessage) {
			case DCS.CLASS_NONE:
				this.setUseMessageClass(false);
				break;

			case DCS.CLASS_MOBILE_EQUIPMENT:
				break;

			case DCS.CLASS_SIM_SPECIFIC_MESSAGE:
				break;

			case DCS.CLASS_TERMINAL_EQUIPMENT:
				break;

			default:
				throw new Error('node-pdu: Wrong class type!');
		}

		return this;
	}

	get useMessageClass() {
		return this._useMessageClass;
	}

	setUseMessageClass(use = true) {
		this._useMessageClass = use;
		return this;
	}

	/*
	 * public functions
	 */

	setStoreMessage() {
		this._storeMessage = true;
		return this;
	}

	setStoreMessageUCS2() {
		this._storeMessageUCS2 = true;
		return this;
	}

	setDiscardMessage() {
		this._discardMessage = true;
		return this;
	}

	getValue() {
		this._encodeGroup = 0x00;

		// set data encoding, from alphabet and message class
		this._dataEncoding = (this._textAlphabet << 2) | this._classMessage;

		// set message class bit
		if (this._useMessageClass) {
			this._encodeGroup |= 1 << 0;
		}

		// set is compressed bit
		if (this.compressedText) {
			this._encodeGroup |= 1 << 1;
		}

		// change encoding format
		if (this._discardMessage || this._storeMessage || this._storeMessageUCS2) {
			this._dataEncoding = 0x00;

			// set indication
			if (this._messageIndication) {
				this._dataEncoding |= 1 << 3;

				// set message indication type
				this._dataEncoding |= this._messageIndicationType;
			}
		}

		// Discard Message
		if (this._discardMessage) {
			this._encodeGroup = 0x0c;
		}

		// Store Message
		if (this._storeMessage) {
			this._encodeGroup = 0x0d;
		}

		// Store Message UCS2
		if (this._storeMessageUCS2) {
			this._encodeGroup = 0x0e;
		}

		// Data Coding and Message Class
		if (this._dataCodingAndMessageClass) {
			// set bits to 1
			this._encodeGroup = 0x0f;

			// only class message
			this._dataEncoding = 0x03 & this._classMessage;

			// check encoding
			switch (this._textAlphabet) {
				case DCS.ALPHABET_8BIT:
					this._dataEncoding |= 1 << 2;
					break;
				case DCS.ALPHABET_DEFAULT:
					// bit is set to 0
					break;
				default:
					break;
			}
		}

		// return byte value
		return ((0x0f & this._encodeGroup) << 4) | (0x0f & this._dataEncoding);
	}

	toString() {
		return Helper.toStringHex(this.getValue());
	}
}
