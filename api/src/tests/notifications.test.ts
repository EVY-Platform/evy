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
import type { WSParams } from "../ws";

import {
	clearAllTestTables,
	connectAndLogin,
	createPgliteTestDatabase,
	getFreePort,
	waitForNotification,
	type WSServer,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

const dataModule = await import("../data");
const { create, setDbForTest, validateAuth } = dataModule;
setDbForTest(testDb as unknown as Parameters<typeof setDbForTest>[0]);

describe("create/update real-time notifications", () => {
	let previousApiPort: string | undefined;
	let apiPort: number;
	let apiUrl: string;
	let initServer: typeof import("../ws")["initServer"];
	let emitJsonRpc: typeof import("../ws")["emitJsonRpc"];
	let server: WSServer;

	beforeAll(async () => {
		await migrate(testDb, { migrationsFolder: "./drizzle" });
		await clearAllTestTables(testDb);

		previousApiPort = process.env.API_PORT;
		apiPort = await getFreePort();
		process.env.API_PORT = String(apiPort);
		const wsMod = await import("../ws");
		const notificationMod = await import("../notifications");
		initServer = wsMod.initServer;
		emitJsonRpc = wsMod.emitJsonRpc;

		server = await initServer((params: WSParams) =>
			validateAuth(params.token, params.os),
		);
		notificationMod.initDataNotifications((eventName, payload) => {
			emitJsonRpc(server, eventName, payload);
		});

		server
			.register("create", async (params: unknown) =>
				create(params as unknown as CreateRequest),
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
			service: "evy",
			resource: "sdui",
			data: flowData,
		});

		const params = await notifyPromise;
		expect(params).toEqual({
			service: "evy",
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
			service: "evy",
			resource: "services",
			data: payload,
		});

		const params = await notifyPromise;
		expect(params).toEqual({
			service: "evy",
			resource: "services",
			operation: "create",
			value: createResult.data,
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

		const missed: unknown[] = [];
		notSubscribed.on("dataChanged", (p: unknown) => missed.push(p));

		const caller = await connectAndLogin(apiUrl, "notify-token-7", "Web");

		const testPage: UI_Page = {
			id: crypto.randomUUID(),
			title: "P",
			rows: [],
		};
		await caller.call("create", {
			service: "evy",
			resource: "sdui",
			data: {
				id: crypto.randomUUID(),
				name: "Only Subscriber",
				pages: [testPage],
			},
		});

		await notifyPromise;

		expect(missed.length).toBe(0);

		subscribed.close();
		notSubscribed.close();
		caller.close();
	});
});
