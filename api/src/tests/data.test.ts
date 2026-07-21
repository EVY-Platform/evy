import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";

import type {
	CreateRequest,
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	DATA_EVY_Service,
	DATA_EVY_ServiceResource,
	DeleteRequest,
	GetRequest,
	UpdateRequest,
} from "evy-types";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import * as schema from "evy-types/db/schema.generated";
import { useFileStorageDirsForTest } from "./fileStorageTestHelpers";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

const coreModule = await import("../data/data");
const {
	create,
	get,
	update,
	deleteResource: deleteCore,
	validateAuth,
} = coreModule;
const uploadModule = await import("../procedures/uploads");
const { clearUploadsForTest, handleUploadChunk } = uploadModule;

const FLOW_RESOURCE = EVY_CORE_RESOURCE.FLOWS;
const PAGE_RESOURCE = EVY_CORE_RESOURCE.PAGES;
const ROW_RESOURCE = EVY_CORE_RESOURCE.ROWS;

function nowIso(): string {
	return new Date().toISOString();
}

function timestamps(): { createdAt: string; updatedAt: string } {
	const iso = nowIso();
	return { createdAt: iso, updatedAt: iso };
}

function flowRow(overrides: Partial<DATA_EVY_Flow> = {}): DATA_EVY_Flow {
	return {
		id: crypto.randomUUID(),
		name: "Flow",
		pageIds: [],
		...timestamps(),
		...overrides,
	};
}

function pageRow(overrides: Partial<DATA_EVY_Page> = {}): DATA_EVY_Page {
	return {
		id: crypto.randomUUID(),
		name: "Page",
		title: "Page",
		rowIds: [],
		...timestamps(),
		...overrides,
	};
}

function rowRow(overrides: Partial<DATA_EVY_Row> = {}): DATA_EVY_Row {
	return {
		id: crypto.randomUUID(),
		name: "Text",
		type: "Text",
		visible: "true",
		data: { title: "", text: "Hello" },
		...timestamps(),
		...overrides,
	};
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
		await expect(validateAuth(dataDb, "", "ios")).rejects.toThrow(
			"No token provided",
		);
	});

	it("should throw error when no OS provided", async () => {
		await expect(
			validateAuth(dataDb, "valid-token", "" as "ios"),
		).rejects.toThrow("No os provided");
	});

	it("should return false for invalid OS", async () => {
		const result = await validateAuth(
			dataDb,
			"valid-token",
			"invalid-os" as "ios",
		);
		expect(result).toBe(false);
	});

	it("should create new device and return true for new token", async () => {
		const result = await validateAuth(dataDb, "new-token", "android");
		expect(result).toBe(true);
		const devices = await testDb.select().from(schema.device);
		expect(devices).toHaveLength(1);
		expect(devices[0].token).toBe("new-token");
		expect(devices[0].os).toBe("android");
	});
});

describe("flat flow resources", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("creates flow, page, and row records", async () => {
		const rowPayload = rowRow();
		const pagePayload = pageRow({ rowIds: [rowPayload.id] });
		const flowPayload = flowRow({ pageIds: [pagePayload.id] });

		const createdRow = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: ROW_RESOURCE,
			data: rowPayload,
		})) as DATA_EVY_Row;
		const createdPage = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: PAGE_RESOURCE,
			data: pagePayload,
		})) as DATA_EVY_Page;
		const createdFlow = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			data: flowPayload,
		})) as DATA_EVY_Flow;

		expect(createdRow.id).toBe(rowPayload.id);
		expect(createdRow.data.text).toBe("Hello");
		expect(createdPage.rowIds).toEqual([rowPayload.id]);
		expect(createdFlow.pageIds).toEqual([pagePayload.id]);
		expect(await testDb.select().from(schema.row)).toHaveLength(1);
		expect(await testDb.select().from(schema.page)).toHaveLength(1);
		expect(await testDb.select().from(schema.flow)).toHaveLength(1);
	});

	it("uses filter.id as the persisted id on create", async () => {
		const flowId = crypto.randomUUID();
		const result = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			filter: { id: flowId },
			data: flowRow({ id: crypto.randomUUID(), name: "Client Flow" }),
		})) as DATA_EVY_Flow;

		expect(result.id).toBe(flowId);
		expect(result.name).toBe("Client Flow");
	});

	it("rejects duplicate creates", async () => {
		const payload = flowRow();
		await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			data: payload,
		});

		await expect(
			create(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: FLOW_RESOURCE,
				data: payload,
			}),
		).rejects.toThrow("Resource already exists");
	});

	it("updates an existing row record", async () => {
		const payload = rowRow();
		await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: ROW_RESOURCE,
			data: payload,
		});

		const result = (await update(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: ROW_RESOURCE,
			filter: { id: payload.id },
			data: { ...payload, name: "Renamed", data: { title: "Updated" } },
		})) as DATA_EVY_Row;

		expect(result.name).toBe("Renamed");
		expect(result.data.title).toBe("Updated");
		expect(result.createdAt).toBe(payload.createdAt);
		expect(Date.parse(result.updatedAt)).not.toBeNaN();
	});

	it("rejects update when a flat record does not exist", async () => {
		await expect(
			update(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: PAGE_RESOURCE,
				filter: { id: crypto.randomUUID() },
				data: pageRow(),
			}),
		).rejects.toThrow("Resource not found");
	});

	it("gets flat records by id and updatedAfter ordered oldest first", async () => {
		const older = flowRow({
			name: "Older",
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		});
		const newer = flowRow({
			name: "Newer",
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
		});
		await testDb.insert(schema.flow).values([older, newer]);

		const all = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
		})) as DATA_EVY_Flow[];
		expect(all.map((flow) => flow.id)).toEqual([older.id, newer.id]);

		const filteredById = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			filter: { id: newer.id },
		})) as DATA_EVY_Flow[];
		expect(filteredById).toHaveLength(1);
		expect(filteredById[0].name).toBe("Newer");

		const filteredByTime = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			filter: { updatedAfter: "2024-01-01T12:00:00.000Z" },
		})) as DATA_EVY_Flow[];
		expect(filteredByTime.map((flow) => flow.id)).toEqual([newer.id]);
	});

	it("deletes flat records", async () => {
		const payload = pageRow();
		await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: PAGE_RESOURCE,
			data: payload,
		});

		const deleted = (await deleteCore(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: PAGE_RESOURCE,
			filter: { id: payload.id },
		})) as DATA_EVY_Page;

		expect(deleted.id).toBe(payload.id);
		expect(await testDb.select().from(schema.page)).toHaveLength(0);
	});

	it("rejects invalid flat flow payloads", async () => {
		await expect(
			create(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: FLOW_RESOURCE,
				data: { id: crypto.randomUUID(), name: "Missing page ids" },
			}),
		).rejects.toThrow("Flow validation failed");
	});
});

describe("service resources", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("creates and updates Service rows", async () => {
		const serviceId = crypto.randomUUID();
		const payload = {
			id: serviceId,
			name: "CreateSvc",
			description: "D",
			...timestamps(),
		};

		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: EVY_CORE_RESOURCE.SERVICES,
			data: payload,
		})) as DATA_EVY_Service;
		expect(created.id).toBe(serviceId);

		const updated = (await update(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: EVY_CORE_RESOURCE.SERVICES,
			filter: { id: serviceId },
			data: { ...payload, name: "UpdatedSvc" },
		})) as DATA_EVY_Service;
		expect(updated.name).toBe("UpdatedSvc");
	});

	it("creates ServiceResource rows", async () => {
		const serviceId = crypto.randomUUID();
		const serviceResourceId = crypto.randomUUID();
		await testDb.insert(schema.service).values({
			id: serviceId,
			name: "marketplace",
			description: "Marketplace",
			...timestamps(),
		});
		const payload = {
			id: serviceResourceId,
			fkServiceId: serviceId,
			name: "item",
			...timestamps(),
		};

		const result = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: EVY_CORE_RESOURCE.SERVICE_RESOURCES,
			data: payload,
		})) as DATA_EVY_ServiceResource;

		expect(result.id).toBe(serviceResourceId);
		expect(result.fkServiceId).toBe(serviceId);
		expect(result.name).toBe("item");
	});
});

describe("files", () => {
	const getFileStorageDirs = useFileStorageDirsForTest("data");

	beforeEach(async () => {
		await clearAllTestTables(testDb);
		clearUploadsForTest();
	});

	it("should create file metadata after upload", async () => {
		const fileId = crypto.randomUUID();
		const bytes = Buffer.from("hello-file");
		const metadata = JSON.stringify({
			uploadId: fileId,
			index: 0,
			byteOffset: 0,
			byteLength: bytes.length,
		});
		const metadataBytes = Buffer.from(metadata);
		const header = Buffer.alloc(4);
		header.writeUInt32BE(metadataBytes.length, 0);
		await handleUploadChunk(Buffer.concat([header, metadataBytes, bytes]));

		const result = await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: EVY_CORE_RESOURCE.FILES,
			filter: { id: fileId },
			data: { id: fileId, type: "text/plain", ...timestamps() },
		} as CreateRequest);

		const { filesDir, uploadTmpDir } = getFileStorageDirs();
		expect(result).toHaveProperty("id", fileId);
		expect(await Bun.file(`${filesDir}/${fileId}`).text()).toBe(
			"hello-file",
		);
		expect(
			await Array.fromAsync(new Bun.Glob("*").scan(uploadTmpDir)),
		).toEqual([]);
	});
});

describe("request validation", () => {
	it("rejects invalid core resources", async () => {
		await expect(
			get(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: "notAResource",
			} as unknown as GetRequest),
		).rejects.toThrow("Resource is not served by the core API");
	});

	it("rejects invalid service ids", async () => {
		await expect(
			get(dataDb, {
				service: "invalid",
				resource: FLOW_RESOURCE,
			} as unknown as GetRequest),
		).rejects.toThrow("Core API only serves service evy");
	});

	it("rejects malformed mutation params", async () => {
		await expect(
			create(dataDb, null as unknown as CreateRequest),
		).rejects.toThrow();
		await expect(
			update(dataDb, null as unknown as UpdateRequest),
		).rejects.toThrow();
		await expect(
			deleteCore(dataDb, null as unknown as DeleteRequest),
		).rejects.toThrow();
	});
});
