import { Server, type IRPCMethodParams } from "rpc-websockets";
import type { WebSocket } from "ws";
import type { GetRequest, GetResponse } from "evy-types";
import { createDb } from "./database/db";
import {
	initCoreNotifications,
	validateAuth,
	get as getCore,
} from "./data/data";
import {
	api,
	create,
	deleteResource,
	get,
	sync,
	update,
} from "./procedures/rpc";
import { resources } from "./procedures/resources";
import { wireGrpcEvents } from "./procedures/services";
import { cancelUpload, handleUploadChunk } from "./procedures/uploads";

type WSServer = typeof Server;
export type WSParams = typeof IRPCMethodParams;

const appDb = createDb();

// ---- WebSocket helpers ----

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
		server.on("error", (error) => reject(error));
	}).then(async (server) => {
		await server.setAuth(authHandler);

		await server.event("dataChanged");

		console.info(`WS server listening at 0.0.0.0:${port}`);
		return server;
	});
}

function makeAuthChecker(server: WSServer): (socket: WebSocket) => boolean {
	return (socket: WebSocket) => {
		const namespace = server.namespaces["/"];
		if (!namespace) return false;
		const clients: Map<string, WebSocket> = namespace.clients || new Map();
		return [...clients.values()].some((s) => s === socket);
	};
}

function wireBinaryChunkHandler(
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

// ---- Health/readiness check (CLI entry point) ----

type AssertApiReadableOptions = {
	requireSeeded: boolean;
};

type ApiReadableDeps = {
	get: (params: GetRequest) => Promise<GetResponse>;
};

export async function assertApiReadable(
	options: AssertApiReadableOptions,
	deps: ApiReadableDeps = { get: (params) => getCore(appDb, params) },
): Promise<void> {
	const { requireSeeded } = options;
	const response = await deps.get({ service: "evy", resource: "sdui" });
	if (!Array.isArray(response)) {
		throw new Error("API readiness failed: expected sdui response data array");
	}

	if (!requireSeeded) {
		return;
	}

	if (response.length === 0) {
		throw new Error("Seed verification failed: missing seeded SDUI flows");
	}
}

async function runHealthCli(): Promise<void> {
	const requireSeededData = process.argv.includes("--require-seeded");
	try {
		await assertApiReadable({ requireSeeded: requireSeededData });
		console.info(
			requireSeededData ? "API seeded-data readiness OK" : "API readiness OK",
		);
		process.exit(0);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

// ---- WebSocket server entry point ----

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(appDb, data.token, data.os);
}

async function startServer(): Promise<void> {
	const server = await initServer(authHandler);
	const broadcast = (eventName: string, payload: unknown) => {
		emitJsonRpc(server, eventName, payload);
	};

	initCoreNotifications(broadcast);
	wireGrpcEvents(broadcast);

	server.register("resources", resources);
	server.register("api", (params) => api(params, appDb));
	server.register("sync", (params) => sync(params)).protected();
	server.register("cancelUpload", cancelUpload).protected();

	server.register("get", (params) => get(params, appDb));
	server.register("create", (params) => create(params, appDb)).protected();
	server.register("update", (params) => update(params, appDb)).protected();
	server
		.register("delete", (params) => deleteResource(params, appDb))
		.protected();

	wireBinaryChunkHandler(server, makeAuthChecker(server), handleUploadChunk);
}

if (import.meta.main) {
	if (
		process.argv.some((arg) => arg === "--health" || arg === "--require-seeded")
	) {
		await runHealthCli();
	} else {
		await startServer();
	}
}
