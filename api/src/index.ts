import { validateAuth } from "./data";
import { initDataNotifications } from "./notifications";
import { api, create, get, sync, update } from "./rpc";
import { resources } from "./resources";
import { wireGrpcEvents } from "./services";
import { emitJsonRpc, initServer, type WSParams } from "./ws";

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

	server.register("get", get);
	server.register("create", create).protected();
	server.register("update", update).protected();
	server.register("api", api);
	server.register("sync", sync).protected();
	server.register("resources", resources);
}

main();
