import { validateAuth } from "./data";
import { api, get, initRpc, syncServiceData, upsert } from "./rpc";
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

	initRpc(broadcast);
	wireGrpcEvents(broadcast);

	server.register("get", get);
	server.register("upsert", upsert).protected();
	server.register("api", api);
	server.register("syncServiceData", syncServiceData).protected();
	server.register("resources", resources);
}

main();
