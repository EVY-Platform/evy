declare module "rpc-websockets" {
	export class Client {
		constructor(address: string, options?: ClientOptions);
		on(event: "open", listener: () => void): this;
		on(event: "close", listener: () => void): this;
		on(event: "error", listener: (error: Error) => void): this;
		login(params: Record<string, unknown>): Promise<unknown>;
		call(method: string, params: Record<string, unknown>): Promise<unknown>;
		close(): void;
	}

	interface ClientOptions {
		autoconnect?: boolean;
		reconnect?: boolean;
		reconnect_interval?: number;
		max_reconnects?: number;
	}
}
