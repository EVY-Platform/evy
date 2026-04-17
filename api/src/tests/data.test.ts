import type { z } from "zod";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";

import type {
	UI_Flow,
	DATA_EVY_Flow,
	DATA_EVY_Data,
	DATA_EVY_Rows,
	GetRequest,
} from "evy-types";
import * as schema from "../db/drizzleTables";
import {
	type RowSchema,
	type PageSchema,
	validateFlowData,
} from "../validation";
import { clearAllTestTables, createPgliteTestDatabase } from "./wsTestHelpers";

type ValidatedRow = z.infer<typeof RowSchema>;
type ValidatedPage = z.infer<typeof PageSchema>;

type RowInput = Omit<ValidatedRow, "id" | "view"> & {
	id?: string;
	view: Omit<ValidatedRow["view"], "content"> & {
		content: Omit<ValidatedRow["view"]["content"], "children" | "child"> & {
			children?: RowInput[];
			child?: RowInput;
		};
	};
};

type PageInput = Omit<ValidatedPage, "id" | "rows" | "footer"> & {
	id?: string;
	rows: RowInput[];
	footer?: RowInput;
};

type FlowDataInput = Omit<UI_Flow, "id" | "pages"> & {
	id?: string;
	pages: PageInput[];
};

const { pgliteClient, testDb } = createPgliteTestDatabase();

mock.module("../db", () => ({
	db: testDb,
	...schema,
}));

const { validateAuth, getCore, upsertCore } = await import("../data");

function isDATA_EVY_Flow(row: DATA_EVY_Rows): row is DATA_EVY_Flow {
	return (
		"data" in row &&
		typeof row.data === "object" &&
		row.data !== null &&
		"name" in row.data
	);
}

function expectToBeDATA_EVY_Flow(row: DATA_EVY_Rows): asserts row is DATA_EVY_Flow {
	expect(isDATA_EVY_Flow(row)).toBe(true);
	if (!isDATA_EVY_Flow(row)) {
		throw new Error("Expected DATA_EVY_Flow");
	}
}

function testFlowRowTimestamps(): { createdAt: string; updatedAt: string } {
	const iso = new Date().toISOString();
	return { createdAt: iso, updatedAt: iso };
}

function ensureRowIds(rows: RowInput[]): RowInput[] {
	return rows.map((row) => {
		const rowWithId: RowInput = {
			...row,
			id: crypto.randomUUID(),
			view: {
				...row.view,
				content: {
					...row.view.content,
				},
			},
		};
		if (row.view.content.children) {
			rowWithId.view.content.children = ensureRowIds(row.view.content.children);
		}
		if (row.view.content.child) {
			rowWithId.view.content.child = ensureRowIds([row.view.content.child])[0];
		}
		return rowWithId;
	});
}

function createTestFlow(flowData: FlowDataInput): UI_Flow {
	const built = {
		...flowData,
		id: flowData.id || crypto.randomUUID(),
		pages: flowData.pages.map((page) => ({
			...page,
			id: page.id || crypto.randomUUID(),
			rows: ensureRowIds(page.rows),
			footer: page.footer ? ensureRowIds([page.footer])[0] : undefined,
		})),
	};
	return validateFlowData(built);
}

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
	await clearAllTestTables(testDb);
});

afterAll(async () => {
	await pgliteClient.close();
});

describe("validateAuth", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("should throw error when no token provided", async () => {
		await expect(validateAuth("", "ios")).rejects.toThrow("No token provided");
	});

	it("should throw error when no OS provided", async () => {
		await expect(validateAuth("valid-token", "" as "ios")).rejects.toThrow(
			"No os provided",
		);
	});

	it("should return false for invalid OS", async () => {
		const result = await validateAuth("valid-token", "invalid-os" as "ios");
		expect(result).toBe(false);
	});

	it("should return true for existing device", async () => {
		// Create device first
		await testDb.insert(schema.device).values({
			token: "existing-token",
			os: "ios",
			createdAt: new Date().toISOString(),
		});

		const result = await validateAuth("existing-token", "ios");
		expect(result).toBe(true);
	});

	it("should create new device and return true for new token", async () => {
		const result = await validateAuth("new-token", "android");

		expect(result).toBe(true);

		// Verify device was created
		const devices = await testDb.select().from(schema.device);
		expect(devices).toHaveLength(1);
		expect(devices[0].token).toBe("new-token");
		expect(devices[0].os).toBe("android");
	});

	it("should accept Web as valid OS", async () => {
		const result = await validateAuth("web-token", "Web");

		expect(result).toBe(true);

		const devices = await testDb.select().from(schema.device);
		expect(devices).toHaveLength(1);
		expect(devices[0].os).toBe("Web");
	});
});

describe("get", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("should throw when params is not an object", async () => {
		await expect(getCore(null as unknown as GetRequest)).rejects.toThrow(
			"Params must be an object",
		);
	});

	it("should throw when namespace is invalid", async () => {
		await expect(
			getCore({
				namespace: "invalid",
				resource: "sdui",
			} as unknown as GetRequest),
		).rejects.toThrow("Invalid or missing namespace");
	});

	it("should throw when resource is invalid", async () => {
		await expect(
			getCore({
				namespace: "evy",
				resource: "InvalidResource",
			} as unknown as GetRequest),
		).rejects.toThrow("Invalid or missing resource");
	});

	it("should return all flow data for resource SDUI when no filter", async () => {
		const timestamps = testFlowRowTimestamps();
		await testDb.insert(schema.flow).values([
			{
				data: createTestFlow({
					name: "Flow 1",
					pages: [{ title: "P1", rows: [] }],
				}),
				...timestamps,
			},
			{
				data: createTestFlow({
					name: "Flow 2",
					pages: [{ title: "P2", rows: [] }],
				}),
				...timestamps,
			},
		]);

		const result = await getCore({
			namespace: "evy",
			resource: "sdui",
		});

		expect(result).toHaveLength(2);
		expect(result[0]).toHaveProperty("name");
		expect(result[0]).toHaveProperty("pages");
	});

	it("should return single flow for resource SDUI when filter.id provided", async () => {
		const flowId = crypto.randomUUID();
		await testDb.insert(schema.flow).values({
			id: flowId,
			data: createTestFlow({
				id: flowId,
				name: "Single Flow",
				pages: [{ title: "P1", rows: [] }],
			}),
			...testFlowRowTimestamps(),
		});

		const result = await getCore({
			namespace: "evy",
			resource: "sdui",
			filter: { id: flowId },
		});

		expect(result).toHaveLength(1);
		const flow = result[0] as UI_Flow;
		expect(flow.name).toBe("Single Flow");
	});

	it("should return empty array for SDUI when filter.id matches nothing", async () => {
		const result = await getCore({
			namespace: "evy",
			resource: "sdui",
			filter: { id: crypto.randomUUID() },
		});

		expect(result).toHaveLength(0);
	});

	it("should return resource data for non-SDUI resource", async () => {
		const nowIso = new Date().toISOString();
		const serviceId = crypto.randomUUID();
		const serviceData = {
			id: serviceId,
			name: "SeedSvc",
			description: "D",
			createdAt: nowIso,
			updatedAt: nowIso,
		};
		await upsertCore({
			namespace: "evy",
			resource: "services",
			data: serviceData,
		});

		const result = await getCore({
			namespace: "evy",
			resource: "services",
		});

		expect(result).toEqual([serviceData]);
	});

	it("should return empty array for non-SDUI resource when no data", async () => {
		const result = await getCore({
			namespace: "evy",
			resource: "services",
		});

		expect(result).toEqual([]);
	});
});

describe("upsert", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("should throw when params is not an object", async () => {
		await expect(upsertCore(null)).rejects.toThrow("Params must be an object");
	});

	it("should throw when data is missing", async () => {
		await expect(
			upsertCore({ namespace: "evy", resource: "sdui" }),
		).rejects.toThrow("data is required");
	});

	it("should create new flow for resource SDUI without filter.id", async () => {
		const flowData = createTestFlow({
			name: "New Flow",
			pages: [
				{
					title: "Page 1",
					rows: [
						{
							type: "Text",
							view: {
								content: {
									title: "Hello",
									text: "World",
								},
							},
							actions: [],
						},
					],
				},
			],
		});

		const result = await upsertCore({
			namespace: "evy",
			resource: "sdui",
			data: flowData,
		});

		expectToBeDATA_EVY_Flow(result);
		const flowRow = result;
		expect(flowRow.data.name).toBe("New Flow");
		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
	});

	it("should update existing flow for resource SDUI with filter.id", async () => {
		const existingFlowData = createTestFlow({
			name: "Old Name",
			pages: [{ title: "P1", rows: [] }],
		});
		const [existingFlow] = await testDb
			.insert(schema.flow)
			.values({
				data: existingFlowData,
				...testFlowRowTimestamps(),
			})
			.returning();

		const updatedFlowData = createTestFlow({
			id: existingFlow.id,
			name: "Updated Name",
			pages: [
				{
					title: "New Page",
					rows: [
						{
							type: "Button",
							view: {
								content: {
									title: "",
									label: "Click me",
								},
							},
							actions: [{ condition: "", false: "", true: "close" }],
						},
					],
				},
			],
		});

		const result = await upsertCore({
			namespace: "evy",
			resource: "sdui",
			filter: { id: existingFlow.id },
			data: updatedFlowData,
		});

		expectToBeDATA_EVY_Flow(result);
		const flowRow = result;
		expect(flowRow.data.name).toBe("Updated Name");
		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
	});

	it("should insert then update the same SDUI flow when filter.id is provided for a new client-created flow", async () => {
		const flowId = crypto.randomUUID();
		const initialFlowData = createTestFlow({
			id: flowId,
			name: "Client Created Flow",
			pages: [{ title: "Draft", rows: [] }],
		});

		const created = await upsertCore({
			namespace: "evy",
			resource: "sdui",
			filter: { id: flowId },
			data: initialFlowData,
		});

		expectToBeDATA_EVY_Flow(created);
		const createdFlow = created;
		expect(createdFlow.id).toBe(flowId);
		expect(createdFlow.data.id).toBe(flowId);
		expect(createdFlow.data.name).toBe("Client Created Flow");

		const updated = await upsertCore({
			namespace: "evy",
			resource: "sdui",
			filter: { id: flowId },
			data: createTestFlow({
				id: flowId,
				name: "Client Created Flow Updated",
				pages: [{ title: "Published", rows: [] }],
			}),
		});

		expectToBeDATA_EVY_Flow(updated);
		const updatedFlow = updated;
		expect(updatedFlow.id).toBe(flowId);
		expect(updatedFlow.data.id).toBe(flowId);
		expect(updatedFlow.data.name).toBe("Client Created Flow Updated");
		expect(updatedFlow.data.pages[0]?.title).toBe("Published");

		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
		expect(flows[0]?.id).toBe(flowId);
		expect(flows[0]?.data.id).toBe(flowId);
		expect(flows[0]?.data.name).toBe("Client Created Flow Updated");
	});

	it("should reject SDUI flow with missing name", async () => {
		await expect(
			upsertCore({
				namespace: "evy",
				resource: "sdui",
				data: {
					name: "",
					pages: [{ id: "page-1", title: "Page 1", rows: [] }],
				},
			}),
		).rejects.toThrow("Flow validation failed");
	});

	it("should upsert Data resource with namespace and resource columns", async () => {
		const nowIso = new Date().toISOString();
		const serviceId = crypto.randomUUID();
		const payload = {
			id: serviceId,
			name: "UpsertSvc",
			description: "D",
			createdAt: nowIso,
			updatedAt: nowIso,
		};

		const result = await upsertCore({
			namespace: "evy",
			resource: "services",
			data: payload,
		});

		const dataResult = result as DATA_EVY_Data;
		expect(dataResult.namespace).toBe("evy");
		expect(dataResult.resource).toBe("service");
		expect(dataResult.data).toEqual(payload);
		const dataRecords = await testDb.select().from(schema.data);
		expect(dataRecords).toHaveLength(1);
		expect(dataRecords[0].namespace).toBe("evy");
		expect(dataRecords[0].resource).toBe("service");
	});

	it("should reject Data payload with NaN", async () => {
		const nowIso = new Date().toISOString();
		const serviceId = crypto.randomUUID();
		await expect(
			upsertCore({
				namespace: "evy",
				resource: "services",
				data: {
					id: serviceId,
					name: "n",
					description: "d",
					createdAt: nowIso,
					updatedAt: nowIso,
					bad: Number.NaN,
				},
			}),
		).rejects.toThrow("Data validation failed");
	});

	it("should accept Data payload with integer and decimal numbers", async () => {
		const nowIso = new Date().toISOString();
		const serviceId = crypto.randomUUID();
		const payload = {
			id: serviceId,
			name: "n",
			description: "d",
			createdAt: nowIso,
			updatedAt: nowIso,
			count: 3,
			price: 19.99,
		};
		const result = await upsertCore({
			namespace: "evy",
			resource: "services",
			data: payload,
		});
		const dataResult = result as DATA_EVY_Data;
		expect(dataResult.data).toEqual(payload);
	});
});

describe("upsert SDUI validation", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("should reject flow with unrecognized keys", async () => {
		await expect(
			upsertCore({
				namespace: "evy",
				resource: "sdui",
				data: {
					name: "Test Flow",
					unknownField: "value",
					pages: [{ id: "page-1", title: "Page 1", rows: [] }],
				},
			}),
		).rejects.toThrow("Flow validation failed");
	});

	it("should accept flow with no pages", async () => {
		const result = await upsertCore({
			namespace: "evy",
			resource: "sdui",
			data: {
				id: crypto.randomUUID(),
				name: "Test Flow",
				pages: [],
			},
		});
		expectToBeDATA_EVY_Flow(result);
		const flowRow = result;
		expect(flowRow.data.pages).toHaveLength(0);
	});

	it("should reject flow with invalid row type", async () => {
		await expect(
			upsertCore({
				namespace: "evy",
				resource: "sdui",
				data: {
					name: "Test Flow",
					pages: [
						{
							id: "page-1",
							title: "Page 1",
							rows: [
								{
									type: "InvalidRowType",
									view: {
										content: { title: "Test" },
									},
								},
							],
						},
					],
				},
			}),
		).rejects.toThrow("Flow validation failed");
	});

	it("should validate nested rows in container recursively", async () => {
		const flowData = createTestFlow({
			name: "Test Flow",
			pages: [
				{
					title: "Page 1",
					rows: [
						{
							type: "ColumnContainer",
							actions: [],
							view: {
								content: {
									title: "Container",
									children: [
										{
											type: "Input",
											view: {
												content: {
													title: "Input 1",
													value: "",
													placeholder: "Enter text",
												},
											},
											destination: "{field}",
											actions: [],
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Input 2",
													value: "",
													placeholder: "Enter more text",
												},
											},
											actions: [],
										},
									],
								},
							},
						},
					],
				},
			],
		});

		const result = await upsertCore({
			namespace: "evy",
			resource: "sdui",
			data: flowData,
		});
		expectToBeDATA_EVY_Flow(result);
		const flowRow = result;
		expect(flowRow.data.name).toBe("Test Flow");
		expect(flowRow.data.pages).toHaveLength(1);
	});

	it("should validate footer row", async () => {
		const flowData = createTestFlow({
			name: "Test Flow",
			pages: [
				{
					title: "Page 1",
					rows: [],
					footer: {
						type: "Button",
						view: {
							content: { title: "", label: "Submit" },
						},
						actions: [{ condition: "", false: "", true: "{create(item)}" }],
					},
				},
			],
		});

		const result = await upsertCore({
			namespace: "evy",
			resource: "sdui",
			data: flowData,
		});
		expectToBeDATA_EVY_Flow(result);
		const flowRow = result;
		expect(flowRow.data.pages[0]).toHaveProperty("footer");
	});
});
