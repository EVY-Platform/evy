import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { GetRequest, SDUI_Flow, SDUI_Page } from "evy-types";

import * as schema from "../db/drizzleTables";
import {
	clearAllTestTables,
	connectAndLogin,
	createPgliteTestDatabase,
	getFreePort,
	waitForNotification,
	type WSServer,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

mock.module("../db", () => ({
	db: testDb,
	...schema,
}));

const { get, isRecord, isResource, upsert, validateAuth } = await import(
	"../data"
);

function hasResource(p: unknown): p is { resource: GetRequest["resource"] } {
	return isRecord(p) && "resource" in p && isResource(p.resource);
}

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
		initServer = wsMod.initServer;
		emitJsonRpc = wsMod.emitJsonRpc;

		server = await initServer((params) =>
			validateAuth(params.token, params.os),
		);

		server.register("get", async (params) => get(params));

		server
			.register("upsert", async (params) => {
				const result = await upsert(params);
				if (!hasResource(params)) return result;
				if (params.resource === "sdui") {
					emitJsonRpc(server, "flowUpdated", result);
				} else {
					emitJsonRpc(server, "dataUpdated", result);
				}
				return result;
			})
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

	it("emits flowUpdated with JSON-RPC 2.0 shape after SDUI upsert; params match upsert result", async () => {
		const subscriber = await connectAndLogin(
			apiUrl,
			"notify-token-1",
			"Web",
			"flowUpdated",
		);
		const notifyPromise = waitForNotification(subscriber, "flowUpdated");

		const testPage: SDUI_Page = {
			id: crypto.randomUUID(),
			title: "Page",
			rows: [],
		};
		const flowData: SDUI_Flow = {
			id: crypto.randomUUID(),
			name: "WS Notify Flow",
			pages: [testPage],
		};

		const caller = await connectAndLogin(apiUrl, "notify-token-2", "Web");

		const upsertResult = await caller.call("upsert", {
			namespace: "evy",
			resource: "sdui",
			data: flowData,
		});

		const params = await notifyPromise;
		expect(params).toEqual(upsertResult);

		subscriber.close();
		caller.close();
	});

	it("emits dataUpdated after non-SDUI upsert; params match upsert result", async () => {
		const subscriber = await connectAndLogin(
			apiUrl,
			"notify-token-3",
			"Web",
			"dataUpdated",
		);
		const notifyPromise = waitForNotification(subscriber, "dataUpdated");

		const caller = await connectAndLogin(apiUrl, "notify-token-4", "Web");

		const payload = { e2eField: "notification-items", n: 42 };
		const upsertResult = await caller.call("upsert", {
			namespace: "evy",
			resource: "items",
			data: payload,
		});

		const params = await notifyPromise;
		expect(params).toEqual(upsertResult);

		subscriber.close();
		caller.close();
	});

	it("only subscribed clients receive flowUpdated", async () => {
		const subscribed = await connectAndLogin(
			apiUrl,
			"notify-token-5",
			"Web",
			"flowUpdated",
		);
		const notifyPromise = waitForNotification(subscribed, "flowUpdated");

		const notSubscribed = await connectAndLogin(
			apiUrl,
			"notify-token-6",
			"Web",
		);

		const missed: unknown[] = [];
		notSubscribed.on("flowUpdated", (p: unknown) => missed.push(p));

		const caller = await connectAndLogin(apiUrl, "notify-token-7", "Web");

		const testPage: SDUI_Page = {
			id: crypto.randomUUID(),
			title: "P",
			rows: [],
		};
		await caller.call("upsert", {
			namespace: "evy",
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
