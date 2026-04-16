import { initServer, type WSParams } from "./ws";
import { validateAuth } from "./coreData";
import { get, setMainServerForRpc, upsert } from "./rpc";
import { setMainServerForServices } from "./services";

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(data.token, data.os);
}

async function main() {
	const server = await initServer(authHandler);
	setMainServerForRpc(server);
	setMainServerForServices(server);

	server.register("get", get);

	server.register("upsert", upsert).protected();
}

main();
