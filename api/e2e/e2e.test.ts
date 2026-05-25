import { Client } from "rpc-websockets";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import type { UI_Flow, UI_Page, UI_Row } from "evy-types";

import { waitForClientOpen } from "../src/tests/wsTestHelpers";

type WSClient = InstanceType<typeof Client>;

const API_URL = process.env.API_URL;
if (!API_URL) {
	throw new Error("API_URL environment variable is not set");
}
const TEST_TOKEN = "e2e-test-token";
const TEST_OS = "Web";
const CONNECTION_TIMEOUT_MS = 5000;

describe("API E2E Tests", () => {
	describe("Public", () => {
		let unauthClient: WSClient;

		beforeAll(async () => {
			unauthClient = new Client(API_URL);
			await waitForClientOpen(unauthClient, CONNECTION_TIMEOUT_MS);
		});

		afterAll(() => {
			unauthClient.close();
		});

		it("get should succeed without auth (public)", async () => {
			const result = await unauthClient.call("get", {
				service: "evy",
				resource: "sdui",
			});
			expect(result).toHaveProperty("metadata");
			expect(Array.isArray(result.data)).toBe(true);
		});

		it("create should reject without auth", async () => {
			try {
				await unauthClient.call("create", {
					service: "evy",
					resource: "sdui",
					data: {
						id: crypto.randomUUID(),
						name: "Test",
						pages: [{ id: crypto.randomUUID(), title: "P", rows: [] }],
					},
				});
				throw new Error("Expected create to fail for unauthenticated request");
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes("Expected create to fail")
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
			await waitForClientOpen(client, CONNECTION_TIMEOUT_MS);
			await client.login({ token: TEST_TOKEN, os: TEST_OS });
		});

		afterAll(() => {
			client.close();
		});

		it("get SDUI should return flows with valid structure", async () => {
			const testPage: UI_Page = {
				id: crypto.randomUUID(),
				title: "Test Page",
				rows: [],
			};

			const flowData: UI_Flow = {
				id: crypto.randomUUID(),
				name: "SDUI Test Flow",
				pages: [testPage],
			};

			await client.call("create", {
				service: "evy",
				resource: "sdui",
				data: flowData,
			});

			const result = await client.call("get", {
				service: "evy",
				resource: "sdui",
			});

			expect(result.metadata.count).toBeGreaterThan(0);
			expect(result.data.length).toBeGreaterThan(0);
			const flow = result.data[0];
			expect(flow).toHaveProperty("id");
			expect(flow).toHaveProperty("name");
			expect(flow).toHaveProperty("pages");
			expect(flow.pages).toBeInstanceOf(Array);
		});

		it("create SDUI should create a new flow", async () => {
			const testRow: UI_Row = {
				id: crypto.randomUUID(),
				type: "Text",
				source: "",
				actions: [],
				view: {
					content: {
						title: "Hello",
						text: "World",
					},
				},
			};

			const testPage: UI_Page = {
				id: crypto.randomUUID(),
				title: "Test Page",
				rows: [testRow],
			};

			const flowData: UI_Flow = {
				id: crypto.randomUUID(),
				name: "E2E Test Flow",
				pages: [testPage],
			};

			const result = await client.call("create", {
				service: "evy",
				resource: "sdui",
				data: flowData,
			});

			expect(result.metadata.count).toBe(1);
			expect(result.metadata.order).toEqual([result.data.id]);
			expect(result.data.id).toBeDefined();
			expect(result.data.data).toBeDefined();
			expect(result.data.data.name).toBe("E2E Test Flow");
			expect(result.data.createdAt).toBeDefined();
			expect(result.data.updatedAt).toBeDefined();
		});

		it("update SDUI should update an existing flow", async () => {
			const flowId = crypto.randomUUID();

			const testPage: UI_Page = {
				id: crypto.randomUUID(),
				title: "Original Page",
				rows: [],
			};

			const createFlowData: UI_Flow = {
				id: flowId,
				name: "Flow to Update",
				pages: [testPage],
			};

			const created = await client.call("create", {
				service: "evy",
				resource: "sdui",
				data: createFlowData,
			});

			const updateFlowData: UI_Flow = {
				...createFlowData,
				name: "Updated Flow Name",
			};

			const updated = await client.call("update", {
				service: "evy",
				resource: "sdui",
				filter: { id: created.data.id },
				data: updateFlowData,
			});

			expect(updated.metadata.order).toEqual([created.data.id]);
			expect(updated.data.data.name).toBe("Updated Flow Name");
		});
	});
});
