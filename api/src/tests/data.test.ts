import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
	mockDb,
	mockStore,
	resetMockStore,
	createMockEq,
	createMockGt,
	createMockDesc,
} from "./mocks/db";

// Mock the database module before importing data functions
mock.module("../db", () => ({
	db: mockDb,
	device: {
		_: { name: "Device" },
		token: { name: "token" },
		os: { name: "os" },
	},
	service: {
		_: { name: "Service" },
		id: { name: "id" },
		name: { name: "name" },
		updatedAt: { name: "updatedAt" },
	},
	organization: {
		_: { name: "Organization" },
		id: { name: "id" },
		name: { name: "name" },
		updatedAt: { name: "updatedAt" },
	},
	serviceProvider: {
		_: { name: "ServiceProvider" },
		id: { name: "id" },
		name: { name: "name" },
		updatedAt: { name: "updatedAt" },
	},
	flow: {
		_: { name: "Flow" },
		id: { name: "id" },
		updatedAt: { name: "updatedAt" },
	},
	osEnum: { enumValues: ["ios", "android", "Web"] },
}));

// Mock drizzle-orm operators
mock.module("drizzle-orm", () => ({
	eq: createMockEq,
	gt: createMockGt,
	desc: createMockDesc,
}));

// Import data functions after mocking
const { validateAuth, crud, getFlows, saveFlow, primeData } = await import(
	"../data"
);

describe("validateAuth", () => {
	beforeEach(() => {
		resetMockStore();
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
		// Add existing device to mock store
		mockStore.devices.push({
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
		expect(mockStore.devices).toHaveLength(1);
		expect(mockStore.devices[0].token).toBe("new-token");
		expect(mockStore.devices[0].os).toBe("android");
	});

	it("should accept Web as valid OS", async () => {
		const result = await validateAuth("web-token", "Web");

		expect(result).toBe(true);
		expect(mockStore.devices).toHaveLength(1);
		expect(mockStore.devices[0].os).toBe("Web");
	});
});

describe("crud", () => {
	beforeEach(() => {
		resetMockStore();
		// Initialize lastTableDataUpdates by calling primeData
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
		// First prime the data so the model is valid
		await primeData();

		await expect(crud("find", "Service")).rejects.toThrow(
			"No filter provided"
		);
	});

	it("should throw error when no data provided for create", async () => {
		await primeData();

		await expect(crud("create", "Service", { id: "123" })).rejects.toThrow(
			"No data provided"
		);
	});

	it("should find records matching filter", async () => {
		await primeData();

		// Add a service to mock store
		const testService = {
			id: "test-id",
			name: "Test Service",
			description: "A test service",
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		mockStore.services.push(testService);

		const result = await crud("find", "Service", { id: "test-id" });
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: "test-id",
			name: "Test Service",
		});
	});

	it("should create a new record", async () => {
		await primeData();

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
		await primeData();

		// Add a service to update
		mockStore.services.push({
			id: "update-id",
			name: "Old Name",
			description: "Old description",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const result = await crud(
			"update",
			"Service",
			{ id: "update-id" },
			{ name: "Updated Name" }
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ name: "Updated Name" });
	});

	it("should delete an existing record", async () => {
		await primeData();

		// Add a service to delete
		mockStore.services.push({
			id: "delete-id",
			name: "To Delete",
			description: "Will be deleted",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		expect(mockStore.services).toHaveLength(1);

		const result = await crud("delete", "Service", { id: "delete-id" });

		expect(result).toHaveLength(1);
		expect(mockStore.services).toHaveLength(0);
	});
});

describe("getFlows", () => {
	beforeEach(() => {
		resetMockStore();
	});

	it("should return all flows when no since date provided", async () => {
		const now = new Date();
		mockStore.flows.push(
			{
				id: "flow-1",
				data: { name: "Flow 1", type: "sell", data: "{}", pages: [] },
				createdAt: now,
				updatedAt: now,
			},
			{
				id: "flow-2",
				data: { name: "Flow 2", type: "buy", data: "{}", pages: [] },
				createdAt: now,
				updatedAt: now,
			}
		);

		const result = await getFlows();

		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("Flow 1");
		expect(result[1].name).toBe("Flow 2");
	});

	it("should filter flows by updatedAt when since date provided", async () => {
		const oldDate = new Date("2024-01-01");
		const newDate = new Date("2025-01-01");
		const sinceDate = new Date("2024-06-01");

		mockStore.flows.push(
			{
				id: "old-flow",
				data: { name: "Old Flow", type: "sell", data: "{}", pages: [] },
				createdAt: oldDate,
				updatedAt: oldDate,
			},
			{
				id: "new-flow",
				data: { name: "New Flow", type: "buy", data: "{}", pages: [] },
				createdAt: newDate,
				updatedAt: newDate,
			}
		);

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
	beforeEach(() => {
		resetMockStore();
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
		expect(mockStore.flows).toHaveLength(1);
	});

	it("should update existing flow when existingFlowId provided", async () => {
		// Add existing flow
		mockStore.flows.push({
			id: "existing-flow-id",
			data: { name: "Old Name", type: "sell", data: "{}", pages: [] },
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const updatedFlowData = {
			name: "Updated Name",
			type: "buy",
			data: '{"updated": true}',
			pages: [{ id: "new-page", title: "New Page" }],
		};

		const result = await saveFlow(updatedFlowData, "existing-flow-id");

		expect(result.name).toBe("Updated Name");
		expect(result.type).toBe("buy");
		expect(mockStore.flows).toHaveLength(1);
	});
});

describe("primeData", () => {
	beforeEach(() => {
		resetMockStore();
	});

	it("should initialize without errors when tables are empty", async () => {
		await expect(primeData()).resolves.toBeUndefined();
	});

	it("should initialize with existing data", async () => {
		const now = new Date();
		mockStore.services.push({
			id: "service-1",
			name: "Service 1",
			description: "Test",
			createdAt: now,
			updatedAt: now,
		});
		mockStore.flows.push({
			id: "flow-1",
			data: { name: "Flow 1", type: "sell", data: "{}", pages: [] },
			createdAt: now,
			updatedAt: now,
		});

		await expect(primeData()).resolves.toBeUndefined();
	});
});
