import { initServer, emitJsonRpc, type WSParams } from "./ws";
import type { GetRequest } from "evy-types/rpc/get.request";
import { get, isRecord, isResource, upsert, validateAuth } from "./data";

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(data.token, data.os);
}

function hasResource(p: unknown): p is { resource: GetRequest["resource"] } {
	return isRecord(p) && "resource" in p && isResource(p.resource);
}

async function main() {
	const server = await initServer(authHandler);

	server.register("get", async (params: WSParams) => {
		console.log("get", params);
		return get(params);
	});

	server
		.register("upsert", async (params: WSParams) => {
			console.log("upsert", params);
			const result = await upsert(params);
			if (!hasResource(params)) return result;
			if (params.resource === "SDUI") {
				emitJsonRpc(server, "flowUpdated", result);
			} else {
				emitJsonRpc(server, "dataUpdated", result);
			}
			return result;
		})
		.protected();
}

main();
