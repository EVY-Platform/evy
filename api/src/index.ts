import dotenv from "dotenv";
dotenv.config();

import {
	validateAuth,
	createService,
	createOrganization,
	createServiceProvider,
	fetchServicesData,
} from "./data.js";
import { initServer, WSParams } from "./ws.js";
import { isCorrectDate } from "./utils.js";

function authHandler(params: WSParams): Promise<boolean> {
	return validateAuth(params.token, params.os);
}

async function main() {
	const server = await initServer(authHandler);

	server.register("createService", createService).protected();
	server.register("createOrganization", createOrganization).protected();
	server.register("createServiceProvider", createServiceProvider).protected();

	server
		.register("fetchServicesData", async (since?: number) => {
			const hasValidSince = since && isCorrectDate(new Date(since));
			return fetchServicesData(
				hasValidSince ? new Date(since) : undefined,
			);
		})
		.protected();
}

main();
