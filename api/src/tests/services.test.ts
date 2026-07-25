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
import { resolveServiceWsEndpoint } from "../procedures/services";
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

describe("resolveServiceWsEndpoint", () => {
	const base = { id: MARKETPLACE_SERVICE, name: "marketplace" };

	function withEnv(
		host: string | undefined,
		port: string | undefined,
		body: () => void,
	) {
		const savedHost = process.env.MARKETPLACE_WS_HOST;
		const savedPort = process.env.MARKETPLACE_WS_PORT;
		if (host === undefined) delete process.env.MARKETPLACE_WS_HOST;
		else process.env.MARKETPLACE_WS_HOST = host;
		if (port === undefined) delete process.env.MARKETPLACE_WS_PORT;
		else process.env.MARKETPLACE_WS_PORT = port;
		try {
			body();
		} finally {
			if (savedHost !== undefined)
				process.env.MARKETPLACE_WS_HOST = savedHost;
			else delete process.env.MARKETPLACE_WS_HOST;
			if (savedPort !== undefined)
				process.env.MARKETPLACE_WS_PORT = savedPort;
			else delete process.env.MARKETPLACE_WS_PORT;
		}
	}

	it("prefers the endpoint on the service row", () => {
		withEnv("env-host", "9999", () => {
			expect(
				resolveServiceWsEndpoint({
					...base,
					wsHost: "row-host",
					wsPort: 8001,
				}),
			).toEqual({ host: "row-host", port: "8001" });
		});
	});

	it("falls back to the env convention when the row has no endpoint", () => {
		withEnv("env-host", "9999", () => {
			expect(
				resolveServiceWsEndpoint({
					...base,
					wsHost: null,
					wsPort: null,
				}),
			).toEqual({ host: "env-host", port: "9999" });
		});
	});

	// Half a row endpoint is not an endpoint; fall through rather than guess.
	it("falls back when the row has a host but no port", () => {
		withEnv("env-host", "9999", () => {
			expect(
				resolveServiceWsEndpoint({
					...base,
					wsHost: "row-host",
					wsPort: null,
				}),
			).toEqual({ host: "env-host", port: "9999" });
		});
	});

	it("throws naming the service when nothing is configured", () => {
		withEnv(undefined, undefined, () => {
			expect(() =>
				resolveServiceWsEndpoint({
					...base,
					wsHost: null,
					wsPort: null,
				}),
			).toThrow("marketplace");
		});
	});

	// The env fallback builds a variable name from the service name, so a name
	// that cannot be one must say so rather than silently looking up "".
	it("rejects a service name that cannot form an env var", () => {
		expect(() =>
			resolveServiceWsEndpoint({
				id: MARKETPLACE_SERVICE,
				name: "my service!",
				wsHost: null,
				wsPort: null,
			}),
		).toThrow("cannot be used for env lookup");
	});

	it("accepts a name-derived env var with digits and underscores", () => {
		const savedHost = process.env.SVC_2_WS_HOST;
		const savedPort = process.env.SVC_2_WS_PORT;
		process.env.SVC_2_WS_HOST = "h";
		process.env.SVC_2_WS_PORT = "1";
		try {
			expect(
				resolveServiceWsEndpoint({
					id: MARKETPLACE_SERVICE,
					name: "svc_2",
					wsHost: null,
					wsPort: null,
				}),
			).toEqual({ host: "h", port: "1" });
		} finally {
			if (savedHost !== undefined) process.env.SVC_2_WS_HOST = savedHost;
			else delete process.env.SVC_2_WS_HOST;
			if (savedPort !== undefined) process.env.SVC_2_WS_PORT = savedPort;
			else delete process.env.SVC_2_WS_PORT;
		}
	});
});

describe("forwarded call failures are attributed", () => {
	const serviceId = MARKETPLACE_SERVICE;
	let slowPort: number;
	let slowServer: WSServer | null = null;
	const savedHost = process.env.MARKETPLACE_WS_HOST;
	const savedPort = process.env.MARKETPLACE_WS_PORT;
	const savedTimeout = process.env.SERVICE_RPC_TIMEOUT_MS;

	// The shared pglite client is closed by the adapter describe above, so this
	// one owns its database rather than depending on another describe's state.
	const own = createPgliteTestDatabase();

	beforeAll(async () => {
		await migrate(own.testDb, { migrationsFolder: "./drizzle" });
		const nowIso = new Date().toISOString();
		await own.testDb.insert(schema.service).values({
			id: serviceId,
			name: "marketplace",
			description: "Marketplace",
			sortOrder: 1,
			createdAt: nowIso,
			updatedAt: nowIso,
		});

		slowPort = await getFreePort();
		process.env.MARKETPLACE_WS_HOST = "127.0.0.1";
		process.env.MARKETPLACE_WS_PORT = String(slowPort);
		process.env.SERVICE_RPC_TIMEOUT_MS = "150";

		slowServer = await new Promise<WSServer>((resolve, reject) => {
			const wsServer = new Server({ host: "127.0.0.1", port: slowPort });
			wsServer.on("listening", () => resolve(wsServer));
			wsServer.on("error", reject);
		});
		await slowServer.event(DATA_CHANGED_EVENT);
		// Never settles, so the caller has to time out.
		slowServer.register("get", () => new Promise(() => {}));
		slowServer.register("create", () => {
			throw new Error("marketplace exploded");
		});

		const { initServiceAdapters } = await import("../procedures/services");
		await initServiceAdapters(asEvyDb(own.testDb));
	});

	afterAll(async () => {
		slowServer?.close();
		slowServer = null;
		await own.pgliteClient.close();
		if (savedHost === undefined) delete process.env.MARKETPLACE_WS_HOST;
		else process.env.MARKETPLACE_WS_HOST = savedHost;
		if (savedPort === undefined) delete process.env.MARKETPLACE_WS_PORT;
		else process.env.MARKETPLACE_WS_PORT = savedPort;
		if (savedTimeout === undefined)
			delete process.env.SERVICE_RPC_TIMEOUT_MS;
		else process.env.SERVICE_RPC_TIMEOUT_MS = savedTimeout;
	});

	it("times out a hung service instead of stalling forever", async () => {
		const { forwardGet, ServiceForwardError } = await import(
			"../procedures/services"
		);
		const failure = await forwardGet(serviceId, {
			service: serviceId,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ServiceForwardError);
		const err = failure as InstanceType<typeof ServiceForwardError>;
		expect(err.data).toMatchObject({
			serviceId,
			serviceName: "marketplace",
			code: "SERVICE_TIMEOUT",
		});
		expect(err.message).toContain("marketplace");
	});

	it("attributes a service-side failure to the service", async () => {
		const { forwardCreate, ServiceForwardError } = await import(
			"../procedures/services"
		);
		const failure = await forwardCreate(serviceId, {
			service: serviceId,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			data: { id: crypto.randomUUID(), value: "x" },
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ServiceForwardError);
		const err = failure as InstanceType<typeof ServiceForwardError>;
		expect(err.data).toMatchObject({ serviceId, code: "SERVICE_ERROR" });
		expect(err.message).toContain("marketplace");
	});
});
