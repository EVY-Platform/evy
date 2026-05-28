import { Server, type IRPCError, type IRPCMethodParams } from "rpc-websockets";
import type { WebSocket } from "ws";

type WSServer = typeof Server;
type WSError = typeof IRPCError;
export type WSParams = typeof IRPCMethodParams;

const HOST: string = "0.0.0.0";

function getListenPort(): number {
	const apiPort = process.env.API_PORT;
	if (!apiPort) {
		throw new Error("API_PORT environment variable is not set");
	}
	return parseInt(apiPort, 10);
}

// Custom emit function that sends proper JSON-RPC 2.0 notifications
// rpc-websockets uses non-standard format: { notification: name, params }
// JsonRPC.swift expects standard format: { jsonrpc: "2.0", method: name, params }
function emitJsonRpc(server: WSServer, eventName: string, params: unknown) {
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

function initServer(
	authHandler: (params: WSParams) => Promise<boolean>,
): Promise<WSServer> {
	const port = getListenPort();
	return new Promise<WSServer>((resolve, reject) => {
		const server = new Server({ host: HOST, port });

		server.on("listening", () => resolve(server));
		server.on("error", (error: WSError) => reject(error));
	}).then(async (server) => {
		await server.setAuth(authHandler);

		await server.event("dataChanged");

		console.info(`WS server listening at ${HOST}:${port}`);
		return server;
	});
}

export { initServer, emitJsonRpc };

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
