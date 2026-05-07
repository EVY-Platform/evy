import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { GetRequest, UpsertRequest, UI_Flow, UI_Page } from "evy-types";
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
const { get, upsert, setDbForTest, validateAuth } = dataModule;
setDbForTest(testDb as unknown as Parameters<typeof setDbForTest>[0]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasResource(p: unknown): p is { resource: GetRequest["resource"] } {
	return (
		isRecord(p) &&
		"resource" in p &&
		typeof (p as Record<string, unknown>).resource === "string" &&
		((p as Record<string, unknown>).resource as string).length > 0
	);
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

		server = await initServer((params: WSParams) =>
			validateAuth(params.token, params.os),
		);

		server.register("get", async (params: unknown) =>
			get(params as unknown as GetRequest),
		);

		server
			.register("upsert", async (params: unknown) => {
				const result = await upsert(params as unknown as UpsertRequest);
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

		const upsertResult = await caller.call("upsert", {
			service: "evy",
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
