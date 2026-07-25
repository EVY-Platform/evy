import { initCoreNotifications, validateAuth } from "./data/data";
import { purgeTombstones } from "./data/tombstones";
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

	server.register("api", (params: unknown, socketId: string) =>
		api(params, appDb, socketId),
	);
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

/**
 * Deletes tombstones past the retention window. Meant to be run on a schedule
 * (cron, a k8s CronJob) rather than from the serving process, so a long delete
 * never competes with request handling.
 */
async function runPurgeTombstonesCli(): Promise<void> {
	const result = await purgeTombstones(appDb);
	console.info(
		`Purged ${result.total} tombstone(s) deleted before ${result.horizon}` +
			(result.total > 0 ? `: ${JSON.stringify(result.purged)}` : ""),
	);
}

if (import.meta.main) {
	if (
		process.argv.some(
			(arg) => arg === "--health" || arg === "--require-seeded",
		)
	) {
		await runHealthCli();
	} else if (process.argv.includes("--purge-tombstones")) {
		await runPurgeTombstonesCli();
		process.exit(0);
	} else {
		await startServer();
	}
}
