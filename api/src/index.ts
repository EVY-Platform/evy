import { initCoreNotifications, validateAuth } from "./data/data";
import { createDb } from "./database/db";
import { syncMethod } from "./procedures/coreApi";
import { api, create, deleteResource, get, update } from "./procedures/rpc";
import { initServiceAdapters } from "./procedures/services";
import { cancelUpload, handleUploadChunk } from "./procedures/uploads";
import { runHealthCli } from "./readiness";
import {
	emitJsonRpc,
	initServer,
	makeAuthChecker,
	type WSParams,
	wireBinaryChunkHandler,
} from "./shared/ws";

const appDb = createDb();

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(appDb, data.token, data.os);
}

async function startServer(): Promise<void> {
	const server = await initServer(authHandler);
	const broadcast = (eventName: string, payload: unknown) => {
		emitJsonRpc(server, eventName, payload);
	};

	initCoreNotifications(broadcast);
	await initServiceAdapters(appDb, broadcast);

	server.register("api", (params: unknown) => api(params, appDb));
	// sync is a first-class method; api{method:"sync"} still works for clients
	// that have not moved over.
	server.register("sync", (params: unknown) => syncMethod(params, appDb));
	server.register("cancelUpload", cancelUpload).protected();

	server.register("get", (params: unknown) => get(params, appDb));
	server
		.register("create", (params: unknown) => create(params, appDb))
		.protected();
	server
		.register("update", (params: unknown) => update(params, appDb))
		.protected();
	server
		.register("delete", (params: unknown) => deleteResource(params, appDb))
		.protected();

	wireBinaryChunkHandler(server, makeAuthChecker(server), handleUploadChunk);
}

if (import.meta.main) {
	if (
		process.argv.some(
			(arg) => arg === "--health" || arg === "--require-seeded",
		)
	) {
		await runHealthCli();
	} else {
		await startServer();
	}
}
