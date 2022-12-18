import { Deliver } from '../Deliver';
import { Report } from '../Report';
import { Submit } from '../Submit';
import { SCA } from '../utils/SCA/SCA';
import { DeliverType } from '../utils/Type/DeliverType';
import { ReportType } from '../utils/Type/ReportType';
import { SubmitType } from '../utils/Type/SubmitType';

// import the parser for the utils

import parseData from './parseUtils/parseData';
import parseDCS from './parseUtils/parseDCS';
import parsePID from './parseUtils/parsePID';
import parseSCA from './parseUtils/parseSCA';
import parseSCTS from './parseUtils/parseSCTS';
import parseType from './parseUtils/parseType';
import parseVP from './parseUtils/parseVP';

export type GetSubstr = (length: number) => string;

export function parse(str: string) {
	let pduParse = str;

	const getSubstr: GetSubstr = (length: number) => {
		const str = pduParse.substring(0, length);
		pduParse = pduParse.substring(length);

		return str;
	};

	// The correct order of parsing is important!!!

	const sca = parseSCA(getSubstr, false);
	const type = parseType(getSubstr);

	if (type instanceof DeliverType) {
		return parseDeliver(sca, type, getSubstr);
	}

	if (type instanceof ReportType) {
		return parseReport(sca, type, getSubstr);
	}

	if (type instanceof SubmitType) {
		return parseSubmit(sca, type, getSubstr);
	}

	throw new Error('node-pdu: Unknown SMS type!');
}

function parseDeliver(serviceCenterAddress: SCA, type: DeliverType, getSubstr: GetSubstr) {
	// The correct order of parsing is important!

	const address = parseSCA(getSubstr, true);
	const protocolIdentifier = parsePID(getSubstr);
	const dataCodingScheme = parseDCS(getSubstr);
	const serviceCenterTimeStamp = parseSCTS(getSubstr);
	const userDataLength = Buffer.from(getSubstr(2), 'hex')[0];
	const userData = parseData(type, dataCodingScheme, userDataLength, getSubstr);

	return new Deliver(address, userData, { serviceCenterAddress, type, protocolIdentifier, dataCodingScheme, serviceCenterTimeStamp });
}

function parseReport(serviceCenterAddress: SCA, type: ReportType, getSubstr: GetSubstr) {
	// The correct order of parsing is important!

	const referencedBytes = Buffer.from(getSubstr(2), 'hex')[0];
	const address = parseSCA(getSubstr, true);
	const timestamp = parseSCTS(getSubstr);
	const discharge = parseSCTS(getSubstr);
	const status = Buffer.from(getSubstr(2), 'hex')[0];

	return new Report(address, referencedBytes, timestamp, discharge, status, { serviceCenterAddress, type });
}

function parseSubmit(serviceCenterAddress: SCA, type: SubmitType, getSubstr: GetSubstr) {
	// The correct order of parsing is important!

	const messageReference = Buffer.from(getSubstr(2), 'hex')[0];
	const address = parseSCA(getSubstr, true);
	const protocolIdentifier = parsePID(getSubstr);
	const dataCodingScheme = parseDCS(getSubstr);
	const validityPeriod = parseVP(type, getSubstr);
	const userDataLength = Buffer.from(getSubstr(2), 'hex')[0];
	const userData = parseData(type, dataCodingScheme, userDataLength, getSubstr);

	return new Submit(address, userData, {
		serviceCenterAddress,
		type,
		messageReference,
		protocolIdentifier,
		dataCodingScheme,
		validityPeriod
	});
}
