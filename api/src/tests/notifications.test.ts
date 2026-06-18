import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { CreateRequest, UI_Flow, UI_Page } from "evy-types";
import type { WSParams } from "../shared/ws";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";

import {
	asEvyDb,
	clearAllTestTables,
	connectAndLogin,
	createPgliteTestDatabase,
	getFreePort,
	waitForNotification,
	type WSServer,
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

	it("emits dataChanged with create operation after SDUI create", async () => {
		const subscriber = await connectAndLogin(
			apiUrl,
			"notify-token-1",
			"Web",
			"dataChanged",
		);
		const notifyPromise = waitForNotification(subscriber, "dataChanged");

		const testPage: UI_Page = {
			id: crypto.randomUUID(),
			title: "Page",
			rows: [],
		};
		const flowData: UI_Flow = {
			id: crypto.randomUUID(),
			name: "WS Notify Flow",
			pages: [testPage],
		};

		const caller = await connectAndLogin(apiUrl, "notify-token-2", "Web");

		await caller.call("create", {
			service: EVY_CORE_SERVICE,
			resource: "sdui",
			data: flowData,
		});

		const params = await notifyPromise;
		expect(params).toEqual({
			service: EVY_CORE_SERVICE,
			resource: "sdui",
			operation: "create",
			value: flowData,
		});

		subscriber.close();
		caller.close();
	});

	it("emits dataChanged after non-SDUI create with sync-row shape", async () => {
		const subscriber = await connectAndLogin(
			apiUrl,
			"notify-token-3",
			"Web",
			"dataChanged",
		);
		const notifyPromise = waitForNotification(subscriber, "dataChanged");

		const caller = await connectAndLogin(apiUrl, "notify-token-4", "Web");

		const nowIso = new Date().toISOString();
		const serviceId = crypto.randomUUID();
		const payload = {
			id: serviceId,
			name: "NotifySvc",
			description: "D",
			createdAt: nowIso,
			updatedAt: nowIso,
		};
		const createResult = await caller.call("create", {
			service: EVY_CORE_SERVICE,
			resource: "services",
			data: payload,
		});

		const params = await notifyPromise;
		expect(params).toEqual({
			service: EVY_CORE_SERVICE,
			resource: "services",
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
			"Web",
			"dataChanged",
		);
		const notifyPromise = waitForNotification(subscribed, "dataChanged");

		const notSubscribed = await connectAndLogin(
			apiUrl,
			"notify-token-6",
			"Web",
		);
		let unexpected = false;
		notSubscribed.on("dataChanged", () => {
			unexpected = true;
		});

		const caller = await connectAndLogin(apiUrl, "notify-token-7", "Web");
		await caller.call("create", {
			service: EVY_CORE_SERVICE,
			resource: "sdui",
			data: {
				id: crypto.randomUUID(),
				name: "Subscribed Only",
				pages: [],
			},
		});

		await notifyPromise;
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(unexpected).toBe(false);

		subscribed.close();
		notSubscribed.close();
		caller.close();
	});
});
