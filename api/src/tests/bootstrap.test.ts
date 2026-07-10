import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	spyOn,
} from "bun:test";
import type { GetRequest, GetResponse } from "evy-types";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { MARKETPLACE_SERVICE } from "evy-types/marketplaceResources";
import { Client } from "rpc-websockets";

import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import { assertApiReadable } from "../readiness";
import { getFreePort, type WSServer, waitForClientOpen } from "./wsTestHelpers";

const db = null as unknown as EvyDb;

let getImpl = async (_params: GetRequest): Promise<GetResponse> => [];
let listExternalServicesImpl = async (): Promise<
	Array<{ id: string; name: string }>
> => [];

function resetBootstrapMocks(): void {
	getImpl = async () => [];
	listExternalServicesImpl = async () => [];
}

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
				name: "Stub",
				pageIds: [],
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
				resource: EVY_CORE_RESOURCE.FLOWS,
				data: {
					id: crypto.randomUUID(),
					name: "Unauth",
					pageIds: [],
				},
			}),
		).rejects.toThrow();
		client.close();
	});
});

describe("assertApiReadable", () => {
	let getSpy: ReturnType<typeof spyOn>;
	let listExternalServicesSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		resetBootstrapMocks();
		getSpy = spyOn(data, "get").mockImplementation((_db, params) =>
			getImpl(params),
		);
		listExternalServicesSpy = spyOn(
			data,
			"listExternalServices",
		).mockImplementation(() => listExternalServicesImpl());
	});

	afterEach(() => {
		getSpy.mockRestore();
		listExternalServicesSpy.mockRestore();
	});

	it("resolves when flows get returns an array envelope and requireSeeded is false", async () => {
		await expect(
			assertApiReadable(db, { requireSeeded: false }),
		).resolves.toBeUndefined();
	});

	it("throws when flows get does not return a data array", async () => {
		getImpl = async () => "not-array" as unknown as GetResponse;
		await expect(
			assertApiReadable(db, { requireSeeded: false }),
		).rejects.toThrow("expected flows response data array");
	});

	it("throws when requireSeeded is true but flows is empty", async () => {
		await expect(
			assertApiReadable(db, { requireSeeded: true }),
		).rejects.toThrow("missing seeded flows");
	});

	it("resolves when requireSeeded is true and flows has at least one flow", async () => {
		getImpl = async (params) => {
			expect(params).toEqual({
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
			});
			return [
				{
					id: crypto.randomUUID(),
					name: "Seeded",
					pageIds: [],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			] as GetResponse;
		};
		await expect(
			assertApiReadable(db, { requireSeeded: true }),
		).resolves.toBeUndefined();
	});

	it("throws when an external service is missing its gRPC env vars", async () => {
		listExternalServicesImpl = async () => [
			{ id: MARKETPLACE_SERVICE, name: "marketplace" },
		];
		const savedHost = process.env.MARKETPLACE_GRPC_HOST;
		const savedPort = process.env.MARKETPLACE_GRPC_PORT;
		delete process.env.MARKETPLACE_GRPC_HOST;
		delete process.env.MARKETPLACE_GRPC_PORT;
		try {
			await expect(
				assertApiReadable(db, { requireSeeded: false }),
			).rejects.toThrow("MARKETPLACE_GRPC_HOST");
		} finally {
			if (savedHost !== undefined)
				process.env.MARKETPLACE_GRPC_HOST = savedHost;
			if (savedPort !== undefined)
				process.env.MARKETPLACE_GRPC_PORT = savedPort;
		}
	});

	it("resolves when all external services have gRPC env vars configured", async () => {
		listExternalServicesImpl = async () => [
			{ id: MARKETPLACE_SERVICE, name: "marketplace" },
		];
		const savedHost = process.env.MARKETPLACE_GRPC_HOST;
		const savedPort = process.env.MARKETPLACE_GRPC_PORT;
		process.env.MARKETPLACE_GRPC_HOST = "localhost";
		process.env.MARKETPLACE_GRPC_PORT = "50051";
		try {
			await expect(
				assertApiReadable(db, { requireSeeded: false }),
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
