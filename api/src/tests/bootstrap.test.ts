import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Client } from "rpc-websockets";
import type { GetRequest, GetResponse, UI_Flow } from "evy-types";

import { assertApiReadable } from "../readiness";
import { getFreePort, waitForClientOpen, type WSServer } from "./wsTestHelpers";

describe("initServer bootstrap", () => {
	let previousApiPort: string | undefined;
	let server: WSServer;
	let port: number;
	let apiUrl: string;

	beforeAll(async () => {
		previousApiPort = process.env.API_PORT;
		port = await getFreePort();
		process.env.API_PORT = String(port);
		apiUrl = `ws://127.0.0.1:${port}`;
		const { initServer } = await import("../ws");
		server = await initServer(async () => true);

		server
			.register("upsert", async () => ({
				id: "stub",
				data: { id: "stub", name: "Stub", pages: [] } satisfies UI_Flow,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}))
			.protected();
	});

	afterAll(async () => {
		await server.close();
		if (previousApiPort === undefined) {
			delete process.env.API_PORT;
		} else {
			process.env.API_PORT = previousApiPort;
		}
	});

	it("registers dataUpdated and flowUpdated events", () => {
		const events = server.eventList("/");
		expect(events).toContain("dataUpdated");
		expect(events).toContain("flowUpdated");
	});

	it("rejects upsert without authentication", async () => {
		const client = new Client(apiUrl);
		await waitForClientOpen(client);
		await expect(
			client.call("upsert", {
				namespace: "evy",
				resource: "sdui",
				data: {
					id: crypto.randomUUID(),
					name: "Unauth",
					pages: [],
				},
			}),
		).rejects.toThrow();
		client.close();
	});
});

describe("assertApiReadable", () => {
	it("resolves when sdui get returns an array and requireSeeded is false", async () => {
		const deps = {
			get: async (_params: GetRequest): Promise<GetResponse> => [],
		};
		await expect(
			assertApiReadable({ requireSeeded: false }, deps),
		).resolves.toBeUndefined();
	});

	it("throws when sdui get does not return an array", async () => {
		const deps = {
			get: async (_params: GetRequest): Promise<GetResponse> =>
				"not-array" as unknown as GetResponse,
		};
		await expect(
			assertApiReadable({ requireSeeded: false }, deps),
		).rejects.toThrow("expected sdui response array");
	});

	it("throws when requireSeeded is true but View Item flow is missing", async () => {
		const deps = {
			get: async (params: GetRequest): Promise<GetResponse> => {
				if (params.resource === "sdui") {
					return [
						{
							id: "1",
							name: "Other",
							pages: [],
						} satisfies UI_Flow,
					];
				}
				return [{ title: "x" }];
			},
		};
		await expect(
			assertApiReadable({ requireSeeded: true }, deps),
		).rejects.toThrow("View Item");
	});

	it("throws when requireSeeded is true but items are empty", async () => {
		const deps = {
			get: async (params: GetRequest): Promise<GetResponse> => {
				if (params.resource === "sdui") {
					return [
						{
							id: "1",
							name: "View Item",
							pages: [],
						} satisfies UI_Flow,
					];
				}
				return [];
			},
		};
		await expect(
			assertApiReadable({ requireSeeded: true }, deps),
		).rejects.toThrow("missing seeded items");
	});

	it("resolves when requireSeeded is true and seeded flows and items exist", async () => {
		const deps = {
			get: async (params: GetRequest): Promise<GetResponse> => {
				if (params.resource === "sdui") {
					return [
						{
							id: "1",
							name: "View Item",
							pages: [],
						} satisfies UI_Flow,
					];
				}
				return [{ title: "item" }];
			},
		};
		await expect(
			assertApiReadable({ requireSeeded: true }, deps),
		).resolves.toBeUndefined();
	});
});
