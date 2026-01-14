import { describe, it, expect, beforeEach, beforeAll, mock } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "../db/schema";

// Create in-memory PostgreSQL instance
const client = new PGlite();
const testDb = drizzle(client, { schema });

// Mock the db module to use our test database
mock.module("../db", () => ({
	db: testDb,
	...schema,
}));

// Import data functions after mocking
const { validateAuth, crud, getFlows, saveFlow, primeData } = await import(
	"../data"
);

// Run migrations before all tests
beforeAll(async () => {
	// Apply migrations from the drizzle folder
	await migrate(testDb, { migrationsFolder: "./drizzle" });

	// Clear seed data from migrations for clean test state
	await testDb.execute(sql`DELETE FROM "Flow"`);

	// Prime the data module
	await primeData();
});

// Helper to clear all tables between tests
async function clearTables() {
	await testDb.execute(sql`DELETE FROM "Flow"`);
	await testDb.execute(sql`DELETE FROM "ServiceProvider"`);
	await testDb.execute(sql`DELETE FROM "Organization"`);
	await testDb.execute(sql`DELETE FROM "Service"`);
	await testDb.execute(sql`DELETE FROM "Device"`);
}

describe("validateAuth", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should throw error when no token provided", async () => {
		await expect(validateAuth("", "ios")).rejects.toThrow(
			"No token provided"
		);
	});

	it("should throw error when no OS provided", async () => {
		await expect(validateAuth("valid-token", "" as "ios")).rejects.toThrow(
			"No os provided"
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
		await expect(crud("invalid" as "find", "Service")).rejects.toThrow(
			"Invalid CRUD method"
		);
	});

	it("should throw error for invalid model", async () => {
		await expect(
			crud("find", "InvalidModel", { id: "123" })
		).rejects.toThrow("Invalid model provided");
	});

	it("should throw error when no filter provided for find", async () => {
		await expect(crud("find", "Service")).rejects.toThrow(
			"No filter provided"
		);
	});

	it("should throw error when no data provided for create", async () => {
		await expect(crud("create", "Service", { id: "123" })).rejects.toThrow(
			"No data provided"
		);
	});

	it("should find records matching filter", async () => {
		// Add a service
		const testId = "11111111-1111-1111-1111-111111111111";
		await testDb.insert(schema.service).values({
			id: testId,
			name: "Test Service",
			description: "A test service",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const result = await crud("find", "Service", { id: testId });
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: testId,
			name: "Test Service",
		});
	});

	it("should create a new record", async () => {
		const result = await crud("create", "Service", undefined, {
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
		const testId = "22222222-2222-2222-2222-222222222222";
		await testDb.insert(schema.service).values({
			id: testId,
			name: "Old Name",
			description: "Old description",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const result = await crud(
			"update",
			"Service",
			{ id: testId },
			{ name: "Updated Name" }
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ name: "Updated Name" });
	});

	it("should delete an existing record", async () => {
		const testId = "33333333-3333-3333-3333-333333333333";
		await testDb.insert(schema.service).values({
			id: testId,
			name: "To Delete",
			description: "Will be deleted",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const beforeDelete = await testDb.select().from(schema.service);
		expect(beforeDelete).toHaveLength(1);

		const result = await crud("delete", "Service", { id: testId });

		expect(result).toHaveLength(1);

		const afterDelete = await testDb.select().from(schema.service);
		expect(afterDelete).toHaveLength(0);
	});
});

describe("getFlows", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should return all flows when no since date provided", async () => {
		const now = new Date();
		await testDb.insert(schema.flow).values([
			{
				data: { name: "Flow 1", type: "sell", data: "{}", pages: [] },
				createdAt: now,
				updatedAt: now,
			},
			{
				data: { name: "Flow 2", type: "buy", data: "{}", pages: [] },
				createdAt: now,
				updatedAt: now,
			},
		]);

		const result = await getFlows();

		expect(result).toHaveLength(2);
	});

	it("should filter flows by updatedAt when since date provided", async () => {
		const oldDate = new Date("2024-01-01");
		const newDate = new Date("2025-01-01");
		const sinceDate = new Date("2024-06-01");

		await testDb.insert(schema.flow).values([
			{
				data: { name: "Old Flow", type: "sell", data: "{}", pages: [] },
				createdAt: oldDate,
				updatedAt: oldDate,
			},
			{
				data: { name: "New Flow", type: "buy", data: "{}", pages: [] },
				createdAt: newDate,
				updatedAt: newDate,
			},
		]);

		const result = await getFlows(sinceDate);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("New Flow");
	});

	it("should return empty array when no flows exist", async () => {
		const result = await getFlows();
		expect(result).toHaveLength(0);
	});
});

describe("saveFlow", () => {
	beforeEach(async () => {
		await clearTables();
	});

	it("should create a new flow when no existingFlowId provided", async () => {
		const flowData = {
			name: "New Flow",
			type: "sell",
			data: "{}",
			pages: [{ id: "page-1", title: "Page 1" }],
		};

		const result = await saveFlow(flowData);

		expect(result.name).toBe("New Flow");
		expect(result.type).toBe("sell");
		expect(result.pages).toHaveLength(1);

		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
	});

	it("should update existing flow when existingFlowId provided", async () => {
		// Create flow first
		const [existingFlow] = await testDb
			.insert(schema.flow)
			.values({
				data: { name: "Old Name", type: "sell", data: "{}", pages: [] },
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		const updatedFlowData = {
			name: "Updated Name",
			type: "buy",
			data: '{"updated": true}',
			pages: [{ id: "new-page", title: "New Page" }],
		};

		const result = await saveFlow(updatedFlowData, existingFlow.id);

		expect(result.name).toBe("Updated Name");
		expect(result.type).toBe("buy");

		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
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
			id: "44444444-4444-4444-4444-444444444444",
			name: "Service 1",
			description: "Test",
			createdAt: now,
			updatedAt: now,
		});
		await testDb.insert(schema.flow).values({
			data: { name: "Flow 1", type: "sell", data: "{}", pages: [] },
			createdAt: now,
			updatedAt: now,
		});

		await expect(primeData()).resolves.toBeUndefined();
	});
});
