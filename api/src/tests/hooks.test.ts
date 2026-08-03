import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { HookRequest, HookResponse } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";
import * as schema from "evy-types/db/schema.generated";
import { Server } from "rpc-websockets";
import {
	EXTERNAL_TEST_RESOURCE,
	EXTERNAL_TEST_SERVICE_ID,
} from "./externalServiceFixture";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
	getFreePort,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

const { create } = await import("../procedures/rpc");

type WSServer = InstanceType<typeof Server>;

const hookCalls: HookRequest[] = [];
let beforeCreateResponse: HookResponse = { ok: true };

function messagePayload(resource: string) {
	return {
		fk: crypto.randomUUID(),
		resource,
		type: "pickup",
		value: "pending",
		data: {
			time: "2026-06-03T09:00:00",
		},
		visibility: "private" as const,
	};
}

async function startHookWsServer(
	port: number,
	options: { registerHook?: boolean } = {},
): Promise<WSServer> {
	const { registerHook = true } = options;
	const server = await new Promise<WSServer>((resolve, reject) => {
		const wsServer = new Server({ host: "127.0.0.1", port });
		wsServer.on("listening", () => resolve(wsServer));
		wsServer.on("error", reject);
	});

	if (registerHook) {
		server.register("hook", (params: HookRequest) => {
			hookCalls.push(params);
			if (params.hook === "before_create") {
				return beforeCreateResponse;
			}
			return { ok: true };
		});
	}

	return server;
}

function stopWsServer(server: WSServer | null): void {
	server?.close();
}

describe("message create hooks", () => {
	let wsPort: number;
	let testServer: WSServer | null = null;
	const originalMarketplaceHost = process.env.MARKETPLACE_WS_HOST;
	const originalMarketplacePort = process.env.MARKETPLACE_WS_PORT;
	const originalRpcTimeout = process.env.SERVICE_RPC_TIMEOUT_MS;

	beforeAll(async () => {
		await migrate(testDb, { migrationsFolder: "./drizzle" });
		wsPort = await getFreePort();
		process.env.MARKETPLACE_WS_HOST = "127.0.0.1";
		process.env.MARKETPLACE_WS_PORT = String(wsPort);
		process.env.SERVICE_RPC_TIMEOUT_MS = "200";

		const nowIso = new Date().toISOString();
		await testDb.insert(schema.service).values({
			id: EXTERNAL_TEST_SERVICE_ID,
			name: "marketplace",
			description: "Marketplace",
			sort_order: 1,
			visibility: "public",
			created_at: nowIso,
			updated_at: nowIso,
		});

		testServer = await startHookWsServer(wsPort);

		const { initServiceAdapters } = await import("../procedures/services");
		await initServiceAdapters(dataDb);
	}, 20_000);

	afterAll(async () => {
		const { disposeServiceAdapters } = await import(
			"../procedures/services"
		);
		disposeServiceAdapters();
		stopWsServer(testServer);
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
		if (originalRpcTimeout === undefined) {
			delete process.env.SERVICE_RPC_TIMEOUT_MS;
		} else {
			process.env.SERVICE_RPC_TIMEOUT_MS = originalRpcTimeout;
		}
		await pgliteClient.close();
	}, 10_000);

	beforeEach(async () => {
		await clearAllTestTables(testDb);
		hookCalls.length = 0;
		beforeCreateResponse = { ok: true };

		const nowIso = new Date().toISOString();
		await testDb.insert(schema.service).values({
			id: EXTERNAL_TEST_SERVICE_ID,
			name: "marketplace",
			description: "Marketplace",
			sort_order: 1,
			visibility: "public",
			created_at: nowIso,
			updated_at: nowIso,
		});
	});

	it("runs before_create then after_create hooks around a message create", async () => {
		const payload = messagePayload(EXTERNAL_TEST_RESOURCE.CONDITIONS);

		const response = await create(
			{
				resource: EVY_CORE_RESOURCE_REF.MESSAGES,
				data: payload,
			},
			dataDb,
		);

		expect(hookCalls.map((call) => ({ hook: call.hook }))).toEqual([
			{ hook: "before_create" },
			{ hook: "after_create" },
		]);
		expect(hookCalls[0]?.data).toEqual(payload);
		expect(hookCalls[1]?.data).toMatchObject({
			id: response.id,
			created_at: response.created_at,
		});

		const rows = await testDb.select().from(schema.message);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe(response.id);
	});

	it("rejects a create when before_create vetoes it", async () => {
		beforeCreateResponse = { ok: false, reason: "item is locked" };
		const payload = messagePayload(EXTERNAL_TEST_RESOURCE.CONDITIONS);

		await expect(
			create(
				{
					resource: EVY_CORE_RESOURCE_REF.MESSAGES,
					data: payload,
				},
				dataDb,
			),
		).rejects.toThrow("item is locked");

		expect(hookCalls).toHaveLength(1);
		expect(hookCalls[0]?.hook).toBe("before_create");

		const rows = await testDb.select().from(schema.message);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			value: "request_failed",
			fk: payload.fk,
			resource: payload.resource,
			type: payload.type,
			data: { reason: "item is locked" },
		});
	});

	it("does not recurse when request_failed itself is vetoed", async () => {
		beforeCreateResponse = { ok: false, reason: "blocked" };
		const payload = {
			...messagePayload(EXTERNAL_TEST_RESOURCE.CONDITIONS),
			value: "request_failed",
		};

		await expect(
			create(
				{
					resource: EVY_CORE_RESOURCE_REF.MESSAGES,
					data: payload,
				},
				dataDb,
			),
		).rejects.toThrow("blocked");

		expect(await testDb.select().from(schema.message)).toHaveLength(0);
	});

	it("skips hooks when the target service is not registered", async () => {
		await create(
			{
				resource: EVY_CORE_RESOURCE_REF.MESSAGES,
				data: messagePayload("ghost_svc.items"),
			},
			dataDb,
		);

		expect(hookCalls).toHaveLength(0);
		expect(await testDb.select().from(schema.message)).toHaveLength(1);
	});

	it("skips hooks when the message addresses a core resource", async () => {
		await create(
			{
				resource: EVY_CORE_RESOURCE_REF.MESSAGES,
				data: messagePayload(EVY_CORE_RESOURCE_REF.FLOWS),
			},
			dataDb,
		);

		expect(hookCalls).toHaveLength(0);
	});

	it("does not run hooks for non-enrolled core resources", async () => {
		const nowIso = new Date().toISOString();
		await create(
			{
				resource: EVY_CORE_RESOURCE_REF.ROWS,
				data: {
					id: crypto.randomUUID(),
					name: "text",
					type: "text",
					visible: "true",
					data: { title: "", text: "Hello" },
					visibility: "public",
					created_at: nowIso,
					updated_at: nowIso,
				},
			},
			dataDb,
		);

		expect(hookCalls).toHaveLength(0);
	});

	it("forwards transaction create hooks to the owning service", async () => {
		const payload = {
			fk: crypto.randomUUID(),
			resource: EXTERNAL_TEST_RESOURCE.CONDITIONS,
			type: "charge",
			status: "succeeded",
			amount: 100,
			currency: "AUD",
			payment_provider_fee: 0,
			service_fee: 0,
			payment_provider: "stripe" as const,
			payment_provider_transaction_id: crypto.randomUUID(),
			signature: "signed",
			authorization_message_id: crypto.randomUUID(),
			visibility: "public" as const,
		};

		const response = await create(
			{
				resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
				data: payload,
			},
			dataDb,
		);

		expect(hookCalls.map((call) => call.hook)).toEqual([
			"before_create",
			"after_create",
		]);
		expect(hookCalls[0]?.resource).toBe(EVY_CORE_RESOURCE_REF.TRANSACTIONS);
		expect(hookCalls[1]?.data).toMatchObject({ id: response.id });
	});
});

describe("message create hooks when service has no hook method", () => {
	const own = createPgliteTestDatabase();
	let wsPort: number;
	let testServer: WSServer | null = null;
	const originalMarketplaceHost = process.env.MARKETPLACE_WS_HOST;
	const originalMarketplacePort = process.env.MARKETPLACE_WS_PORT;
	const originalRpcTimeout = process.env.SERVICE_RPC_TIMEOUT_MS;

	beforeAll(async () => {
		await migrate(own.testDb, { migrationsFolder: "./drizzle" });
		wsPort = await getFreePort();
		process.env.MARKETPLACE_WS_HOST = "127.0.0.1";
		process.env.MARKETPLACE_WS_PORT = String(wsPort);
		process.env.SERVICE_RPC_TIMEOUT_MS = "200";

		const nowIso = new Date().toISOString();
		await own.testDb.insert(schema.service).values({
			id: EXTERNAL_TEST_SERVICE_ID,
			name: "marketplace",
			description: "Marketplace",
			sort_order: 1,
			visibility: "public",
			created_at: nowIso,
			updated_at: nowIso,
		});

		testServer = await startHookWsServer(wsPort, { registerHook: false });

		const { initServiceAdapters } = await import("../procedures/services");
		await initServiceAdapters(asEvyDb(own.testDb));
	}, 20_000);

	afterAll(async () => {
		const { disposeServiceAdapters } = await import(
			"../procedures/services"
		);
		disposeServiceAdapters();
		stopWsServer(testServer);
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
		if (originalRpcTimeout === undefined) {
			delete process.env.SERVICE_RPC_TIMEOUT_MS;
		} else {
			process.env.SERVICE_RPC_TIMEOUT_MS = originalRpcTimeout;
		}
		await own.pgliteClient.close();
	}, 10_000);

	it("succeeds when the service does not implement hook", async () => {
		await create(
			{
				resource: EVY_CORE_RESOURCE_REF.MESSAGES,
				data: messagePayload(EXTERNAL_TEST_RESOURCE.CONDITIONS),
			},
			asEvyDb(own.testDb),
		);

		expect(await own.testDb.select().from(schema.message)).toHaveLength(1);
	});
});
