import { DATA_CHANGED_EVENT } from "evy-types/ws";
import {
	emitJsonRpc,
	requirePortEnv,
	startWsServer,
	type WSParams,
	type WSServer,
} from "evy-types/wsServer";
import type { WebSocket } from "ws";

export { emitJsonRpc, type WSParams, type WSServer };

export async function initServer(
	authHandler: (params: WSParams) => Promise<boolean>,
): Promise<WSServer> {
	const port = requirePortEnv("API_PORT");
	const server = await startWsServer({ port });

	await server.setAuth(authHandler);

	await server.event(DATA_CHANGED_EVENT);

	console.info(`WS server listening at 0.0.0.0:${port}`);
	return server;
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
