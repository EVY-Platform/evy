import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { CreateRequest } from "evy-types";
import * as schema from "evy-types/db/schema.generated";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import { DATA_CHANGED_EVENT } from "evy-types/ws";
import { Server } from "rpc-websockets";
import { emitJsonRpc } from "../shared/ws";
import {
	asEvyDb,
	createPgliteTestDatabase,
	getFreePort,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

type WSServer = InstanceType<typeof Server>;

let wsPort: number;
let testServer: WSServer | null = null;
const storedData: { id: string; value: string }[] = [];

async function startTestWsServer(port: number): Promise<WSServer> {
	const server = await new Promise<WSServer>((resolve, reject) => {
		const wsServer = new Server({ host: "127.0.0.1", port });
		wsServer.on("listening", () => resolve(wsServer));
		wsServer.on("error", reject);
	});

	await server.event(DATA_CHANGED_EVENT);

	server.register("get", () => [...storedData]);

	server.register("create", (params: CreateRequest) => {
		const nowIso = new Date().toISOString();
		const rowData = params.data as { id: string; value: string };
		const response = {
			id: rowData.id ?? crypto.randomUUID(),
			resource: params.resource,
			data: rowData,
			createdAt: nowIso,
			updatedAt: nowIso,
		};
		storedData.push(rowData);
		emitJsonRpc(server, DATA_CHANGED_EVENT, {
			service: MARKETPLACE_SERVICE,
			resource: params.resource,
			operation: "create",
			value: rowData,
		});
		return response;
	});

	return server;
}

function stopTestWsServer(): void {
	if (testServer) {
		testServer.close();
		testServer = null;
	}
}

describe("service WebSocket adapters", () => {
	const receivedEvents: unknown[] = [];
	const originalMarketplaceHost = process.env.MARKETPLACE_WS_HOST;
	const originalMarketplacePort = process.env.MARKETPLACE_WS_PORT;

	beforeAll(async () => {
		await migrate(testDb, { migrationsFolder: "./drizzle" });
		wsPort = await getFreePort();
		process.env.MARKETPLACE_WS_HOST = "127.0.0.1";
		process.env.MARKETPLACE_WS_PORT = String(wsPort);

		const nowIso = new Date().toISOString();
		await testDb.insert(schema.service).values({
			id: MARKETPLACE_SERVICE,
			name: "marketplace",
			description: "Marketplace",
			sortOrder: 1,
			createdAt: nowIso,
			updatedAt: nowIso,
		});

		testServer = await startTestWsServer(wsPort);

		const { initServiceAdapters } = await import("../procedures/services");
		await initServiceAdapters(dataDb, (_eventName, payload) => {
			receivedEvents.push(payload);
		});
	});

	afterAll(async () => {
		stopTestWsServer();
		if (originalMarketplaceHost === undefined) {
			delete process.env.MARKETPLACE_WS_HOST;
		} else {
			process.env.MARKETPLACE_WS_HOST = originalMarketplaceHost;
		}
		if (originalMarketplacePort === undefined) {
			delete process.env.MARKETPLACE_WS_PORT;
		} else {
			process.env.MARKETPLACE_WS_PORT = originalMarketplacePort;
		}
		await pgliteClient.close();
	});

	it("forwards one upstream dataChanged event per create", async () => {
		const { forwardCreate } = await import("../procedures/services");
		const row = { id: crypto.randomUUID(), value: "event-once" };
		const eventsBefore = receivedEvents.length;

		await forwardCreate(MARKETPLACE_SERVICE, {
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			data: row,
		});

		expect(receivedEvents.length - eventsBefore).toBe(1);
		expect(receivedEvents.at(-1)).toEqual({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			operation: "create",
			value: row,
		});
	});

	it("still forwards one event per create and RPC works after reconnect", async () => {
		const { forwardCreate, forwardGet } = await import(
			"../procedures/services"
		);

		stopTestWsServer();
		testServer = await startTestWsServer(wsPort);

		const reconnectDeadline = Date.now() + 3000;
		let reconnected = false;
		while (Date.now() < reconnectDeadline) {
			try {
				await forwardGet(MARKETPLACE_SERVICE, {
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.CONDITIONS,
				});
				reconnected = true;
				break;
			} catch {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}
		expect(reconnected).toBe(true);

		const row = { id: crypto.randomUUID(), value: "after-reconnect" };
		const eventsBefore = receivedEvents.length;

		await forwardCreate(MARKETPLACE_SERVICE, {
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			data: row,
		});

		expect(receivedEvents.length - eventsBefore).toBe(1);
		expect(receivedEvents.at(-1)).toEqual({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			operation: "create",
			value: row,
		});

		const got = await forwardGet(MARKETPLACE_SERVICE, {
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
		});
		expect(got).toEqual(expect.arrayContaining([row]));
	});
});
