import { validateAuth } from "./data";
import { initDataNotifications } from "./notifications";
import { api, create, get, sync, update } from "./rpc";
import { resources } from "./resources";
import { wireGrpcEvents } from "./services";
import {
	emitJsonRpc,
	initServer,
	wireBinaryChunkHandler,
	makeAuthChecker,
	type WSParams,
} from "./ws";
import { createImageHandlers } from "./images";

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(data.token, data.os);
}

async function main() {
	const server = await initServer(authHandler);
	const {
		handleImageUploadChunk,
		completeImageUpload,
		cancelImageUpload,
		getImage,
		deleteImage,
	} = createImageHandlers();
	const broadcast = (eventName: string, payload: unknown) => {
		emitJsonRpc(server, eventName, payload);
	};

	initDataNotifications(broadcast);
	wireGrpcEvents(broadcast);

	server.register("get", get);
	server.register("create", create).protected();
	server.register("update", update).protected();
	server.register("api", api);
	server.register("sync", sync).protected();
	server.register("resources", resources);
	server.register("completeImageUpload", completeImageUpload).protected();
	server.register("cancelImageUpload", cancelImageUpload).protected();
	server.register("getImage", getImage);
	server.register("deleteImage", deleteImage).protected();

	wireBinaryChunkHandler(
		server,
		makeAuthChecker(server),
		handleImageUploadChunk,
	);
}

main();
