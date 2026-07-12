import {
	validateStrictCreateRequest,
	validateStrictDeleteRequest,
	validateStrictGetRequest,
	validateStrictUpdateRequest,
} from "evy-types/rpcRequestHelpers";
import { Server } from "rpc-websockets";
import type { WebSocket } from "ws";
import { create, deleteResource, get, update } from "./data";
import { onServiceEvent } from "./events";

export const DATA_CHANGED_EVENT = "dataChanged" as const;

type WSServer = InstanceType<typeof Server>;

function getListenPort(): number {
	const port = process.env.MARKETPLACE_WS_PORT;
	if (!port) {
		throw new Error("MARKETPLACE_WS_PORT environment variable is not set");
	}
	return Number.parseInt(port, 10);
}

function emitJsonRpc(
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

let serverInstance: WSServer | null = null;

type StartMarketplaceRpcOptions = {
	host?: string;
	port?: number;
};

export async function startMarketplaceRpcServer(
	options: StartMarketplaceRpcOptions = {},
): Promise<number> {
	const bindHost = options.host ?? "0.0.0.0";
	const port = options.port ?? getListenPort();

	const server = await new Promise<WSServer>((resolve, reject) => {
		const wsServer = new Server({ host: bindHost, port });
		wsServer.on("listening", () => resolve(wsServer));
		wsServer.on("error", (error: Error) => reject(error));
	});

	await server.event(DATA_CHANGED_EVENT);

	server.register("get", (params: unknown) => {
		validateStrictGetRequest(params);
		return get(params);
	});
	server.register("create", (params: unknown) => {
		validateStrictCreateRequest(params);
		return create(params);
	});
	server.register("update", (params: unknown) => {
		validateStrictUpdateRequest(params);
		return update(params);
	});
	server.register("delete", (params: unknown) => {
		validateStrictDeleteRequest(params);
		return deleteResource(params);
	});

	onServiceEvent((eventName, payload) => {
		emitJsonRpc(server, eventName, payload);
	});

	serverInstance = server;
	console.info(`Marketplace JSON-RPC listening at ${bindHost}:${port}`);
	return port;
}

export function stopMarketplaceRpcServer(): void {
	if (serverInstance) {
		serverInstance.close();
		serverInstance = null;
	}
}
