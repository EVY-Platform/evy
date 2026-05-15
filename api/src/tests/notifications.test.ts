import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { UpsertRequest, UI_Flow, UI_Page } from "evy-types";
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
const { upsert, setDbForTest, validateAuth } = dataModule;
setDbForTest(testDb as unknown as Parameters<typeof setDbForTest>[0]);

describe("upsert real-time notifications", () => {
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
			.register("upsert", async (params: unknown) =>
				upsert(params as unknown as UpsertRequest),
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

	it("emits dataUpdated with sync-row shape after SDUI upsert", async () => {
		const subscriber = await connectAndLogin(
			apiUrl,
			"notify-token-1",
			"Web",
			"dataUpdated",
		);
		const notifyPromise = waitForNotification(subscriber, "dataUpdated");

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

		await caller.call("upsert", {
			service: "evy",
			resource: "sdui",
			data: flowData,
		});

		const params = await notifyPromise;
		expect(params).toEqual({
			service: "evy",
			resource: "sdui",
			value: flowData,
		});

		subscriber.close();
		caller.close();
	});

	it("emits dataUpdated after non-SDUI upsert with sync-row shape", async () => {
		const subscriber = await connectAndLogin(
			apiUrl,
			"notify-token-3",
			"Web",
			"dataUpdated",
		);
		const notifyPromise = waitForNotification(subscriber, "dataUpdated");

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
		const upsertResult = await caller.call("upsert", {
			service: "evy",
			resource: "services",
			data: payload,
		});

		const params = await notifyPromise;
		expect(params).toEqual({
			service: "evy",
			resource: "services",
			value: upsertResult,
		});

		subscriber.close();
		caller.close();
	});

	it("only subscribed clients receive dataUpdated", async () => {
		const subscribed = await connectAndLogin(
			apiUrl,
			"notify-token-5",
			"Web",
			"dataUpdated",
		);
		const notifyPromise = waitForNotification(subscribed, "dataUpdated");

		const notSubscribed = await connectAndLogin(
			apiUrl,
			"notify-token-6",
			"Web",
		);

		const missed: unknown[] = [];
		notSubscribed.on("dataUpdated", (p: unknown) => missed.push(p));

		const caller = await connectAndLogin(apiUrl, "notify-token-7", "Web");

		const testPage: UI_Page = {
			id: crypto.randomUUID(),
			title: "P",
			rows: [],
		};
		await caller.call("upsert", {
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
