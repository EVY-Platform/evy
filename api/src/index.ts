import {
	validateAuth,
	primeData,
	crud,
	getSDUI,
	saveFlow,
	getData,
	saveData,
} from "./data";
import { initServer, WSParams } from "./ws";

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(data.token, data.os);
}

async function main() {
	const server = await initServer(authHandler);

	primeData();

	server
		.register("getData", async (params: WSParams) => {
			return getData(params.since);
		})
		.protected();

	server
		.register("saveData", async (params: WSParams) => {
			return saveData(params.dataPayload, params.dataId);
		})
		.protected();

	server
		.register("getSDUI", async (data: WSParams) => {
			return getSDUI(data.since);
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
