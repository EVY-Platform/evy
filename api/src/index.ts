import dotenv from "dotenv";
dotenv.config();

import { validateAuth, primeData, getNewDataSince, crud } from "./data.js";
import { initServer, WSParams } from "./ws.js";

function authHandler(data: WSParams): Promise<boolean> {
	return validateAuth(data.token, data.os);
}

async function main() {
	const server = await initServer(authHandler);

	primeData();

	server
		.register("getNewDataSince", async (data: WSParams) => {
			return getNewDataSince(data.since);
		})
		.protected();

	server
		.register("crud", async (data: WSParams) => {
			return crud(data.method, data.model, data.filter, data.data);
		})
		.protected();
}

main();
