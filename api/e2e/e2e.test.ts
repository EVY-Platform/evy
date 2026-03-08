import { Client } from "rpc-websockets";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";

import { isRecord } from "../src/data";

type WSClient = InstanceType<typeof Client>;

import type { SDUI_Flow, SDUI_Page, SDUI_Row } from "evy-types/sdui/evy";

const API_URL = process.env.API_URL;
if (!API_URL) {
	throw new Error("API_URL environment variable is not set");
}
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
	describe("Public", () => {
		let unauthClient: WSClient;

		beforeAll(async () => {
			unauthClient = new Client(API_URL);
			await waitForClient(unauthClient);
		});

		afterAll(() => {
			unauthClient.close();
		});

		it("get should succeed without auth (public)", async () => {
			const result = await unauthClient.call("get", {
				namespace: "evy",
				resource: "SDUI",
			});
			expect(Array.isArray(result)).toBe(true);
		});

		it("upsert should reject without auth", async () => {
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
				throw new Error("Expected upsert to fail for unauthenticated request");
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes("Expected upsert to fail")
				) {
					throw error;
				}
				expect(error).toBeDefined();
			}
		});
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
			const testPage: SDUI_Page = {
				id: crypto.randomUUID(),
				title: "Test Page",
				rows: [],
			};

			const flowData: SDUI_Flow = {
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

			const result = await client.call("get", {
				namespace: "evy",
				resource: "SDUI",
			});

			expect(result.length).toBeGreaterThan(0);
			const flow = result[0];
			expect(flow).toHaveProperty("id");
			expect(flow).toHaveProperty("name");
			expect(flow).toHaveProperty("type");
			expect(flow).toHaveProperty("pages");
			expect(flow.pages).toBeInstanceOf(Array);
		});

		it("upsert SDUI should create a new flow", async () => {
			const testRow: SDUI_Row = {
				id: crypto.randomUUID(),
				type: "Text",
				view: {
					content: {
						title: "Hello",
						text: "World",
					},
				},
			};

			const testPage: SDUI_Page = {
				id: crypto.randomUUID(),
				title: "Test Page",
				rows: [testRow],
			};

			const flowData: SDUI_Flow = {
				id: crypto.randomUUID(),
				name: "E2E Test Flow",
				type: "read",
				data: "item",
				pages: [testPage],
			};

			const result = await client.call("upsert", {
				namespace: "evy",
				resource: "SDUI",
				data: flowData,
			});

			expect(result.id).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.data.name).toBe("E2E Test Flow");
			expect(result.data.type).toBe("read");
			expect(result.createdAt).toBeDefined();
			expect(result.updatedAt).toBeDefined();
		});

		it("upsert SDUI should update an existing flow", async () => {
			const flowId = crypto.randomUUID();

			const testPage: SDUI_Page = {
				id: crypto.randomUUID(),
				title: "Original Page",
				rows: [],
			};

			const createFlowData: SDUI_Flow = {
				id: flowId,
				name: "Flow to Update",
				type: "create",
				data: "item",
				pages: [testPage],
			};

			const created = await client.call("upsert", {
				namespace: "evy",
				resource: "SDUI",
				data: createFlowData,
			});

			const updateFlowData: SDUI_Flow = {
				...createFlowData,
				name: "Updated Flow Name",
			};

			const updated = await client.call("upsert", {
				namespace: "evy",
				resource: "SDUI",
				filter: { id: created.id },
				data: updateFlowData,
			});

			expect(updated.data.name).toBe("Updated Flow Name");
		});

		it("get non-SDUI resource should return data object", async () => {
			const result = await client.call("get", {
				namespace: "evy",
				resource: "Items",
			});
			expect(result !== null && typeof result === "object").toBe(true);
		});

		it("upsert then get non-SDUI resource", async () => {
			const testData = {
				testField: "e2e test value",
				nested: { value: 123 },
			};

			const upserted = await client.call("upsert", {
				namespace: "evy",
				resource: "Items",
				data: testData,
			});

			expect(upserted).toHaveProperty("id");
			expect(upserted).toHaveProperty("data");
			expect(isRecord(upserted.data)).toBe(true);

			const got = await client.call("get", {
				namespace: "evy",
				resource: "Items",
			});

			expect(isRecord(got)).toBe(true);
			expect(got.testField).toBe("e2e test value");

			expect(isRecord(got.nested)).toBe(true);
			expect(got.nested.value).toBe(123);
		});
	});
});
