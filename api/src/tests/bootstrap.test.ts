import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { GetRequest, GetResponse, UI_Flow } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { MARKETPLACE_SERVICE } from "evy-types/marketplaceResources";
import { Client } from "rpc-websockets";

import { assertApiReadable } from "../readiness";
import { getFreePort, type WSServer, waitForClientOpen } from "./wsTestHelpers";

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
				service: EVY_CORE_SERVICE,
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
			listExternalServices: async () => [],
		};
		await expect(
			assertApiReadable({ requireSeeded: false }, deps),
		).resolves.toBeUndefined();
	});

	it("throws when sdui get does not return a data array", async () => {
		const deps = {
			get: async (_params: GetRequest): Promise<GetResponse> =>
				"not-array" as unknown as GetResponse,
			listExternalServices: async () => [],
		};
		await expect(
			assertApiReadable({ requireSeeded: false }, deps),
		).rejects.toThrow("expected sdui response data array");
	});

	it("throws when requireSeeded is true but sdui is empty", async () => {
		const deps = {
			get: async (_params: GetRequest): Promise<GetResponse> => [],
			listExternalServices: async () => [],
		};
		await expect(
			assertApiReadable({ requireSeeded: true }, deps),
		).rejects.toThrow("missing seeded SDUI flows");
	});

	it("resolves when requireSeeded is true and sdui has at least one flow", async () => {
		const deps = {
			get: async (params: GetRequest): Promise<GetResponse> => {
				expect(params).toEqual({
					service: EVY_CORE_SERVICE,
					resource: "sdui",
				});
				return [
					{
						id: crypto.randomUUID(),
						data: {
							id: crypto.randomUUID(),
							name: "Seeded",
							pages: [],
						},
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
				] as GetResponse;
			},
			listExternalServices: async () => [],
		};
		await expect(
			assertApiReadable({ requireSeeded: true }, deps),
		).resolves.toBeUndefined();
	});

	it("throws when an external service is missing its gRPC env vars", async () => {
		const deps = {
			get: async (): Promise<GetResponse> => [],
			listExternalServices: async () => [
				{ id: MARKETPLACE_SERVICE, name: "marketplace" },
			],
		};
		const savedHost = process.env.MARKETPLACE_GRPC_HOST;
		const savedPort = process.env.MARKETPLACE_GRPC_PORT;
		delete process.env.MARKETPLACE_GRPC_HOST;
		delete process.env.MARKETPLACE_GRPC_PORT;
		try {
			await expect(
				assertApiReadable({ requireSeeded: false }, deps),
			).rejects.toThrow("MARKETPLACE_GRPC_HOST");
		} finally {
			if (savedHost !== undefined)
				process.env.MARKETPLACE_GRPC_HOST = savedHost;
			if (savedPort !== undefined)
				process.env.MARKETPLACE_GRPC_PORT = savedPort;
		}
	});

	it("resolves when all external services have gRPC env vars configured", async () => {
		const deps = {
			get: async (): Promise<GetResponse> => [],
			listExternalServices: async () => [
				{ id: MARKETPLACE_SERVICE, name: "marketplace" },
			],
		};
		const savedHost = process.env.MARKETPLACE_GRPC_HOST;
		const savedPort = process.env.MARKETPLACE_GRPC_PORT;
		process.env.MARKETPLACE_GRPC_HOST = "localhost";
		process.env.MARKETPLACE_GRPC_PORT = "50051";
		try {
			await expect(
				assertApiReadable({ requireSeeded: false }, deps),
			).resolves.toBeUndefined();
		} finally {
			if (savedHost !== undefined)
				process.env.MARKETPLACE_GRPC_HOST = savedHost;
			else delete process.env.MARKETPLACE_GRPC_HOST;
			if (savedPort !== undefined)
				process.env.MARKETPLACE_GRPC_PORT = savedPort;
			else delete process.env.MARKETPLACE_GRPC_PORT;
		}
	});
});
