import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Client } from "rpc-websockets";
import type { GetRequest, GetResponse, UI_Flow } from "evy-types";

import { assertApiReadable } from "../index";
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
		const { initServer } = await import("../shared/ws");
		server = await initServer(async () => true);

		server
			.register("create", async () => ({
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

	it("registers dataChanged event", () => {
		const events = server.eventList("/");
		expect(events).toContain("dataChanged");
		expect(events).not.toContain("flowUpdated");
	});

	it("rejects create without authentication", async () => {
		const client = new Client(apiUrl);
		await waitForClientOpen(client);
		await expect(
			client.call("create", {
				service: "evy",
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
	it("resolves when sdui get returns an array envelope and requireSeeded is false", async () => {
		const deps = {
			get: async (_params: GetRequest): Promise<GetResponse> => [],
		};
		await expect(
			assertApiReadable({ requireSeeded: false }, deps),
		).resolves.toBeUndefined();
	});

	it("throws when sdui get does not return a data array", async () => {
		const deps = {
			get: async (_params: GetRequest): Promise<GetResponse> =>
				"not-array" as unknown as GetResponse,
		};
		await expect(
			assertApiReadable({ requireSeeded: false }, deps),
		).rejects.toThrow("expected sdui response data array");
	});

	it("throws when requireSeeded is true but sdui is empty", async () => {
		const deps = {
			get: async (_params: GetRequest): Promise<GetResponse> => [],
		};
		await expect(
			assertApiReadable({ requireSeeded: true }, deps),
		).rejects.toThrow("missing seeded SDUI flows");
	});

	it("resolves when requireSeeded is true and sdui has at least one flow", async () => {
		const deps = {
			get: async (params: GetRequest): Promise<GetResponse> => {
				expect(params).toEqual({ service: "evy", resource: "sdui" });
				return [
					{
						id: crypto.randomUUID(),
						data: { id: crypto.randomUUID(), name: "Seeded", pages: [] },
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
				] as GetResponse;
			},
		};
		await expect(
			assertApiReadable({ requireSeeded: true }, deps),
		).resolves.toBeUndefined();
	});
});
