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
import { Client } from "rpc-websockets";
import { MARKETPLACE_SERVICE } from "../../../services/marketplace/src/resources";

import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import * as services from "../procedures/services";
import { assertApiReadable } from "../readiness";
import { withEnvironment } from "./withEnvironment";
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
	let forwardResourcesSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		resetBootstrapMocks();
		getSpy = spyOn(data, "get").mockImplementation((_db, params) =>
			getImpl(params),
		);
		listExternalServicesSpy = spyOn(
			data,
			"listExternalServices",
		).mockImplementation(() => listExternalServicesImpl());
		forwardResourcesSpy = spyOn(
			services,
			"forwardResources",
		).mockResolvedValue({
			services: [
				{
					id: MARKETPLACE_SERVICE,
					name: "marketplace",
					resources: [{ id: "resource-id", name: "items" }],
				},
			],
		});
	});

	afterEach(() => {
		getSpy.mockRestore();
		listExternalServicesSpy.mockRestore();
		forwardResourcesSpy.mockRestore();
	});

	it("resolves when flows get returns an array envelope and requireSeeded is false", async () => {
		await expect(assertApiReadable(db, false)).resolves.toBeUndefined();
	});

	it("throws when flows get does not return a data array", async () => {
		getImpl = async () => "not-array" as unknown as GetResponse;
		await expect(assertApiReadable(db, false)).rejects.toThrow(
			"expected flows response data array",
		);
	});

	it("throws when requireSeeded is true but flows is empty", async () => {
		await expect(assertApiReadable(db, true)).rejects.toThrow(
			"missing seeded flows",
		);
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
		await expect(assertApiReadable(db, true)).resolves.toBeUndefined();
	});

	/** Runs `body` with the marketplace endpoint env vars unset. */
	function withoutMarketplaceEnv(body: () => Promise<void>) {
		return withEnvironment(
			{
				MARKETPLACE_WS_HOST: undefined,
				MARKETPLACE_WS_PORT: undefined,
				REQUIRED_SERVICES: undefined,
			},
			body,
		);
	}

	// An unreachable optional service degrades readiness rather than taking the
	// whole gateway out of rotation.
	it("warns but stays ready when an unconfigured service is not required", async () => {
		listExternalServicesImpl = async () => [
			{
				id: MARKETPLACE_SERVICE,
				name: "marketplace",
				wsHost: null,
				wsPort: null,
			},
		];
		await withoutMarketplaceEnv(async () => {
			const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
			try {
				await expect(
					assertApiReadable(db, false),
				).resolves.toBeUndefined();
				expect(warnSpy).toHaveBeenCalled();
			} finally {
				warnSpy.mockRestore();
			}
		});
	});

	it("throws when an unconfigured service is listed in REQUIRED_SERVICES", async () => {
		listExternalServicesImpl = async () => [
			{
				id: MARKETPLACE_SERVICE,
				name: "marketplace",
				wsHost: null,
				wsPort: null,
			},
		];
		await withoutMarketplaceEnv(async () => {
			process.env.REQUIRED_SERVICES = "marketplace";
			await expect(assertApiReadable(db, false)).rejects.toThrow(
				"API readiness failed",
			);
		});
	});

	it("is ready from the service row alone, with no env vars", async () => {
		listExternalServicesImpl = async () => [
			{
				id: MARKETPLACE_SERVICE,
				name: "marketplace",
				wsHost: "marketplace.internal",
				wsPort: 8001,
			},
		];
		await withoutMarketplaceEnv(async () => {
			process.env.REQUIRED_SERVICES = "marketplace";
			await expect(assertApiReadable(db, false)).resolves.toBeUndefined();
		});
	});

	it("resolves when all external services have WebSocket env vars configured", async () => {
		listExternalServicesImpl = async () => [
			{ id: MARKETPLACE_SERVICE, name: "marketplace" },
		];
		const savedHost = process.env.MARKETPLACE_WS_HOST;
		const savedPort = process.env.MARKETPLACE_WS_PORT;
		process.env.MARKETPLACE_WS_HOST = "localhost";
		process.env.MARKETPLACE_WS_PORT = "50051";
		try {
			await expect(assertApiReadable(db, false)).resolves.toBeUndefined();
		} finally {
			if (savedHost !== undefined)
				process.env.MARKETPLACE_WS_HOST = savedHost;
			else delete process.env.MARKETPLACE_WS_HOST;
			if (savedPort !== undefined)
				process.env.MARKETPLACE_WS_PORT = savedPort;
			else delete process.env.MARKETPLACE_WS_PORT;
		}
	});
});
