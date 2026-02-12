import { describe, it, expect, beforeEach, beforeAll, mock } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { z } from "zod";

import * as schema from "../db/schema";
import type { ValidatedFlowData, RowSchema, PageSchema } from "../validation";
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
const { validateAuth, get, upsert, primeData } = await import("../data");

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

describe("get", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should throw when params is not an object", async () => {
		await expect(get(null)).rejects.toThrow("Params must be an object");
	});

	it("should throw when namespace is invalid", async () => {
		await expect(
			get({ namespace: "invalid", resource: "SDUI" }),
		).rejects.toThrow("Invalid or missing namespace");
	});

	it("should throw when resource is invalid", async () => {
		await expect(
			get({ namespace: "evy", resource: "InvalidResource" }),
		).rejects.toThrow("Invalid or missing resource");
	});

	it("should return all flow data for resource SDUI when no filter", async () => {
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

		const result = (await get({
			namespace: "evy",
			resource: "SDUI",
		})) as ValidatedFlowData[];

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
				type: "read",
				data: "item",
				pages: [{ title: "P1", rows: [] }],
			}),
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const result = (await get({
			namespace: "evy",
			resource: "SDUI",
			filter: { id: flowId },
		})) as ValidatedFlowData[];

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Single Flow");
	});

	it("should return empty array for SDUI when filter.id matches nothing", async () => {
		const result = (await get({
			namespace: "evy",
			resource: "SDUI",
			filter: { id: crypto.randomUUID() },
		})) as ValidatedFlowData[];

		expect(result).toHaveLength(0);
	});

	it("should return namespaced resource data for non-SDUI resource", async () => {
		await upsert({
			namespace: "evy",
			resource: "Conditions",
			data: [{ id: "1", value: "New" }],
		});

		const result = (await get({
			namespace: "evy",
			resource: "Conditions",
		})) as unknown[];

		expect(result).toEqual([{ id: "1", value: "New" }]);
	});

	it("should return empty object for non-SDUI resource when no data", async () => {
		const result = (await get({
			namespace: "evy",
			resource: "Items",
		})) as Record<string, unknown>;

		expect(result).toEqual({});
	});
});

describe("upsert", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should throw when params is not an object", async () => {
		await expect(upsert(null)).rejects.toThrow("Params must be an object");
	});

	it("should throw when data is missing", async () => {
		await expect(
			upsert({ namespace: "evy", resource: "SDUI" }),
		).rejects.toThrow("data is required");
	});

	it("should create new flow for resource SDUI without filter.id", async () => {
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

		const result = (await upsert({
			namespace: "evy",
			resource: "SDUI",
			data: flowData,
		})) as { data: ValidatedFlowData };

		expect(result.data.name).toBe("New Flow");
		expect(result.data.type).toBe("create");
		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
	});

	it("should update existing flow for resource SDUI with filter.id", async () => {
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
							action: { target: "close" },
						},
					],
				},
			],
		});

		const result = (await upsert({
			namespace: "evy",
			resource: "SDUI",
			filter: { id: existingFlow.id },
			data: updatedFlowData,
		})) as { data: ValidatedFlowData };

		expect(result.data.name).toBe("Updated Name");
		expect(result.data.type).toBe("write");
		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
	});

	it("should reject SDUI flow with missing name", async () => {
		await expect(
			upsert({
				namespace: "evy",
				resource: "SDUI",
				data: {
					name: "",
					type: "read",
					data: "item",
					pages: [{ id: "page-1", title: "Page 1", rows: [] }],
				},
			}),
		).rejects.toThrow("Flow validation failed");
	});

	it("should upsert namespaced Data resource", async () => {
		const payload = {
			conditions: [{ id: "1", value: "New" }],
			selling_reasons: [{ id: "1", value: "Moving" }],
		};

		const result = (await upsert({
			namespace: "evy",
			resource: "Conditions",
			data: payload,
		})) as { data: Record<string, unknown> };

		expect(result.data).toHaveProperty("evy");
		expect((result.data.evy as Record<string, unknown>).Conditions).toEqual(
			payload,
		);
		const dataRecords = await testDb.select().from(schema.data);
		expect(dataRecords).toHaveLength(1);
	});
});

describe("upsert SDUI validation", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should reject flow with invalid type", async () => {
		await expect(
			upsert({
				namespace: "evy",
				resource: "SDUI",
				data: {
					name: "Test Flow",
					type: "invalid-type",
					data: "item",
					pages: [{ id: "page-1", title: "Page 1", rows: [] }],
				},
			}),
		).rejects.toThrow("Flow validation failed");
	});

	it("should reject flow with no pages", async () => {
		await expect(
			upsert({
				namespace: "evy",
				resource: "SDUI",
				data: {
					name: "Test Flow",
					type: "read",
					data: "item",
					pages: [],
				},
			}),
		).rejects.toThrow("Flow must have at least one page");
	});

	it("should reject flow with invalid row type", async () => {
		await expect(
			upsert({
				namespace: "evy",
				resource: "SDUI",
				data: {
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
												validation: { required: "true" },
											},
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
										},
									],
								},
							},
						},
					],
				},
			],
		});

		const result = (await upsert({
			namespace: "evy",
			resource: "SDUI",
			data: flowData,
		})) as { data: ValidatedFlowData };
		expect(result.data.name).toBe("Test Flow");
		expect(result.data.pages).toHaveLength(1);
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
							content: { title: "", label: "Submit" },
						},
						action: { target: "submit:item" },
					},
				},
			],
		});

		const result = (await upsert({
			namespace: "evy",
			resource: "SDUI",
			data: flowData,
		})) as { data: ValidatedFlowData };
		expect(result.data.pages[0]).toHaveProperty("footer");
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
