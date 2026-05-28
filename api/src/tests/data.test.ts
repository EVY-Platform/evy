import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";

import type {
	UI_Flow,
	UI_Page,
	UI_Row,
	DATA_EVY_Flow,
	DATA_EVY_Service,
	CreateRequest,
	CreateResponse,
	UpdateRequest,
	UpdateResponse,
	GetRequest,
} from "evy-types";
import { validateUiFlow as validateFlowData } from "evy-types/validators";
import * as schema from "../../../types/generated/ts/db/schema.generated";
import { useImageStorageDirsForTest } from "./imageStorageTestHelpers";
import { clearAllTestTables, createPgliteTestDatabase } from "./wsTestHelpers";

type ValidatedRow = UI_Row;
type ValidatedPage = UI_Page;

type RowInput = Omit<ValidatedRow, "id" | "view" | "source"> & {
	id?: string;
	source?: string;
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

const coreModule = await import("../data/core");
const { create, get, update, delete: deleteCore } = coreModule;
const devicesModule = await import("../data/devices");
const { validateAuth } = devicesModule;
const dbModule = await import("../data/db");
const { setDbForTest } = dbModule;
setDbForTest(testDb as unknown as Parameters<typeof setDbForTest>[0]);
const uploadModule = await import("../procedures/uploads");
const { clearUploadsForTest, handleUploadChunk } = uploadModule;
function isDATA_EVY_Flow(
	result: CreateResponse | UpdateResponse,
): result is DATA_EVY_Flow {
	return (
		result !== null &&
		typeof result === "object" &&
		"data" in result &&
		typeof result.data === "object" &&
		result.data !== null &&
		"name" in result.data
	);
}

function expectToBeDATA_EVY_Flow(
	result: CreateResponse | UpdateResponse,
): asserts result is DATA_EVY_Flow {
	expect(isDATA_EVY_Flow(result)).toBe(true);
	if (!isDATA_EVY_Flow(result)) {
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
			source: row.source ?? "",
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

describe("create", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("should throw when params is not an object", async () => {
		await expect(create(null as unknown as CreateRequest)).rejects.toThrow();
	});

	it("should throw when data is missing", async () => {
		await expect(
			create({
				service: "evy",
				resource: "sdui",
			} as unknown as CreateRequest),
		).rejects.toThrow("Flow validation failed");
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

		const result = await create({
			service: "evy",
			resource: "sdui",
			data: flowData,
		});

		expectToBeDATA_EVY_Flow(result);
		expect(result.data.name).toBe("New Flow");
		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
	});

	it("should create new flow with filter.id", async () => {
		const flowId = crypto.randomUUID();
		const flowData = createTestFlow({
			id: flowId,
			name: "Client Created Flow",
			pages: [{ title: "Draft", rows: [] }],
		});

		const result = await create({
			service: "evy",
			resource: "sdui",
			filter: { id: flowId },
			data: flowData,
		});

		expectToBeDATA_EVY_Flow(result);
		expect(result.id).toBe(flowId);
		expect(result.data.id).toBe(flowId);
		expect(result.data.name).toBe("Client Created Flow");
	});

	it("should fail to create duplicate flow", async () => {
		const flowId = crypto.randomUUID();
		const flowData = createTestFlow({
			id: flowId,
			name: "Duplicate Test",
			pages: [{ title: "P1", rows: [] }],
		});

		await create({
			service: "evy",
			resource: "sdui",
			data: flowData,
		});

		await expect(
			create({
				service: "evy",
				resource: "sdui",
				data: flowData,
			}),
		).rejects.toThrow();
	});

	it("should create Service resource into the Service table", async () => {
		const nowIso = new Date().toISOString();
		const serviceId = crypto.randomUUID();
		const payload = {
			id: serviceId,
			name: "CreateSvc",
			description: "D",
			createdAt: nowIso,
			updatedAt: nowIso,
		};

		const result = await create({
			service: "evy",
			resource: "services",
			data: payload,
		});

		const row = result as DATA_EVY_Service;
		expect(row.id).toBe(serviceId);
		expect(row.name).toBe("CreateSvc");
		expect(row.description).toBe("D");
		const svcRows = await testDb.select().from(schema.service);
		expect(svcRows).toHaveLength(1);
		expect(svcRows[0].id).toBe(serviceId);
		expect(svcRows[0].name).toBe("CreateSvc");
	});
});

describe("update", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("should throw when params is not an object", async () => {
		await expect(update(null as unknown as UpdateRequest)).rejects.toThrow();
	});

	it("should throw when data is missing", async () => {
		await expect(
			update({
				service: "evy",
				resource: "sdui",
				filter: { id: "x" },
			} as unknown as UpdateRequest),
		).rejects.toThrow("Flow validation failed");
	});

	it("should throw when filter.id is missing", async () => {
		await expect(
			update({
				service: "evy",
				resource: "sdui",
				data: { name: "test", pages: [] },
			} as unknown as UpdateRequest),
		).rejects.toThrow();
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
							actions: [{ condition: "", false: "", true: "{close()}" }],
						},
					],
				},
			],
		});

		const result = await update({
			service: "evy",
			resource: "sdui",
			filter: { id: existingFlow.id },
			data: updatedFlowData,
		});

		expectToBeDATA_EVY_Flow(result);
		expect(result.data.name).toBe("Updated Name");
		const flows = await testDb.select().from(schema.flow);
		expect(flows).toHaveLength(1);
	});

	it("should fail to update non-existent flow", async () => {
		await expect(
			update({
				service: "evy",
				resource: "sdui",
				filter: { id: crypto.randomUUID() },
				data: createTestFlow({
					name: "Non Existent",
					pages: [{ title: "P1", rows: [] }],
				}),
			}),
		).rejects.toThrow("Resource not found");
	});

	it("should update Service resource into the Service table", async () => {
		const nowIso = new Date().toISOString();
		const serviceId = crypto.randomUUID();
		const payload = {
			id: serviceId,
			name: "CreateSvc",
			description: "D",
			createdAt: nowIso,
			updatedAt: nowIso,
		};

		await create({
			service: "evy",
			resource: "services",
			data: payload,
		});

		const updatedPayload = {
			id: serviceId,
			name: "UpdatedSvc",
			description: "Updated",
			createdAt: nowIso,
			updatedAt: nowIso,
		};

		const result = await update({
			service: "evy",
			resource: "services",
			filter: { id: serviceId },
			data: updatedPayload,
		});

		const row = result as DATA_EVY_Service;
		expect(row.name).toBe("UpdatedSvc");
		const svcRows = await testDb.select().from(schema.service);
		expect(svcRows).toHaveLength(1);
		expect(svcRows[0].name).toBe("UpdatedSvc");
	});
});

describe("get", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("should throw when params is not an object", async () => {
		await expect(get(null as unknown as GetRequest)).rejects.toThrow(
			"is not an object",
		);
	});

	it("should throw when service is invalid", async () => {
		await expect(
			get({
				service: "invalid",
				resource: "sdui",
			} as unknown as GetRequest),
		).rejects.toThrow("Core API only serves service evy");
	});

	it("should throw when resource is invalid", async () => {
		await expect(
			get({
				service: "evy",
				resource: "InvalidResource",
			} as unknown as GetRequest),
		).rejects.toThrow("Resource is not served by the core API");
	});

	it("should throw when service and resource do not match the shared contract", async () => {
		await expect(
			get({
				service: "evy",
				resource: "items",
			} as unknown as GetRequest),
		).rejects.toThrow("Resource is not served by the core API");
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

		const result = await get({
			service: "evy",
			resource: "sdui",
		});

		expect(result).toHaveLength(2);
		expect(result[0]).toHaveProperty("name");
		expect(result[0]).toHaveProperty("pages");
	});

	it("should return flow data ordered by oldest first", async () => {
		const olderFlow = createTestFlow({
			name: "Older Flow",
			pages: [{ title: "P1", rows: [] }],
		});
		const newerFlow = createTestFlow({
			name: "Newer Flow",
			pages: [{ title: "P2", rows: [] }],
		});
		await testDb.insert(schema.flow).values([
			{
				id: olderFlow.id,
				data: olderFlow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: newerFlow.id,
				data: newerFlow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: "evy",
			resource: "sdui",
		});

		expect(result.map((flow) => flow.id)).toEqual([olderFlow.id, newerFlow.id]);
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

		const result = await get({
			service: "evy",
			resource: "sdui",
			filter: { id: flowId },
		});

		expect(result).toHaveLength(1);
		const flow = result[0] as UI_Flow;
		expect(flow.name).toBe("Single Flow");
	});

	it("should return empty array for SDUI when filter.id matches nothing", async () => {
		const result = await get({
			service: "evy",
			resource: "sdui",
			filter: { id: crypto.randomUUID() },
		});

		expect(result).toHaveLength(0);
	});

	it("should reject SDUI get when stored flow data fails Flow validation", async () => {
		const flowId = crypto.randomUUID();
		const badData = { id: flowId, name: "Corrupt" };
		await testDb.insert(schema.flow).values({
			id: flowId,
			data: badData as unknown as UI_Flow,
			...testFlowRowTimestamps(),
		});

		await expect(
			get({
				service: "evy",
				resource: "sdui",
				filter: { id: flowId },
			}),
		).rejects.toThrow("Flow validation failed");
	});

	it("should reject SDUI list get when any stored flow fails Flow validation", async () => {
		const flowId = crypto.randomUUID();
		const badData = { id: flowId, name: "", pages: [] };
		await testDb.insert(schema.flow).values({
			id: flowId,
			data: badData as unknown as UI_Flow,
			...testFlowRowTimestamps(),
		});

		await expect(
			get({
				service: "evy",
				resource: "sdui",
			}),
		).rejects.toThrow("Flow validation failed");
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
		await create({
			service: "evy",
			resource: "services",
			data: serviceData,
		});

		const result = await get({
			service: "evy",
			resource: "services",
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: serviceData.id,
			name: serviceData.name,
			description: serviceData.description,
			createdAt: serviceData.createdAt,
		});
		const serviceRow = result[0];
		if (!("updatedAt" in serviceRow)) {
			throw new Error("Expected service row with updatedAt");
		}
		expect(typeof serviceRow.updatedAt).toBe("string");
	});

	it("should return non-SDUI resources ordered by oldest first", async () => {
		const olderService = {
			id: crypto.randomUUID(),
			name: "OlderSvc",
			description: "Older",
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		};
		const newerService = {
			id: crypto.randomUUID(),
			name: "NewerSvc",
			description: "Newer",
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
		};
		await testDb.insert(schema.service).values([olderService, newerService]);

		const result = await get({
			service: "evy",
			resource: "services",
		});

		expect(result.map((row) => row.id)).toEqual([
			olderService.id,
			newerService.id,
		]);
	});

	it("should return empty array for non-SDUI resource when no data", async () => {
		const result = await get({
			service: "evy",
			resource: "services",
		});

		expect(result).toEqual([]);
	});
});

describe("create SDUI validation", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("should reject flow with unrecognized keys", async () => {
		await expect(
			create({
				service: "evy",
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
		const result = await create({
			service: "evy",
			resource: "sdui",
			data: {
				id: crypto.randomUUID(),
				name: "Test Flow",
				pages: [],
			},
		});
		expectToBeDATA_EVY_Flow(result);
		expect(result.data.pages).toHaveLength(0);
	});

	it("should reject flow with invalid row type", async () => {
		await expect(
			create({
				service: "evy",
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

		const result = await create({
			service: "evy",
			resource: "sdui",
			data: flowData,
		});
		expectToBeDATA_EVY_Flow(result);
		expect(result.data.name).toBe("Test Flow");
		expect(result.data.pages).toHaveLength(1);
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
						actions: [
							{ condition: "", false: "", true: "{create(marketplace,item)}" },
						],
					},
				},
			],
		});

		const result = await create({
			service: "evy",
			resource: "sdui",
			data: flowData,
		});
		expectToBeDATA_EVY_Flow(result);
		expect(result.data.pages[0]).toHaveProperty("footer");
	});
});

describe("images", () => {
	const now = "2024-01-19T12:00:00.000Z";
	const validJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
	const validPngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
	const getImageStorageDirs = useImageStorageDirsForTest("data-images");

	function buildChunkFrame(metadata: object, chunkData: Buffer): Buffer {
		const metadataBytes = Buffer.from(JSON.stringify(metadata), "utf-8");
		const prefix = Buffer.alloc(4);
		prefix.writeUInt32BE(metadataBytes.length, 0);
		return Buffer.concat([prefix, metadataBytes, chunkData]);
	}

	async function stageUpload(
		uploadId: string,
		type: "image/jpeg" | "image/png",
		bytes: Buffer,
	): Promise<void> {
		await handleUploadChunk(
			buildChunkFrame(
				{
					type,
					uploadId,
					index: 0,
					byteOffset: 0,
					byteLength: bytes.length,
				},
				bytes,
			),
		);
	}

	beforeEach(async () => {
		await clearAllTestTables(testDb);
		clearUploadsForTest();
	});

	it("rejects image create when no uploaded binary exists", async () => {
		const imageId = crypto.randomUUID();
		await expect(
			create({
				service: "evy",
				resource: "images",
				filter: { id: imageId },
				data: {
					id: imageId,
					type: "image/jpeg",
					createdAt: now,
					updatedAt: now,
				},
			}),
		).rejects.toThrow("No upload found for image id");
	});

	it("creates image binary and metadata through core create", async () => {
		const imageId = crypto.randomUUID();
		await stageUpload(imageId, "image/jpeg", validJpegBytes);

		const result = await create({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
			data: { id: imageId, type: "image/jpeg", createdAt: now, updatedAt: now },
		});

		expect(result).toMatchObject({ id: imageId, type: "image/jpeg" });
		const storedBinary = await readFile(
			join(getImageStorageDirs().imagesDir, `${imageId}.jpg`),
		);
		expect(storedBinary).toEqual(validJpegBytes);
	});

	it("uses filter id as persisted image id", async () => {
		const imageId = crypto.randomUUID();
		await stageUpload(imageId, "image/jpeg", validJpegBytes);

		const result = await create({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
			data: {
				id: crypto.randomUUID(),
				type: "image/jpeg",
				createdAt: now,
				updatedAt: now,
			},
		});

		expect(result).toMatchObject({ id: imageId, type: "image/jpeg" });
	});

	it("rejects duplicate image create with resource already exists", async () => {
		const imageId = crypto.randomUUID();
		await stageUpload(imageId, "image/jpeg", validJpegBytes);
		await create({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
			data: { id: imageId, type: "image/jpeg", createdAt: now, updatedAt: now },
		});
		await stageUpload(imageId, "image/jpeg", validJpegBytes);

		await expect(
			create({
				service: "evy",
				resource: "images",
				filter: { id: imageId },
				data: {
					id: imageId,
					type: "image/jpeg",
					createdAt: now,
					updatedAt: now,
				},
			}),
		).rejects.toThrow("Resource already exists");
	});

	it("gets image metadata through core get", async () => {
		const imageId = crypto.randomUUID();
		await stageUpload(imageId, "image/png", validPngBytes);
		await create({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
			data: { id: imageId, type: "image/png", createdAt: now, updatedAt: now },
		});
		const result = await get({ service: "evy", resource: "images" });
		const found = (result as object[]).find(
			(r) => (r as { id: string }).id === imageId,
		);
		expect(found).toBeDefined();
		expect((found as { type: string }).type).toBe("image/png");
	});

	it("filters by id", async () => {
		const imageId = crypto.randomUUID();
		const otherId = crypto.randomUUID();
		await stageUpload(imageId, "image/jpeg", validJpegBytes);
		await stageUpload(otherId, "image/png", validPngBytes);
		await create({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
			data: { id: imageId, type: "image/jpeg", createdAt: now, updatedAt: now },
		});
		await create({
			service: "evy",
			resource: "images",
			filter: { id: otherId },
			data: { id: otherId, type: "image/png", createdAt: now, updatedAt: now },
		});
		const result = await get({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
		});
		expect((result as object[]).length).toBe(1);
		expect((result as { id: string }[])[0].id).toBe(imageId);
	});

	it("filters by updatedAfter", async () => {
		const imageId = crypto.randomUUID();
		const newIso = "2030-01-01T00:00:00.000Z";
		await stageUpload(imageId, "image/jpeg", validJpegBytes);
		await create({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
			data: {
				id: imageId,
				type: "image/jpeg",
				createdAt: now,
				updatedAt: now,
			},
		});
		const result = await get({
			service: "evy",
			resource: "images",
			filter: { updatedAfter: newIso },
		});
		expect((result as object[]).length).toBe(0);
	});

	it("rejects upload type mismatch", async () => {
		const imageId = crypto.randomUUID();
		await stageUpload(imageId, "image/png", validPngBytes);

		await expect(
			create({
				service: "evy",
				resource: "images",
				filter: { id: imageId },
				data: {
					id: imageId,
					type: "image/jpeg",
					createdAt: now,
					updatedAt: now,
				},
			}),
		).rejects.toThrow("Upload type mismatch");
	});

	it("rejects invalid image bytes", async () => {
		const imageId = crypto.randomUUID();
		await stageUpload(imageId, "image/jpeg", Buffer.from([0x00, 0x00, 0x00]));

		await expect(
			create({
				service: "evy",
				resource: "images",
				filter: { id: imageId },
				data: {
					id: imageId,
					type: "image/jpeg",
					createdAt: now,
					updatedAt: now,
				},
			}),
		).rejects.toThrow("Invalid magic bytes");
	});

	it("rejects invalid image type", async () => {
		const imageId = crypto.randomUUID();
		await expect(
			create({
				service: "evy",
				resource: "images",
				filter: { id: imageId },
				data: {
					id: imageId,
					type: "image/gif",
					createdAt: now,
					updatedAt: now,
				},
			}),
		).rejects.toThrow();
	});

	it("deletes image binary and metadata through generic delete", async () => {
		const imageId = crypto.randomUUID();
		await stageUpload(imageId, "image/jpeg", validJpegBytes);
		await create({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
			data: { id: imageId, type: "image/jpeg", createdAt: now, updatedAt: now },
		});

		const result = await deleteCore({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
		});

		expect(result).toMatchObject({ id: imageId, type: "image/jpeg" });
		await expect(
			readFile(join(getImageStorageDirs().imagesDir, `${imageId}.jpg`)),
		).rejects.toThrow();
		const rows = await get({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
		});
		expect(rows).toHaveLength(0);
	});

	it("deletes image metadata when binary is already missing", async () => {
		const imageId = crypto.randomUUID();
		await testDb.insert(schema.image).values({
			id: imageId,
			type: "image/png",
			createdAt: now,
			updatedAt: now,
		});

		const result = await deleteCore({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
		});

		expect(result).toMatchObject({ id: imageId, type: "image/png" });
		const rows = await get({
			service: "evy",
			resource: "images",
			filter: { id: imageId },
		});
		expect(rows).toHaveLength(0);
	});

	it("rejects deleting a missing image", async () => {
		await expect(
			deleteCore({
				service: "evy",
				resource: "images",
				filter: { id: crypto.randomUUID() },
			}),
		).rejects.toThrow("Image not found");
	});

	it("rejects deleting non-image core resources", async () => {
		await expect(
			deleteCore({
				service: "evy",
				resource: "services",
				filter: { id: crypto.randomUUID() },
			}),
		).rejects.toThrow("Delete is not supported for this resource");
	});
});
