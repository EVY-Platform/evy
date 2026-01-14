import {
	validateAuth,
	primeData,
	getNewDataSince,
	crud,
	getFlows,
	saveFlow,
} from "./data";
import { initServer, WSParams } from "./ws";

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(data.token, data.os);
}

async function main() {
	const server = await initServer(authHandler);

	primeData();

	server
		.register("getData", async (data: WSParams) => {
			return getNewDataSince(data.since);
		})
		.protected();

	server
		.register("getFlows", async (data: WSParams) => {
			return getFlows(data.since);
		})
		.protected();

	server
		.register("saveFlow", async (data: WSParams) => {
			return saveFlow(data.flowData, data.flowId);
		})
		.protected();

	server
		.register("crud", async (data: WSParams) => {
			return crud(data.method, data.model, data.filter, data.data);
		})
		.protected();
}

main();
