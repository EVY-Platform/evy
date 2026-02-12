import { validateAuth, primeData, get, upsert } from "./data";
import { initServer, emitJsonRpc, WSParams } from "./ws";

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(data.token, data.os);
}

async function main() {
	const server = await initServer(authHandler);

	primeData();

	server.register("get", async (params: WSParams) => {
		return get(params);
	});

	server
		.register("upsert", async (params: WSParams) => {
			const result = await upsert(params);
			const resource = (params as { resource?: string }).resource;
			if (resource === "SDUI") {
				emitJsonRpc(server, "flowUpdated", result);
			} else {
				emitJsonRpc(server, "dataUpdated", result);
			}
			return result;
		})
		.protected();
}

main();
