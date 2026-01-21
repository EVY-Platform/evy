import { describe, it, expect, beforeEach, beforeAll, mock } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { z } from "zod";

import * as schema from "../db/schema";
import type { ValidatedFlowData, RowSchema, PageSchema } from "../validation";
import { CRUD } from "../data";
/**
 * Types inferred from individual schemas for use in other parts of the app
 */
export type ValidatedRow = z.infer<typeof RowSchema>;
export type ValidatedPage = z.infer<typeof PageSchema>;

/**
 * Input types where id is optional (for creating new entities)
 * These are useful for tests and client code that creates flows
 */
export type RowInput = Omit<ValidatedRow, "id" | "view"> & {
	id?: string;
	view: Omit<ValidatedRow["view"], "content"> & {
		content: Omit<ValidatedRow["view"]["content"], "children" | "child"> & {
			children?: RowInput[];
			child?: RowInput;
		};
	};
};

export type PageInput = Omit<ValidatedPage, "id" | "rows" | "footer"> & {
	id?: string;
	rows: RowInput[];
	footer?: RowInput;
};

export type FlowDataInput = Omit<ValidatedFlowData, "id" | "pages"> & {
	id?: string;
	pages: PageInput[];
};

// Create in-memory PostgreSQL instance
const client = new PGlite();
const testDb = drizzle(client, { schema });

// Mock the db module to use our test database
mock.module("../db", () => ({
	db: testDb,
	...schema,
}));

// Import data functions after mocking
const { validateAuth, crud, getSDUI, saveFlow, getData, saveData, primeData } =
	await import("../data");

// Helper to clear all tables between tests
async function clearTables() {
	await testDb.delete(schema.flow);
	await testDb.delete(schema.data);
	await testDb.delete(schema.serviceProvider);
	await testDb.delete(schema.organization);
	await testDb.delete(schema.service);
	await testDb.delete(schema.device);
}

// Recursively ensure all rows have IDs, transforming RowInput to ValidatedRow structure
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
			rowWithId.view.content.children = ensureRowIds(
				row.view.content.children,
			);
		}
		if (row.view.content.child) {
			rowWithId.view.content.child = ensureRowIds([
				row.view.content.child,
			])[0];
		}
		return rowWithId;
	});
}

// Helper to create test flow data with auto-generated UUIDs
// Takes FlowDataInput (id optional) and returns ValidatedFlowData (id required)
function createTestFlow(flowData: FlowDataInput): ValidatedFlowData {
	return {
		...flowData,
		id: flowData.id || crypto.randomUUID(),
		pages: flowData.pages.map((page) => ({
			...page,
			id: page.id || crypto.randomUUID(),
			rows: ensureRowIds(page.rows),
			footer: page.footer ? ensureRowIds([page.footer])[0] : undefined,
		})),
	} as ValidatedFlowData;
}

// Run migrations before all tests
beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
	await clearTables();
	await primeData();
});

describe("validateAuth", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should throw error when no token provided", async () => {
		await expect(validateAuth("", "ios")).rejects.toThrow(
			"No token provided",
		);
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
			createdAt: new Date(),
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

describe("crud", () => {
	beforeEach(async () => {
		await clearTables();
		await primeData();
	});

	it("should throw error for invalid CRUD method", async () => {
		await expect(crud("invalid" as CRUD, "Service")).rejects.toThrow(
			"Invalid CRUD method",
		);
	});

	it("should throw error for invalid model", async () => {
		await expect(
			crud(CRUD.find, "InvalidModel", { id: "123" }),
		).rejects.toThrow("Invalid model provided");
	});

	it("should throw error when no filter provided for find", async () => {
		await expect(crud(CRUD.find, "Service")).rejects.toThrow(
			"No filter provided",
		);
	});

	it("should throw error when no data provided for create", async () => {
		await expect(
			crud(CRUD.create, "Service", { id: "123" }),
		).rejects.toThrow("No data provided");
	});

	it("should find records matching filter", async () => {
		// Add a service
		const testId = crypto.randomUUID();
		await testDb.insert(schema.service).values({
			id: testId,
			name: "Test Service",
			description: "A test service",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const result = await crud(CRUD.find, "Service", { id: testId });
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: testId,
			name: "Test Service",
		});
	});

	it("should create a new record", async () => {
		const result = await crud(CRUD.create, "Service", undefined, {
			name: "New Service",
			description: "A new service",
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			name: "New Service",
			description: "A new service",
		});
		expect((result[0] as { id: string }).id).toBeDefined();
	});

	it("should update an existing record", async () => {
		const testId = crypto.randomUUID();
		await testDb.insert(schema.service).values({
			id: testId,
			name: "Old Name",
			description: "Old description",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const result = await crud(
			CRUD.update,
			"Service",
			{ id: testId },
			{ name: "Updated Name" },
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ name: "Updated Name" });
	});

	it("should delete an existing record", async () => {
		const testId = crypto.randomUUID();
		await testDb.insert(schema.service).values({
			id: testId,
			name: "To Delete",
			description: "Will be deleted",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const beforeDelete = await testDb.select().from(schema.service);
		expect(beforeDelete).toHaveLength(1);

		const result = await crud(CRUD.delete, "Service", { id: testId });

		expect(result).toHaveLength(1);

		const afterDelete = await testDb.select().from(schema.service);
		expect(afterDelete).toHaveLength(0);
	});
});

describe("getSDUI", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should return all flow data when no since date provided", async () => {
		const now = new Date();
		await testDb.insert(schema.flow).values([
			{
				data: createTestFlow({
					name: "Flow 1",
					type: "read",
					data: "item",
					pages: [{ title: "P1", rows: [] }],
				}),
				createdAt: now,
				updatedAt: now,
			},
			{
				data: createTestFlow({
					name: "Flow 2",
					type: "write",
					data: "item",
					pages: [{ title: "P2", rows: [] }],
				}),
				createdAt: now,
				updatedAt: now,
			},
		]);

		const result = await getSDUI();

		expect(result).toHaveLength(2);
		// Result should be the flow data directly, not the full Flow record
		expect(result[0]).toHaveProperty("name");
		expect(result[0]).toHaveProperty("pages");
		expect(result[0]).not.toHaveProperty("createdAt");
	});

	it("should filter flows by updatedAt when since date provided", async () => {
		const oldDate = new Date("2024-01-01");
		const newDate = new Date("2025-01-01");
		const sinceDate = new Date("2024-06-01");

		await testDb.insert(schema.flow).values([
			{
				data: createTestFlow({
					name: "Old Flow",
					type: "read",
					data: "item",
					pages: [{ title: "P1", rows: [] }],
				}),
				createdAt: oldDate,
				updatedAt: oldDate,
			},
			{
				data: createTestFlow({
					name: "New Flow",
					type: "write",
					data: "item",
					pages: [{ title: "P2", rows: [] }],
				}),
				createdAt: newDate,
				updatedAt: newDate,
			},
		]);

		const result = await getSDUI(sinceDate);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("New Flow");
	});

	it("should return empty array when no flows exist", async () => {
		const result = await getSDUI();
		expect(result).toHaveLength(0);
	});
});

describe("saveFlow", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should create a new flow when no existingFlowId provided", async () => {
		const flowData = createTestFlow({
			name: "New Flow",
			type: "create",
			data: "item",
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
						},
					],
				},
			],
		});

		const result = await saveFlow(flowData);

		expect(result.data.name).toBe("New Flow");
		expect(result.data.type).toBe("create");
		expect(result.data.pages).toHaveLength(1);

		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
	});

	it("should update existing flow when existingFlowId provided", async () => {
		// Create flow first (directly in DB to bypass validation)
		const existingFlowData = createTestFlow({
			name: "Old Name",
			type: "read",
			data: "item",
			pages: [{ title: "P1", rows: [] }],
		});
		const [existingFlow] = await testDb
			.insert(schema.flow)
			.values({
				data: existingFlowData,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		const updatedFlowData = createTestFlow({
			id: existingFlow.id,
			name: "Updated Name",
			type: "write",
			data: "item",
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
							action: {
								target: "close",
							},
						},
					],
				},
			],
		});

		const result = await saveFlow(updatedFlowData, existingFlow.id);

		expect(result.data.name).toBe("Updated Name");
		expect(result.data.type).toBe("write");

		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
	});

	it("should reject flow with missing name", async () => {
		const flowData = {
			name: "",
			type: "read",
			data: "item",
			pages: [{ id: "page-1", title: "Page 1", rows: [] }],
		};

		await expect(saveFlow(flowData)).rejects.toThrow(
			"Flow validation failed",
		);
	});

	it("should reject flow with invalid type", async () => {
		const flowData = {
			name: "Test Flow",
			type: "invalid-type",
			data: "item",
			pages: [{ id: "page-1", title: "Page 1", rows: [] }],
		};

		await expect(saveFlow(flowData as any)).rejects.toThrow(
			"Flow validation failed",
		);
	});

	it("should reject flow with no pages", async () => {
		const flowData = {
			name: "Test Flow",
			type: "read",
			data: "item",
			pages: [],
		};

		await expect(saveFlow(flowData)).rejects.toThrow(
			"Flow must have at least one page",
		);
	});

	it("should reject flow with invalid row type", async () => {
		const flowData = {
			name: "Test Flow",
			type: "read",
			data: "item",
			pages: [
				{
					id: "page-1",
					title: "Page 1",
					rows: [
						{
							type: "InvalidRowType",
							view: {
								content: {
									title: "Test",
								},
							},
						},
					],
				},
			],
		};

		await expect(saveFlow(flowData as any)).rejects.toThrow(
			"Flow validation failed",
		);
	});

	it("should validate nested rows in container recursively", async () => {
		const flowData = createTestFlow({
			name: "Test Flow",
			type: "create",
			data: "item",
			pages: [
				{
					title: "Page 1",
					rows: [
						{
							type: "ColumnContainer",
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
											edit: {
												destination: "{item.field}",
												validation: {
													required: "true",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Input 2",
													value: "",
													placeholder:
														"Enter more text",
												},
											},
										},
									],
								},
							},
						},
					],
				},
			],
		});

		const result = await saveFlow(flowData);
		expect(result.data.name).toBe("Test Flow");
		expect(result.data.pages).toHaveLength(1);
	});

	it("should reject nested rows with invalid type in container", async () => {
		const flowData = {
			name: "Test Flow",
			type: "create",
			data: "item",
			pages: [
				{
					id: "page-1",
					title: "Page 1",
					rows: [
						{
							type: "ColumnContainer",
							view: {
								content: {
									title: "Container",
									children: [
										{
											type: "InvalidNestedType",
											view: {
												content: {
													title: "Invalid",
												},
											},
										},
									],
								},
							},
						},
					],
				},
			],
		};

		await expect(saveFlow(flowData as any)).rejects.toThrow(
			"Flow validation failed",
		);
	});

	it("should validate deeply nested rows in SheetContainer", async () => {
		const flowData = createTestFlow({
			name: "Test Flow",
			type: "create",
			data: "item",
			pages: [
				{
					title: "Page 1",
					rows: [
						{
							type: "SheetContainer",
							view: {
								content: {
									title: "Sheet",
									child: {
										type: "Text",
										view: {
											content: {
												title: "Child Text",
												text: "Hello",
											},
										},
									},
									children: [
										{
											type: "ListContainer",
											view: {
												content: {
													title: "Nested List",
													children: [
														{
															type: "Info",
															view: {
																content: {
																	title: "",
																	text: "Deeply nested info",
																},
															},
														},
													],
												},
											},
										},
									],
								},
							},
						},
					],
				},
			],
		});

		const result = await saveFlow(flowData);
		expect(result.data.name).toBe("Test Flow");
	});

	it("should validate footer row", async () => {
		const flowData = createTestFlow({
			name: "Test Flow",
			type: "read",
			data: "item",
			pages: [
				{
					title: "Page 1",
					rows: [],
					footer: {
						type: "Button",
						view: {
							content: {
								title: "",
								label: "Submit",
							},
						},
						action: {
							target: "submit:item",
						},
					},
				},
			],
		});

		const result = await saveFlow(flowData);
		expect(result.data.pages[0]).toHaveProperty("footer");
	});

	it("should reject invalid footer row type", async () => {
		const flowData = {
			name: "Test Flow",
			type: "read",
			data: "item",
			pages: [
				{
					id: "page-1",
					title: "Page 1",
					rows: [],
					footer: {
						type: "InvalidFooter",
						view: {
							content: {
								title: "",
							},
						},
					},
				},
			],
		};

		await expect(saveFlow(flowData as any)).rejects.toThrow(
			"Flow validation failed",
		);
	});
});

describe("getData", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should return merged data from all records when no since date provided", async () => {
		const now = new Date();
		await testDb.insert(schema.data).values([
			{
				data: {
					conditions: [{ id: "1", value: "New" }],
					selling_reasons: [{ id: "1", value: "Moving" }],
				},
				createdAt: now,
				updatedAt: now,
			},
			{
				data: {
					areas: [{ id: "1", value: "City" }],
				},
				createdAt: now,
				updatedAt: now,
			},
		]);

		const result = await getData();

		expect(result).toHaveProperty("conditions");
		expect(result).toHaveProperty("selling_reasons");
		expect(result).toHaveProperty("areas");
	});

	it("should filter data by updatedAt when since date provided", async () => {
		const oldDate = new Date("2024-01-01");
		const newDate = new Date("2025-01-01");
		const sinceDate = new Date("2024-06-01");

		await testDb.insert(schema.data).values([
			{
				data: {
					oldField: "old value",
				},
				createdAt: oldDate,
				updatedAt: oldDate,
			},
			{
				data: {
					newField: "new value",
				},
				createdAt: newDate,
				updatedAt: newDate,
			},
		]);

		const result = await getData(sinceDate);

		expect(result).toHaveProperty("newField");
		expect(result).not.toHaveProperty("oldField");
	});

	it("should return empty object when no data records exist", async () => {
		const result = await getData();
		expect(result).toEqual({});
	});
});

describe("saveData", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should create a new data record when no existingDataId provided", async () => {
		const dataPayload = {
			conditions: [{ id: "1", value: "New" }],
			selling_reasons: [{ id: "1", value: "Moving" }],
			item: { title: "Test Item", price: { value: 100, currency: "AUD" } },
		};

		const result = await saveData(dataPayload);

		expect(result.data).toHaveProperty("conditions");
		expect(result.data).toHaveProperty("selling_reasons");
		expect(result.data).toHaveProperty("item");

		const dataRecords = await testDb.select().from(schema.data);
		expect(dataRecords).toHaveLength(1);
	});

	it("should update existing data record when existingDataId provided", async () => {
		// Create data record first
		const existingDataPayload = {
			oldField: "old value",
		};
		const [existingData] = await testDb
			.insert(schema.data)
			.values({
				data: existingDataPayload,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		const updatedDataPayload = {
			newField: "new value",
			conditions: [{ id: "1", value: "Updated" }],
		};

		const result = await saveData(updatedDataPayload, existingData.id);

		expect(result.data).toHaveProperty("newField");
		expect(result.data).toHaveProperty("conditions");

		const dataRecords = await testDb.select().from(schema.data);
		expect(dataRecords).toHaveLength(1);
	});

	it("should reject null payload", async () => {
		await expect(saveData(null)).rejects.toThrow(
			"Data payload must be a non-null object",
		);
	});

	it("should reject non-object payload", async () => {
		await expect(saveData("string payload")).rejects.toThrow(
			"Data payload must be a non-null object",
		);
	});

	it("should accept arbitrary JSON structures", async () => {
		const dataPayload = {
			address: {
				street: "123 Main St",
				city: "Sydney",
				nested: { deep: { value: true } },
			},
			items: [1, 2, 3],
			flag: true,
		};

		const result = await saveData(dataPayload);

		expect(result.data).toEqual(dataPayload);
	});
});

describe("primeData", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should initialize without errors when tables are empty", async () => {
		await expect(primeData()).resolves.toBeUndefined();
	});

	it("should initialize with existing data", async () => {
		const now = new Date();
		await testDb.insert(schema.service).values({
			id: crypto.randomUUID(),
			name: "Service 1",
			description: "Test",
			createdAt: now,
			updatedAt: now,
		});
		await testDb.insert(schema.flow).values({
			data: createTestFlow({
				name: "Flow 1",
				type: "read",
				data: "item",
				pages: [{ title: "P1", rows: [] }],
			}),
			createdAt: now,
			updatedAt: now,
		});

		await expect(primeData()).resolves.toBeUndefined();
	});
});
