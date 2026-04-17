import { initServer, type WSParams } from "./ws";
import { validateAuth } from "./data";
import { get, upsert, wireServerEvents } from "./rpc";

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(data.token, data.os);
}

async function main() {
	const server = await initServer(authHandler);
	wireServerEvents(server);

	server.register("get", get);

	server.register("upsert", upsert).protected();
}

main();
