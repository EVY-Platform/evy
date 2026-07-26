import {
	validateStrictCreateRequest,
	validateStrictDeleteRequest,
	validateStrictGetRequest,
	validateStrictUpdateRequest,
} from "evy-types/rpcRequestHelpers";
import {
	emitJsonRpc,
	requirePortEnv,
	startWsServer,
	type WSServer,
} from "evy-types/wsServer";
import { create, deleteResource, get, update } from "./data";
import { DATA_CHANGED_EVENT, onServiceEvent } from "./events";
import { getMarketplaceResourcesResponse } from "./resources";

let serverInstance: WSServer | null = null;

type StartMarketplaceRpcOptions = {
	host?: string;
	port?: number;
};

export async function startMarketplaceRpcServer(
	options: StartMarketplaceRpcOptions = {},
): Promise<number> {
	const bindHost = options.host ?? "0.0.0.0";
	const port = options.port ?? requirePortEnv("MARKETPLACE_WS_PORT");

	const server = await startWsServer({ host: bindHost, port });

	await server.event(DATA_CHANGED_EVENT);

	server.register("get", (params: unknown) => {
		validateStrictGetRequest(params);
		return get(params);
	});
	server.register("create", (params: unknown) => {
		validateStrictCreateRequest(params);
		return create(params);
	});
	server.register("update", (params: unknown) => {
		validateStrictUpdateRequest(params);
		return update(params);
	});
	server.register("delete", (params: unknown) => {
		validateStrictDeleteRequest(params);
		return deleteResource(params);
	});
	server.register("resources", () => getMarketplaceResourcesResponse());

	onServiceEvent((eventName, payload) => {
		emitJsonRpc(server, eventName, payload);
	});

	serverInstance = server;
	console.info(`Marketplace JSON-RPC listening at ${bindHost}:${port}`);
	return port;
}

export function stopMarketplaceRpcServer(): void {
	if (serverInstance) {
		serverInstance.close();
		serverInstance = null;
	}
}
