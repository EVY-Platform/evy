/**
 * Shared JSON-RPC WebSocket server plumbing for api and marketplace.
 */
import { type IRPCMethodParams, Server } from "rpc-websockets";
import type { WebSocket } from "ws";

export type WSServer = InstanceType<typeof Server>;
export type WSParams = IRPCMethodParams;

export function requirePortEnv(name: string): number {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} environment variable is not set`);
	}
	return Number.parseInt(value, 10);
}

// rpc-websockets emits non-standard notifications: { notification: name, params }
// EVY clients expect standard JSON-RPC 2.0: { jsonrpc: "2.0", method: name, params }
export function emitJsonRpc(
	server: WSServer,
	eventName: string,
	params: unknown,
): void {
	const namespace = server.namespaces["/"];
	const nsEvent = namespace?.events?.[eventName];
	const eventSockets: string[] = nsEvent?.sockets || [];
	const clients: Map<string, WebSocket> = namespace?.clients || new Map();

	const message = JSON.stringify({
		jsonrpc: "2.0",
		method: eventName,
		params: params,
	});

	for (const socketId of eventSockets) {
		const socket = clients.get(socketId);
		if (socket) socket.send(message);
	}
}

export function startWsServer(options: {
	host?: string;
	port: number;
}): Promise<WSServer> {
	const host = options.host ?? "0.0.0.0";
	return new Promise<WSServer>((resolve, reject) => {
		const server = new Server({ host, port: options.port });
		server.on("listening", () => resolve(server));
		server.on("error", (error: Error) => reject(error));
	});
}
