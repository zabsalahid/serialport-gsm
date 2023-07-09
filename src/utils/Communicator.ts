export interface Communicator {
	deviceIndentifier: string;

	isConnected: boolean;
	connect: () => Promise<void>;
	disconnect: () => Promise<void>;

	setOnResiveFunc: (func: (data: string) => void) => void;
	write: (data: string) => void;
}
