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
	DATA_EVY_Address,
	DATA_EVY_Flow,
	DATA_EVY_Message,
	DATA_EVY_Page,
	DATA_EVY_Row,
	DATA_EVY_Service,
	DeleteRequest,
	GetRequest,
	UpdateRequest,
} from "evy-types";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import * as schema from "evy-types/db/schema.generated";
import { ROTHCHILD_CANONICAL_ADDRESS } from "../../../scripts/fixtures/canonicalAddresses";
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
	getOwnedMessages,
	update,
	deleteResource: deleteCore,
	validateAuth,
} = coreModule;
const uploadModule = await import("../procedures/uploads");
const { clearUploadsForTest, handleUploadChunk } = uploadModule;

const FLOW_RESOURCE = EVY_CORE_RESOURCE.FLOWS;
const PAGE_RESOURCE = EVY_CORE_RESOURCE.PAGES;
const ROW_RESOURCE = EVY_CORE_RESOURCE.ROWS;
const ADDRESS_RESOURCE = EVY_CORE_RESOURCE.ADDRESSES;
const MESSAGE_RESOURCE = EVY_CORE_RESOURCE.MESSAGES;
const FORMATTER_RESOURCE = EVY_CORE_RESOURCE.FORMATTERS;

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
		visibility: "public",
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
		visibility: "public",
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
		visibility: "public",
		...timestamps(),
		...overrides,
	};
}

function addressRow(
	overrides: Partial<DATA_EVY_Address> = {},
): DATA_EVY_Address {
	return {
		...ROTHCHILD_CANONICAL_ADDRESS,
		id: crypto.randomUUID(),
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

	it("round-trips a flow submits declaration through create, get and update", async () => {
		const submits = {
			service: "66b092ae-7cd8-4d67-95b7-30b03568fd90",
			resource: "dc28ed59-298e-493c-8ff3-3e60f2ebccbd",
		};
		const flowPayload = { ...flowRow({ pageIds: [] }), submits };

		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			data: flowPayload,
		})) as DATA_EVY_Flow;
		expect(created.submits).toEqual(submits);

		const [fetched] = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			filter: { id: flowPayload.id },
		})) as DATA_EVY_Flow[];
		expect(fetched?.submits).toEqual(submits);

		const updated = (await update(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			filter: { id: flowPayload.id },
			data: { ...flowPayload, submits: undefined },
		})) as DATA_EVY_Flow;
		expect(updated.submits).toBeUndefined();
	});

	it("omits submits entirely when a flow does not declare one", async () => {
		const flowPayload = flowRow({ pageIds: [] });

		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			data: flowPayload,
		})) as DATA_EVY_Flow;

		expect(created.submits).toBeUndefined();
		expect("submits" in created).toBe(false);
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
		// Soft delete: the row survives as a tombstone so incremental syncs can
		// tell clients it is gone, but plain reads no longer return it.
		const [tombstone] = await testDb.select().from(schema.page);
		expect(tombstone?.deletedAt).toBeTruthy();
		expect(
			await get(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: PAGE_RESOURCE,
			}),
		).toEqual([]);
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

describe("address resources", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("lists empty then creates, lists, updates, and deletes addresses", async () => {
		const empty = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: ADDRESS_RESOURCE,
		})) as DATA_EVY_Address[];
		expect(empty).toEqual([]);

		const payload = addressRow();
		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: ADDRESS_RESOURCE,
			data: payload,
		})) as DATA_EVY_Address;
		expect(created.id).toBe(payload.id);
		expect(created.street).toBe("28 Rothschild Avenue");
		expect(created.latitude).toBe(-33.9172075);
		expect(created.visibility).toBe("private");

		const listed = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: ADDRESS_RESOURCE,
		})) as DATA_EVY_Address[];
		expect(listed).toHaveLength(1);
		expect(listed[0].id).toBe(payload.id);

		const updated = (await update(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: ADDRESS_RESOURCE,
			filter: { id: payload.id },
			data: { ...payload, unit: "C510", instructions: "Buzz 509" },
		})) as DATA_EVY_Address;
		expect(updated.unit).toBe("C510");
		expect(updated.instructions).toBe("Buzz 509");
		expect(updated.visibility).toBe("private");
		expect(updated.createdAt).toBe(payload.createdAt);

		const deleted = (await deleteCore(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: ADDRESS_RESOURCE,
			filter: { id: payload.id },
		})) as DATA_EVY_Address;
		expect(deleted.id).toBe(payload.id);
		// Soft delete: the row survives as a tombstone so incremental syncs can
		// tell clients it is gone, but plain reads no longer return it.
		const [tombstone] = await testDb.select().from(schema.address);
		expect(tombstone?.deletedAt).toBeTruthy();
		expect(
			await get(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: ADDRESS_RESOURCE,
			}),
		).toEqual([]);
	});

	it("rejects invalid address payloads", async () => {
		await expect(
			create(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: ADDRESS_RESOURCE,
				data: {
					id: "not-a-uuid",
					street: "Somewhere",
				},
			}),
		).rejects.toThrow("Address validation failed");
	});

	it("accepts partial address payloads", async () => {
		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: ADDRESS_RESOURCE,
			data: {
				id: crypto.randomUUID(),
				street: "Manual Street",
			},
		})) as DATA_EVY_Address;
		expect(created.street).toBe("Manual Street");
		expect(created.visibility).toBe("private");
		expect(created.city).toBeUndefined();
		expect(created.latitude).toBeUndefined();
	});
});

describe("visibility defaults", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("defaults flow visibility to public when omitted from payload", async () => {
		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			data: {
				id: crypto.randomUUID(),
				name: "Public Flow",
				pageIds: [],
			},
		})) as DATA_EVY_Flow;
		expect(created.visibility).toBe("public");
	});

	it("round-trips explicit private visibility on flows", async () => {
		const flowId = crypto.randomUUID();
		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			data: {
				id: flowId,
				name: "Private Flow",
				pageIds: [],
				visibility: "private",
			},
		})) as DATA_EVY_Flow;
		expect(created.visibility).toBe("private");

		const listed = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
		})) as DATA_EVY_Flow[];
		expect(listed[0].visibility).toBe("private");
	});
});

describe("message resources", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("lists empty then creates, lists, updates, and deletes messages", async () => {
		const empty = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: MESSAGE_RESOURCE,
		})) as DATA_EVY_Message[];
		expect(empty).toEqual([]);

		const payload = {
			fk: crypto.randomUUID(),
			service: crypto.randomUUID(),
			resource: crypto.randomUUID(),
			status: "pending" as const,
			data: { type: "pickup", time: "2026-06-03T09:00:00" },
		};
		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: MESSAGE_RESOURCE,
			data: payload,
		})) as DATA_EVY_Message;
		expect(created.id).toBeDefined();
		expect(created.updatedAt).toBeDefined();
		expect(created.status).toBe("pending");
		expect(created.visibility).toBe("public");

		const listed = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: MESSAGE_RESOURCE,
		})) as DATA_EVY_Message[];
		expect(listed).toHaveLength(1);

		const updated = (await update(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: MESSAGE_RESOURCE,
			filter: { id: created.id },
			data: { ...created, status: "accepted" },
		})) as DATA_EVY_Message;
		expect(updated.status).toBe("accepted");

		const archived = (await update(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: MESSAGE_RESOURCE,
			filter: { id: created.id },
			data: { ...updated, archivedAt: nowIso() },
		})) as DATA_EVY_Message;
		expect(archived.archivedAt).toBeDefined();

		const deleted = (await deleteCore(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: MESSAGE_RESOURCE,
			filter: { id: created.id },
		})) as DATA_EVY_Message;
		expect(deleted.id).toBe(created.id);
		// Soft delete: the row survives as a tombstone so incremental syncs can
		// tell clients it is gone, but plain reads no longer return it.
		const [tombstone] = await testDb.select().from(schema.message);
		expect(tombstone?.deletedAt).toBeTruthy();
		expect(
			await get(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: MESSAGE_RESOURCE,
			}),
		).toEqual([]);
	});

	it("rejects invalid message payloads", async () => {
		await expect(
			create(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: MESSAGE_RESOURCE,
				data: {
					id: crypto.randomUUID(),
					fk: crypto.randomUUID(),
					service: crypto.randomUUID(),
					resource: crypto.randomUUID(),
					status: "invalid",
					data: {},
				},
			}),
		).rejects.toThrow("Message validation failed");
	});
});

describe("getOwnedMessages", () => {
	const targetService = crypto.randomUUID();
	const targetResource = crypto.randomUUID();
	const ownedFk = crypto.randomUUID();
	const otherFk = crypto.randomUUID();

	async function createMessage(fk: string): Promise<DATA_EVY_Message> {
		return (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: MESSAGE_RESOURCE,
			data: {
				fk,
				service: targetService,
				resource: targetResource,
				status: "pending" as const,
				data: { type: "pickup" },
			},
		})) as DATA_EVY_Message;
	}

	/** An ownership group over the service resource `createMessage` addresses. */
	function owns(...fks: string[]) {
		return [{ service: targetService, resource: targetResource, ids: fks }];
	}

	async function ownedIds(
		params: Parameters<typeof getOwnedMessages>[1],
	): Promise<string[]> {
		const owned = (await getOwnedMessages(
			dataDb,
			params,
		)) as DATA_EVY_Message[];
		return owned.map((message) => message.id);
	}

	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("returns nothing when the device owns nothing", async () => {
		await createMessage(ownedFk);

		expect(
			await ownedIds({ ownedMessageIds: [], ownedForeignKeys: [] }),
		).toEqual([]);
	});

	it("returns only messages the device created", async () => {
		const mine = await createMessage(otherFk);
		await createMessage(otherFk);

		expect(
			await ownedIds({
				ownedMessageIds: [mine.id],
				ownedForeignKeys: [],
			}),
		).toEqual([mine.id]);
	});

	it("returns only messages addressed to a record the device owns", async () => {
		const addressed = await createMessage(ownedFk);
		await createMessage(otherFk);

		expect(
			await ownedIds({
				ownedMessageIds: [],
				ownedForeignKeys: owns(ownedFk),
			}),
		).toEqual([addressed.id]);
	});

	it("returns the union of created and addressed messages", async () => {
		const addressed = await createMessage(ownedFk);
		const mine = await createMessage(otherFk);
		await createMessage(otherFk);

		const owned = await ownedIds({
			ownedMessageIds: [mine.id],
			ownedForeignKeys: owns(ownedFk),
		});

		expect(owned.toSorted()).toEqual([addressed.id, mine.id].toSorted());
	});

	it("matches the fk only within its own service and resource", async () => {
		await createMessage(ownedFk);

		expect(
			await ownedIds({
				ownedMessageIds: [],
				ownedForeignKeys: [
					{
						service: crypto.randomUUID(),
						resource: targetResource,
						ids: [ownedFk],
					},
				],
			}),
		).toEqual([]);
	});

	it("excludes owned messages unchanged since updatedAfter", async () => {
		const mine = await createMessage(otherFk);

		expect(
			await ownedIds({
				updatedAfter: mine.updatedAt,
				ownedMessageIds: [mine.id],
				ownedForeignKeys: [],
			}),
		).toEqual([]);
	});

	it("carries tombstones to the owner on an incremental read", async () => {
		const mine = await createMessage(otherFk);
		const before = mine.updatedAt;
		await deleteCore(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: MESSAGE_RESOURCE,
			filter: { id: mine.id },
		});

		const incremental = (await getOwnedMessages(dataDb, {
			updatedAfter: before,
			ownedMessageIds: [mine.id],
			ownedForeignKeys: [],
		})) as DATA_EVY_Message[];
		expect(incremental).toHaveLength(1);
		expect(incremental[0].deletedAt).toBeTruthy();

		// A plain read still hides it, matching coreResource.list.
		expect(
			await ownedIds({
				ownedMessageIds: [mine.id],
				ownedForeignKeys: [],
			}),
		).toEqual([]);
	});

	// Message.service and Message.resource are uuid columns, so a core resource
	// name would make Postgres throw on the cast. A message can never reference a
	// core resource by name, so dropping the group is the correct answer.
	it("ignores owned groups that cannot address a message", async () => {
		const addressed = await createMessage(ownedFk);

		expect(
			await ownedIds({
				ownedMessageIds: [],
				ownedForeignKeys: [
					{
						service: EVY_CORE_SERVICE,
						resource: EVY_CORE_RESOURCE.ADDRESSES,
						ids: [crypto.randomUUID()],
					},
					...owns(ownedFk),
				],
			}),
		).toEqual([addressed.id]);
	});

	it("ignores owned groups with no ids", async () => {
		await createMessage(ownedFk);

		expect(
			await ownedIds({ ownedMessageIds: [], ownedForeignKeys: owns() }),
		).toEqual([]);
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

describe("tombstones", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	async function createAndDeleteFlow() {
		const payload = flowRow();
		await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			data: payload,
		});
		await deleteCore(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			filter: { id: payload.id },
		});
		return payload;
	}

	it("hides a deleted record from a plain read", async () => {
		await createAndDeleteFlow();

		expect(
			await get(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: FLOW_RESOURCE,
			}),
		).toEqual([]);
	});

	it("hides a deleted record from a read by id", async () => {
		const payload = await createAndDeleteFlow();

		expect(
			await get(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: FLOW_RESOURCE,
				filter: { id: payload.id },
			}),
		).toEqual([]);
	});

	// Without this a client can never learn that a record it holds is gone.
	it("includes the tombstone in an incremental read", async () => {
		const payload = await createAndDeleteFlow();

		const rows = (await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			filter: { updatedAfter: "1970-01-01T00:00:00.000Z" },
		})) as DATA_EVY_Flow[];

		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe(payload.id);
		expect(rows[0]?.deletedAt).toBeTruthy();
	});

	it("stamps updatedAt on delete so the tombstone lands after the cursor", async () => {
		const payload = flowRow();
		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			data: payload,
		})) as DATA_EVY_Flow;

		const deleted = (await deleteCore(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			filter: { id: payload.id },
		})) as DATA_EVY_Flow;

		expect(deleted.updatedAt >= created.updatedAt).toBe(true);
		expect(deleted.deletedAt).toBeTruthy();
	});

	it("refuses to delete an already-tombstoned record", async () => {
		const payload = await createAndDeleteFlow();

		await expect(
			deleteCore(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: FLOW_RESOURCE,
				filter: { id: payload.id },
			}),
		).rejects.toThrow("Resource not found");
	});

	it("omits deletedAt entirely for a live record", async () => {
		const payload = flowRow();
		const created = (await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FLOW_RESOURCE,
			data: payload,
		})) as DATA_EVY_Flow;

		expect("deletedAt" in created).toBe(false);
	});

	it("tombstones file metadata while removing the binary", async () => {
		const fileId = crypto.randomUUID();
		await testDb.insert(schema.file).values({
			id: fileId,
			type: "image/jpeg",
			visibility: "public",
			...timestamps(),
		});

		await deleteCore(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: EVY_CORE_RESOURCE.FILES,
			filter: { id: fileId },
		});

		const [row] = await testDb.select().from(schema.file);
		expect(row?.deletedAt).toBeTruthy();
		expect(
			await get(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FILES,
			}),
		).toEqual([]);
	});
});

describe("formatter resources", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("creates, lists, updates, and deletes formatters", async () => {
		const currencyAudTemplate = "$" + "{formatDecimal(input.value, 2)}";
		const payload = {
			id: crypto.randomUUID(),
			name: "formatCurrency",
			formatting_config: "{input.currency}",
			formatting: {
				AUD: currencyAudTemplate,
				default: currencyAudTemplate,
			},
			...timestamps(),
		};

		const created = await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FORMATTER_RESOURCE,
			data: payload,
		});
		expect(created).toMatchObject({
			id: payload.id,
			name: "formatCurrency",
		});

		const listed = await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FORMATTER_RESOURCE,
		});
		expect(listed).toHaveLength(1);

		const updated = await update(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FORMATTER_RESOURCE,
			filter: { id: payload.id },
			data: {
				...payload,
				formatting: {
					...payload.formatting,
					EUR: "€{formatDecimal(input.value, 2)}",
				},
			},
		});
		expect(updated.formatting.EUR).toBe("€{formatDecimal(input.value, 2)}");

		await deleteCore(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FORMATTER_RESOURCE,
			filter: { id: payload.id },
		});
		expect(
			await get(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: FORMATTER_RESOURCE,
			}),
		).toEqual([]);
	});

	it("rejects duplicate formatter names", async () => {
		const payload = {
			id: crypto.randomUUID(),
			name: "formatAddress",
			formatting_config: "{input.country}",
			formatting: { default: "{input.street}" },
			...timestamps(),
		};
		await create(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: FORMATTER_RESOURCE,
			data: payload,
		});
		await expect(
			create(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: FORMATTER_RESOURCE,
				data: {
					...payload,
					id: crypto.randomUUID(),
				},
			}),
		).rejects.toThrow("Resource already exists");
	});
});
