import { createDb } from "./database/db";
import { initCoreNotifications, validateAuth } from "./data/data";
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
import {
	emitJsonRpc,
	initServer,
	makeAuthChecker,
	wireBinaryChunkHandler,
	type WSParams,
} from "./shared/ws";
import { runHealthCli } from "./readiness";

export { assertApiReadable } from "./readiness";
export {
	emitJsonRpc,
	initServer,
	makeAuthChecker,
	wireBinaryChunkHandler,
} from "./shared/ws";
export type { WSParams } from "./shared/ws";

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
	wireGrpcEvents(broadcast);

	server.register("resources", resources);
	server.register("api", (params: unknown) => api(params, appDb));
	server.register("sync", (params: unknown) => sync(params, appDb)).protected();
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
		process.argv.some((arg) => arg === "--health" || arg === "--require-seeded")
	) {
		await runHealthCli();
	} else {
		await startServer();
	}
}
