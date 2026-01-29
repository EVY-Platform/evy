import { Server, IRPCError, IRPCMethodParams } from "rpc-websockets";

type WSServer = typeof Server;
type WSError = typeof IRPCError;
export type WSParams = typeof IRPCMethodParams;

const PORT: number = parseInt(process.env.API_PORT || "8000");
const HOST: string = "0.0.0.0";

// Custom emit function that sends proper JSON-RPC 2.0 notifications
// rpc-websockets uses non-standard format: { notification: name, params }
// JsonRPC.swift expects standard format: { jsonrpc: "2.0", method: name, params }
function emitJsonRpc(server: WSServer, eventName: string, params: unknown) {
	// Access the internal namespace structure directly
	// @ts-expect-error - accessing internal property
	const namespace = server.namespaces["/"];
	const nsEvent = namespace?.events?.[eventName];
	const eventSockets: string[] = nsEvent?.sockets || [];
	const clients: Map<string, WebSocket> = namespace?.clients || new Map();

	console.log(`[WS] emitJsonRpc called for event: ${eventName}`);
	console.log(
		`[WS] All events: ${JSON.stringify(Object.keys(namespace?.events || {}))}`,
	);
	console.log(
		`[WS] Sockets subscribed to ${eventName}: ${JSON.stringify(eventSockets)}`,
	);
	console.log(
		`[WS] Connected clients: ${JSON.stringify(Array.from(clients.keys()))}`,
	);

	const message = JSON.stringify({
		jsonrpc: "2.0",
		method: eventName,
		params: params,
	});

	if (eventSockets.length === 0) {
		console.log(`[WS] No sockets subscribed to ${eventName}, message not sent`);
	}

	for (const socketId of eventSockets) {
		console.log(`[WS] Emitting ${eventName} to socket ${socketId}`);
		const socket = clients.get(socketId);
		if (socket) {
			socket.send(message);
			console.log(`[WS] Message sent successfully to ${socketId}`);
		} else {
			console.log(`[WS] Socket ${socketId} not found in clients`);
		}
	}
}

function initServer(
	authHandler: (params: WSParams) => Promise<boolean>,
): Promise<WSServer> {
	return new Promise<WSServer>((resolve, reject) => {
		const server = new Server({ host: HOST, port: PORT });

		server.on("listening", () => resolve(server));
		server.on("error", (error: WSError) => reject(error));
	}).then((server) => {
		server.setAuth(authHandler);

		server.event("dataUpdated");
		server.event("flowUpdated");

		console.info(`WS server listening at ${HOST}:${PORT}`);
		return server;
	});
}

export { initServer, emitJsonRpc };
