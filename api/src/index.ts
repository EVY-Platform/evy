import {
	validateAuth,
	primeData,
	crud,
	getSDUI,
	updateSDUI,
	getData,
	saveData,
} from "./data";
import { initServer, emitJsonRpc, WSParams } from "./ws";

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
			const result = await saveData(params.dataPayload, params.dataId);
			emitJsonRpc(server, "dataUpdated", result);
			return result;
		})
		.protected();

	server
		.register("getSDUI", async (data: WSParams) => {
			return getSDUI(data.since);
		})
		.protected();

	server
		.register("updateSDUI", async (data: WSParams) => {
			const result = await updateSDUI(data.flowData, data.flowId);
			emitJsonRpc(server, "flowUpdated", result);
			return result;
		})
		.protected();

	server
		.register("crud", async (data: WSParams) => {
			return crud(data.method, data.model, data.filter, data.data);
		})
		.protected();
}

main();
