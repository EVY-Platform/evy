import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Client } from "rpc-websockets";

type WSClient = InstanceType<typeof Client>;

import type { ServerFlow, ServerPage, ServerRow } from "../../web/app/types";
import type { Data } from "../src/db/schema";

const API_URL = process.env.API_URL || "ws://localhost:8000";
const TEST_TOKEN = "e2e-test-token";
const TEST_OS = "Web";
const CONNECTION_TIMEOUT = 5000;

function waitForClient(ws: WSClient): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error("Connection timeout")),
			CONNECTION_TIMEOUT,
		);
		ws.on("open", () => {
			clearTimeout(timeout);
			resolve();
		});
		ws.on("error", (error: Error) => {
			clearTimeout(timeout);
			reject(error);
		});
	});
}

describe("API E2E Tests", () => {
	it("get should succeed without auth (public)", async () => {
		const unauthClient = new Client(API_URL);
		await waitForClient(unauthClient);

		const result = (await unauthClient.call("get", {
			namespace: "evy",
			resource: "SDUI",
		})) as ServerFlow[];
		expect(Array.isArray(result)).toBe(true);
		unauthClient.close();
	});

	it("upsert should reject without auth", async () => {
		const unauthClient = new Client(API_URL);
		await waitForClient(unauthClient);

		try {
			await unauthClient.call("upsert", {
				namespace: "evy",
				resource: "SDUI",
				data: {
					id: crypto.randomUUID(),
					name: "Test",
					type: "read",
					data: "item",
					pages: [{ id: crypto.randomUUID(), title: "P", rows: [] }],
				},
			});
			throw new Error(
				"Expected upsert to fail for unauthenticated request",
			);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Expected upsert to fail")
			) {
				throw error;
			}
			expect(error).toBeDefined();
		} finally {
			unauthClient.close();
		}
	});

	describe("Authenticated", () => {
		let client: WSClient;

		beforeAll(async () => {
			client = new Client(API_URL);
			await waitForClient(client);
			await client.login({ token: TEST_TOKEN, os: TEST_OS });
		});

		afterAll(() => {
			client.close();
		});

		it("get SDUI should return flows with valid structure", async () => {
			const testPage: ServerPage = {
				id: crypto.randomUUID(),
				title: "Test Page",
				rows: [],
			};

			const flowData: ServerFlow = {
				id: crypto.randomUUID(),
				name: "SDUI Test Flow",
				type: "read",
				data: "item",
				pages: [testPage],
			};

			await client.call("upsert", {
				namespace: "evy",
				resource: "SDUI",
				data: flowData,
			});

			const result = (await client.call("get", {
				namespace: "evy",
				resource: "SDUI",
			})) as ServerFlow[];

			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBeGreaterThan(0);

			const flow = result[0];
			expect(flow).toHaveProperty("id");
			expect(flow).toHaveProperty("name");
			expect(flow).toHaveProperty("type");
			expect(flow).toHaveProperty("pages");
			expect(flow.pages).toBeInstanceOf(Array);
		});

		it("upsert SDUI should create a new flow", async () => {
			const testRow: ServerRow = {
				id: crypto.randomUUID(),
				type: "Text",
				view: {
					content: {
						title: "Hello",
						text: "World",
					},
				},
			};

			const testPage: ServerPage = {
				id: crypto.randomUUID(),
				title: "Test Page",
				rows: [testRow],
			};

			const flowData: ServerFlow = {
				id: crypto.randomUUID(),
				name: "E2E Test Flow",
				type: "read",
				data: "item",
				pages: [testPage],
			};

			const result = (await client.call("upsert", {
				namespace: "evy",
				resource: "SDUI",
				data: flowData,
			})) as {
				id: string;
				data: ServerFlow;
				createdAt: string;
				updatedAt: string;
			};

			expect(result.id).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.data.name).toBe("E2E Test Flow");
			expect(result.data.type).toBe("read");
			expect(result.createdAt).toBeDefined();
			expect(result.updatedAt).toBeDefined();
		});

		it("upsert SDUI should update an existing flow", async () => {
			const flowId = crypto.randomUUID();

			const testPage: ServerPage = {
				id: crypto.randomUUID(),
				title: "Original Page",
				rows: [],
			};

			const createFlowData: ServerFlow = {
				id: flowId,
				name: "Flow to Update",
				type: "write",
				data: "item",
				pages: [testPage],
			};

			const created = (await client.call("upsert", {
				namespace: "evy",
				resource: "SDUI",
				data: createFlowData,
			})) as { id: string; data: ServerFlow };

			const updateFlowData: ServerFlow = {
				...createFlowData,
				name: "Updated Flow Name",
			};

			const updated = (await client.call("upsert", {
				namespace: "evy",
				resource: "SDUI",
				filter: { id: created.id },
				data: updateFlowData,
			})) as { data: ServerFlow };

			expect(updated.data.name).toBe("Updated Flow Name");
		});

		it("get non-SDUI resource should return data object", async () => {
			const result = (await client.call("get", {
				namespace: "evy",
				resource: "Items",
			})) as Record<string, unknown>;
			expect(typeof result).toBe("object");
		});

		it("upsert then get non-SDUI resource", async () => {
			const testData = {
				testField: "e2e test value",
				nested: { value: 123 },
			};

			const upserted = (await client.call("upsert", {
				namespace: "evy",
				resource: "Items",
				data: testData,
			})) as Data;

			expect(upserted).toHaveProperty("id");
			expect(upserted).toHaveProperty("data");

			const got = (await client.call("get", {
				namespace: "evy",
				resource: "Items",
			})) as Record<string, unknown>;

			expect(got.testField).toBe("e2e test value");
			expect((got.nested as Record<string, unknown>).value).toBe(123);
		});
	});
});
