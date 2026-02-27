import { Server, IRPCError, IRPCMethodParams } from "rpc-websockets";

type WSServer = typeof Server;
type WSError = typeof IRPCError;
export type WSParams = typeof IRPCMethodParams;

const apiPort = process.env.API_PORT;
if (apiPort === undefined || apiPort === "") {
	throw new Error("API_PORT is required");
}
const PORT: number = Number.parseInt(apiPort, 10);
const HOST: string = "0.0.0.0";

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
