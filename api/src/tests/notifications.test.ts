import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { CreateRequest, DATA_EVY_Flow } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";
import type { WSParams } from "../shared/ws";

import {
	asEvyDb,
	clearAllTestTables,
	connectAndLogin,
	createPgliteTestDatabase,
	getFreePort,
	type WSServer,
	waitForNotification,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

const coreModule = await import("../data/data");
const { create, initCoreNotifications, validateAuth } = coreModule;

describe("create/update real-time notifications", () => {
	let previousApiPort: string | undefined;
	let apiPort: number;
	let apiUrl: string;
	let initServer: typeof import("../shared/ws")["initServer"];
	let emitJsonRpc: typeof import("../shared/ws")["emitJsonRpc"];
	let server: WSServer;

	beforeAll(async () => {
		await migrate(testDb, { migrationsFolder: "./drizzle" });
		await clearAllTestTables(testDb);

		previousApiPort = process.env.API_PORT;
		apiPort = await getFreePort();
		process.env.API_PORT = String(apiPort);
		const wsMod = await import("../shared/ws");
		initServer = wsMod.initServer;
		emitJsonRpc = wsMod.emitJsonRpc;

		server = await initServer((params: WSParams) =>
			validateAuth(dataDb, params.token, params.os),
		);
		initCoreNotifications((eventName, payload) => {
			emitJsonRpc(server, eventName, payload);
		});

		server
			.register("create", async (params: unknown) =>
				create(dataDb, params as unknown as CreateRequest),
			)
			.protected();

		apiUrl = `ws://127.0.0.1:${apiPort}`;
	});

	afterAll(async () => {
		await server.close();
		if (previousApiPort === undefined) {
			delete process.env.API_PORT;
		} else {
			process.env.API_PORT = previousApiPort;
		}
		await pgliteClient.close();
	});

	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("emits dataChanged with create operation after flow create", async () => {
		const subscriber = await connectAndLogin(
			apiUrl,
			"notify-token-1",
			"web",
			"data_changed",
		);
		const notifyPromise = waitForNotification(subscriber, "data_changed");

		const nowIso = new Date().toISOString();
		const flowData: DATA_EVY_Flow = {
			id: crypto.randomUUID(),
			name: "WS Notify Flow",
			page_ids: [],
			visibility: "public",
			created_at: nowIso,
			updated_at: nowIso,
		};

		const caller = await connectAndLogin(apiUrl, "notify-token-2", "web");

		const createResult = await caller.call("create", {
			resource: EVY_CORE_RESOURCE_REF.FLOWS,
			data: flowData,
		});

		const params = await notifyPromise;
		expect(params).toEqual({
			resource: EVY_CORE_RESOURCE_REF.FLOWS,
			operation: "create",
			value: createResult,
		});

		subscriber.close();
		caller.close();
	});

	it("emits dataChanged after non-flow create with sync-row shape", async () => {
		const subscriber = await connectAndLogin(
			apiUrl,
			"notify-token-3",
			"web",
			"data_changed",
		);
		const notifyPromise = waitForNotification(subscriber, "data_changed");

		const caller = await connectAndLogin(apiUrl, "notify-token-4", "web");

		const nowIso = new Date().toISOString();
		const serviceId = "notify_svc";
		const payload = {
			id: serviceId,
			name: "NotifySvc",
			description: "D",
			visibility: "public",
			created_at: nowIso,
			updated_at: nowIso,
		};
		const createResult = await caller.call("create", {
			resource: EVY_CORE_RESOURCE_REF.SERVICES,
			data: payload,
		});

		const params = await notifyPromise;
		expect(params).toEqual({
			resource: EVY_CORE_RESOURCE_REF.SERVICES,
			operation: "create",
			value: createResult,
		});

		subscriber.close();
		caller.close();
	});

	it("only subscribed clients receive dataChanged", async () => {
		const subscribed = await connectAndLogin(
			apiUrl,
			"notify-token-5",
			"web",
			"data_changed",
		);
		const notifyPromise = waitForNotification(subscribed, "data_changed");

		const notSubscribed = await connectAndLogin(
			apiUrl,
			"notify-token-6",
			"web",
		);
		let unexpected = false;
		notSubscribed.on("data_changed", () => {
			unexpected = true;
		});

		const caller = await connectAndLogin(apiUrl, "notify-token-7", "web");
		await caller.call("create", {
			resource: EVY_CORE_RESOURCE_REF.FLOWS,
			data: {
				id: crypto.randomUUID(),
				name: "Subscribed Only",
				page_ids: [],
				visibility: "public",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
		});

		await notifyPromise;
		expect(unexpected).toBe(false);

		const sentinelPromise = waitForNotification(subscribed, "data_changed");
		await caller.call("create", {
			resource: EVY_CORE_RESOURCE_REF.FLOWS,
			data: {
				id: crypto.randomUUID(),
				name: "Subscribed Only Again",
				page_ids: [],
				visibility: "public",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
		});
		await sentinelPromise;
		expect(unexpected).toBe(false);

		subscribed.close();
		notSubscribed.close();
		caller.close();
	});
});
