import { validateAuth } from "./data/devices";
import { initDataNotifications } from "./notifications";
import {
	api,
	create,
	delete as deleteResource,
	get,
	sync,
	update,
} from "./procedures/rpc";
import { resources } from "./procedures/resources";
import { wireGrpcEvents } from "./procedures/services";
import {
	emitJsonRpc,
	initServer,
	wireBinaryChunkHandler,
	makeAuthChecker,
	type WSParams,
} from "./ws";
import { cancelUpload, handleUploadChunk } from "./procedures/uploads";

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(data.token, data.os);
}

async function main() {
	const server = await initServer(authHandler);
	const broadcast = (eventName: string, payload: unknown) => {
		emitJsonRpc(server, eventName, payload);
	};

	initDataNotifications(broadcast);
	wireGrpcEvents(broadcast);

	server.register("resources", resources);
	server.register("api", api);
	server.register("sync", sync).protected();
	server.register("cancelUpload", cancelUpload).protected();

	server.register("get", get);
	server.register("create", create).protected();
	server.register("update", update).protected();
	server.register("delete", deleteResource).protected();

	wireBinaryChunkHandler(server, makeAuthChecker(server), handleUploadChunk);
}

main();
