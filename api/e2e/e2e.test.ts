import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Client } from "rpc-websockets";

type WSClient = InstanceType<typeof Client>;

import type { ServerFlow, ServerPage, ServerRow } from "../../web/app/types";
import type { SaveFlowResponse } from "../../web/app/api/wsClient";
import type { Service, Data } from "../src/db/schema";

const API_URL = process.env.API_URL || "ws://localhost:8000";
const TEST_TOKEN = "e2e-test-token";
const TEST_OS = "Web";
const CONNECTION_TIMEOUT = 10000;

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
	it("should reject unauthenticated requests", async () => {
		const unauthClient = new Client(API_URL);
		await waitForClient(unauthClient);

		try {
			await unauthClient.call("getSDUI", {});
			throw new Error(
				"Expected 'getSDUI' call to fail for unauthenticated request",
			);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Expected 'getSDUI'")
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

		it("getSDUI should return flows with valid structure", async () => {
			// Create a flow first to ensure there's at least one
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

			await client.call("saveFlow", { flowData });

			const result = (await client.call("getSDUI", {})) as ServerFlow[];

			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBeGreaterThan(0);

			const flow = result[0];
			expect(flow).toHaveProperty("id");
			expect(flow).toHaveProperty("name");
			expect(flow).toHaveProperty("type");
			expect(flow).toHaveProperty("pages");
			expect(flow.pages).toBeInstanceOf(Array);
		});

		it("saveFlow should create a new flow", async () => {
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

			const result = (await client.call("saveFlow", {
				flowData,
			})) as SaveFlowResponse;

			expect(result.id).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.data.name).toBe("E2E Test Flow");
			expect(result.data.type).toBe("read");
			expect(result.createdAt).toBeDefined();
			expect(result.updatedAt).toBeDefined();
		});

		it("saveFlow should update an existing flow", async () => {
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

			const created = (await client.call("saveFlow", {
				flowData: createFlowData,
			})) as SaveFlowResponse;

			const updateFlowData: ServerFlow = {
				...createFlowData,
				name: "Updated Flow Name",
			};

			const updated = (await client.call("saveFlow", {
				flowData: updateFlowData,
				flowId: created.id,
			})) as SaveFlowResponse;

			expect(updated.data.name).toBe("Updated Flow Name");
		});

		it("getData should return data object", async () => {
			const result = await client.call("getData", {});
			expect(typeof result).toBe("object");
		});

		it("saveData should save and return data", async () => {
			const testData = {
				testField: "e2e test value",
				nested: {
					value: 123,
				},
			};

			const result = (await client.call("saveData", {
				dataPayload: testData,
			})) as Data;

			expect(result).toHaveProperty("id");
			expect(result).toHaveProperty("data");
			expect((result.data as Record<string, unknown>).testField).toBe(
				"e2e test value",
			);
		});

		it("saveData should update existing data", async () => {
			const initialData = { field1: "initial" };
			const created = (await client.call("saveData", {
				dataPayload: initialData,
			})) as Data;
			const dataId = created.id;

			const updatedData = { field1: "updated", field2: "new" };
			const updated = (await client.call("saveData", {
				dataPayload: updatedData,
				dataId,
			})) as Data;

			const updatedDataRecord = updated.data as Record<string, unknown>;
			expect(updatedDataRecord.field1).toBe("updated");
			expect(updatedDataRecord.field2).toBe("new");
		});

		it("crud should create a service", async () => {
			const result = (await client.call("crud", {
				method: "create",
				model: "Service",
				data: {
					name: "E2E Test Service",
					description: "Created via e2e test",
				},
			})) as Service[];

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(1);
			expect(result[0].name).toBe("E2E Test Service");
		});

		it("crud should find services", async () => {
			const created = (await client.call("crud", {
				method: "create",
				model: "Service",
				data: {
					name: "Findable Service",
					description: "Can be found",
				},
			})) as Service[];

			const serviceId = created[0].id;

			const found = (await client.call("crud", {
				method: "find",
				model: "Service",
				filter: { id: serviceId },
			})) as Service[];

			expect(found.length).toBe(1);
			expect(found[0].name).toBe("Findable Service");
		});

		it("crud should update a service", async () => {
			const created = (await client.call("crud", {
				method: "create",
				model: "Service",
				data: {
					name: "Service to Update",
					description: "Will be updated",
				},
			})) as Service[];

			const serviceId = created[0].id;

			const updated = (await client.call("crud", {
				method: "update",
				model: "Service",
				filter: { id: serviceId },
				data: { name: "Updated Service Name" },
			})) as Service[];

			expect(updated[0].name).toBe("Updated Service Name");
		});

		it("crud should delete a service", async () => {
			const created = (await client.call("crud", {
				method: "create",
				model: "Service",
				data: {
					name: "Service to Delete",
					description: "Will be deleted",
				},
			})) as Service[];

			const serviceId = created[0].id;

			const deleted = (await client.call("crud", {
				method: "delete",
				model: "Service",
				filter: { id: serviceId },
			})) as Service[];

			expect(deleted.length).toBe(1);

			const found = (await client.call("crud", {
				method: "find",
				model: "Service",
				filter: { id: serviceId },
			})) as Service[];

			expect(found.length).toBe(0);
		});
	});
});
