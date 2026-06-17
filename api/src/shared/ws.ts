import { Server, type IRPCMethodParams } from "rpc-websockets";
import type { WebSocket } from "ws";

type WSServer = typeof Server;
export type WSParams = typeof IRPCMethodParams;

function getListenPort(): number {
	const apiPort = process.env.API_PORT;
	if (!apiPort) {
		throw new Error("API_PORT environment variable is not set");
	}
	return parseInt(apiPort, 10);
}

// rpc-websockets emits non-standard notifications: { notification: name, params }
// EVY clients expect standard JSON-RPC 2.0: { jsonrpc: "2.0", method: name, params }
export function emitJsonRpc(
	server: WSServer,
	eventName: string,
	params: unknown,
) {
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

export function initServer(
	authHandler: (params: WSParams) => Promise<boolean>,
): Promise<WSServer> {
	const port = getListenPort();
	return new Promise<WSServer>((resolve, reject) => {
		const server = new Server({ host: "0.0.0.0", port });

		server.on("listening", () => resolve(server));
		server.on("error", (error: Error) => reject(error));
	}).then(async (server) => {
		await server.setAuth(authHandler);

		await server.event("dataChanged");

		console.info(`WS server listening at 0.0.0.0:${port}`);
		return server;
	});
}

export function makeAuthChecker(
	server: WSServer,
): (socket: WebSocket) => boolean {
	return (socket: WebSocket) => {
		const namespace = server.namespaces["/"];
		if (!namespace) return false;
		const clients: Map<string, WebSocket> = namespace.clients || new Map();
		return [...clients.values()].some((s) => s === socket);
	};
}

export function wireBinaryChunkHandler(
	server: WSServer,
	isSocketAuthenticated: (socket: WebSocket) => boolean,
	handleChunk: (frame: Buffer) => Promise<void>,
): void {
	// biome-ignore lint/suspicious/noExplicitAny: rpc-websockets wss not typed
	(server as any).wss.on("connection", (socket: WebSocket) => {
		socket.on(
			"message",
			(data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
				if (!isBinary) return;
				if (!isSocketAuthenticated(socket)) return;
				const frame = Buffer.isBuffer(data)
					? data
					: Buffer.from(data as ArrayBuffer);
				handleChunk(frame).catch((err: Error) => {
					console.warn("[ws] binary chunk error:", err.message);
				});
			},
		);
	});
}
