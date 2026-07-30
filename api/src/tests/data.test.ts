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
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";
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
	getSyncRows,
	update,
	deleteResource: deleteCore,
	validateAuth,
} = coreModule;
const uploadModule = await import("../procedures/uploads");
const { clearUploadsForTest, handleUploadChunk } = uploadModule;

const FLOW_RESOURCE = EVY_CORE_RESOURCE_REF.FLOWS;
const PAGE_RESOURCE = EVY_CORE_RESOURCE_REF.PAGES;
const ROW_RESOURCE = EVY_CORE_RESOURCE_REF.ROWS;
const ADDRESS_RESOURCE = EVY_CORE_RESOURCE_REF.ADDRESSES;
const MESSAGE_RESOURCE = EVY_CORE_RESOURCE_REF.MESSAGES;
const FORMATTER_RESOURCE = EVY_CORE_RESOURCE_REF.FORMATTERS;

function nowIso(): string {
	return new Date().toISOString();
}

function timestamps(): { created_at: string; updated_at: string } {
	const iso = nowIso();
	return { created_at: iso, updated_at: iso };
}

function flowRow(overrides: Partial<DATA_EVY_Flow> = {}): DATA_EVY_Flow {
	return {
		id: crypto.randomUUID(),
		name: "Flow",
		page_ids: [],
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
		row_ids: [],
		visibility: "public",
		...timestamps(),
		...overrides,
	};
}

function rowRow(overrides: Partial<DATA_EVY_Row> = {}): DATA_EVY_Row {
	return {
		id: crypto.randomUUID(),
		name: "text",
		type: "text",
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
		visibility: "private",
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
		const pagePayload = pageRow({ row_ids: [rowPayload.id] });
		const flowPayload = flowRow({ page_ids: [pagePayload.id] });

		const createdRow = (await create(dataDb, {
			resource: ROW_RESOURCE,
			data: rowPayload,
		})) as DATA_EVY_Row;
		const createdPage = (await create(dataDb, {
			resource: PAGE_RESOURCE,
			data: pagePayload,
		})) as DATA_EVY_Page;
		const createdFlow = (await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: flowPayload,
		})) as DATA_EVY_Flow;

		expect(createdRow.id).toBe(rowPayload.id);
		expect(createdRow.data.text).toBe("Hello");
		expect(createdPage.row_ids).toEqual([rowPayload.id]);
		expect(createdFlow.page_ids).toEqual([pagePayload.id]);
		expect(await testDb.select().from(schema.row)).toHaveLength(1);
		expect(await testDb.select().from(schema.page)).toHaveLength(1);
		expect(await testDb.select().from(schema.flow)).toHaveLength(1);
	});

	it("round-trips a flow submits declaration through create, get and update", async () => {
		const submits = { resource: "marketplace.items" };
		const flowPayload = { ...flowRow({ page_ids: [] }), submits };

		const created = (await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: flowPayload,
		})) as DATA_EVY_Flow;
		expect(created.submits).toEqual(submits);

		const [fetched] = (await get(dataDb, {
			resource: FLOW_RESOURCE,
			filter: { id: flowPayload.id },
		})) as DATA_EVY_Flow[];
		expect(fetched?.submits).toEqual(submits);

		const updated = (await update(dataDb, {
			resource: FLOW_RESOURCE,
			filter: { id: flowPayload.id },
			data: { ...flowPayload, submits: undefined },
		})) as DATA_EVY_Flow;
		expect(updated.submits).toBeUndefined();
	});

	it("omits submits entirely when a flow does not declare one", async () => {
		const flowPayload = flowRow({ page_ids: [] });

		const created = (await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: flowPayload,
		})) as DATA_EVY_Flow;

		expect(created.submits).toBeUndefined();
		expect("submits" in created).toBe(false);
	});

	it("uses filter.id as the persisted id on create", async () => {
		const flowId = crypto.randomUUID();
		const result = (await create(dataDb, {
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
			resource: FLOW_RESOURCE,
			data: payload,
		});

		await expect(
			create(dataDb, {
				resource: FLOW_RESOURCE,
				data: payload,
			}),
		).rejects.toThrow("Resource already exists");
	});

	it("updates an existing row record", async () => {
		const payload = rowRow();
		await create(dataDb, {
			resource: ROW_RESOURCE,
			data: payload,
		});

		const result = (await update(dataDb, {
			resource: ROW_RESOURCE,
			filter: { id: payload.id },
			data: { ...payload, name: "Renamed", data: { title: "Updated" } },
		})) as DATA_EVY_Row;

		expect(result.name).toBe("Renamed");
		expect(result.data.title).toBe("Updated");
		expect(result.created_at).toBe(payload.created_at);
		expect(Date.parse(result.updated_at)).not.toBeNaN();
	});

	it("rejects update when a flat record does not exist", async () => {
		await expect(
			update(dataDb, {
				resource: PAGE_RESOURCE,
				filter: { id: crypto.randomUUID() },
				data: pageRow(),
			}),
		).rejects.toThrow("Resource not found");
	});

	it("gets flat records by id and updated_after ordered oldest first", async () => {
		const older = flowRow({
			name: "Older",
			created_at: "2024-01-01T00:00:00.000Z",
			updated_at: "2024-01-01T00:00:00.000Z",
		});
		const newer = flowRow({
			name: "Newer",
			created_at: "2024-01-01T00:00:00.000Z",
			updated_at: "2024-01-02T00:00:00.000Z",
		});
		await testDb.insert(schema.flow).values([older, newer]);

		const all = (await get(dataDb, {
			resource: FLOW_RESOURCE,
		})) as DATA_EVY_Flow[];
		expect(all.map((flow) => flow.id)).toEqual([older.id, newer.id]);

		const filteredById = (await get(dataDb, {
			resource: FLOW_RESOURCE,
			filter: { id: newer.id },
		})) as DATA_EVY_Flow[];
		expect(filteredById).toHaveLength(1);
		expect(filteredById[0].name).toBe("Newer");

		const filteredByTime = (await get(dataDb, {
			resource: FLOW_RESOURCE,
			filter: { updated_after: "2024-01-01T12:00:00.000Z" },
		})) as DATA_EVY_Flow[];
		expect(filteredByTime.map((flow) => flow.id)).toEqual([newer.id]);
	});

	it("deletes flat records", async () => {
		const payload = pageRow();
		await create(dataDb, {
			resource: PAGE_RESOURCE,
			data: payload,
		});

		const deleted = (await deleteCore(dataDb, {
			resource: PAGE_RESOURCE,
			filter: { id: payload.id },
		})) as DATA_EVY_Page;

		expect(deleted.id).toBe(payload.id);
		const [tombstone] = await testDb.select().from(schema.page);
		expect(tombstone?.deleted_at).toBeTruthy();
		expect(
			await get(dataDb, {
				resource: PAGE_RESOURCE,
			}),
		).toEqual([]);
	});

	it("rejects invalid flat flow payloads", async () => {
		await expect(
			create(dataDb, {
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
			resource: ADDRESS_RESOURCE,
		})) as DATA_EVY_Address[];
		expect(empty).toEqual([]);

		const payload = addressRow();
		const created = (await create(dataDb, {
			resource: ADDRESS_RESOURCE,
			data: payload,
		})) as DATA_EVY_Address;
		expect(created.id).toBe(payload.id);
		expect(created.street).toBe("28 Rothschild Avenue");
		expect(created.latitude).toBe(-33.9172075);
		expect(created.visibility).toBe("private");

		const listed = (await get(dataDb, {
			resource: ADDRESS_RESOURCE,
		})) as DATA_EVY_Address[];
		expect(listed).toHaveLength(1);
		expect(listed[0].id).toBe(payload.id);

		const updated = (await update(dataDb, {
			resource: ADDRESS_RESOURCE,
			filter: { id: payload.id },
			data: { ...payload, unit: "C510", instructions: "Buzz 509" },
		})) as DATA_EVY_Address;
		expect(updated.unit).toBe("C510");
		expect(updated.instructions).toBe("Buzz 509");
		expect(updated.visibility).toBe("private");
		expect(updated.created_at).toBe(payload.created_at);

		const deleted = (await deleteCore(dataDb, {
			resource: ADDRESS_RESOURCE,
			filter: { id: payload.id },
		})) as DATA_EVY_Address;
		expect(deleted.id).toBe(payload.id);
		const [tombstone] = await testDb.select().from(schema.address);
		expect(tombstone?.deleted_at).toBeTruthy();
		expect(
			await get(dataDb, {
				resource: ADDRESS_RESOURCE,
			}),
		).toEqual([]);
	});

	it("rejects invalid address payloads", async () => {
		await expect(
			create(dataDb, {
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
			resource: ADDRESS_RESOURCE,
			data: {
				id: crypto.randomUUID(),
				street: "Manual Street",
				visibility: "private",
			},
		})) as DATA_EVY_Address;
		expect(created.street).toBe("Manual Street");
		expect(created.visibility).toBe("private");
		expect(created.city).toBeUndefined();
		expect(created.latitude).toBeUndefined();
	});
});

describe("visibility", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("rejects a create with no visibility rather than choosing one", async () => {
		await expect(
			create(dataDb, {
				resource: FLOW_RESOURCE,
				data: {
					id: crypto.randomUUID(),
					name: "Flow With No Visibility",
					page_ids: [],
				},
			}),
		).rejects.toThrow("visibility");
	});

	it("round-trips explicit public visibility on flows", async () => {
		const created = (await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: {
				id: crypto.randomUUID(),
				name: "Public Flow",
				page_ids: [],
				visibility: "public",
			},
		})) as DATA_EVY_Flow;
		expect(created.visibility).toBe("public");
	});

	it("round-trips explicit private visibility on flows", async () => {
		const flowId = crypto.randomUUID();
		const created = (await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: {
				id: flowId,
				name: "Private Flow",
				page_ids: [],
				visibility: "private",
			},
		})) as DATA_EVY_Flow;
		expect(created.visibility).toBe("private");

		const listed = (await get(dataDb, {
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
			resource: MESSAGE_RESOURCE,
		})) as DATA_EVY_Message[];
		expect(empty).toEqual([]);

		const payload = {
			fk: crypto.randomUUID(),
			resource: "test_svc.items",
			data: {
				type: "pickup",
				value: "pending",
				time: "2026-06-03T09:00:00",
			},
			visibility: "private" as const,
		};
		const created = (await create(dataDb, {
			resource: MESSAGE_RESOURCE,
			data: payload,
		})) as DATA_EVY_Message;
		expect(created.id).toBeDefined();
		expect(created.updated_at).toBeDefined();
		expect(created.data.value).toBe("pending");
		expect(created.visibility).toBe("private");

		const listed = (await get(dataDb, {
			resource: MESSAGE_RESOURCE,
		})) as DATA_EVY_Message[];
		expect(listed).toHaveLength(1);

		const deleted = (await deleteCore(dataDb, {
			resource: MESSAGE_RESOURCE,
			filter: { id: created.id },
		})) as DATA_EVY_Message;
		expect(deleted.id).toBe(created.id);
		const [tombstone] = await testDb.select().from(schema.message);
		expect(tombstone?.deleted_at).toBeTruthy();
		expect(
			await get(dataDb, {
				resource: MESSAGE_RESOURCE,
			}),
		).toEqual([]);
	});

	it("rejects invalid message payloads", async () => {
		await expect(
			create(dataDb, {
				resource: MESSAGE_RESOURCE,
				data: {
					id: crypto.randomUUID(),
					fk: "not-a-uuid",
					resource: "test_svc.items",
					data: {},
					visibility: "private",
				},
			}),
		).rejects.toThrow("Message validation failed");
	});

	it.each([
		"status",
		"archivedAt",
	])("rejects a message still carrying the removed %s field", async (removed) => {
		await expect(
			create(dataDb, {
				resource: MESSAGE_RESOURCE,
				data: {
					id: crypto.randomUUID(),
					fk: crypto.randomUUID(),
					resource: "test_svc.items",
					[removed]: removed === "status" ? "pending" : null,
					data: { type: "pickup", value: "pending" },
					visibility: "private",
				},
			}),
		).rejects.toThrow("Message validation failed");
	});
});

describe("getSyncRows", () => {
	const targetResourceRef = "test_svc.items";
	const ownedFk = crypto.randomUUID();
	const otherFk = crypto.randomUUID();

	async function createMessage(fk: string): Promise<DATA_EVY_Message> {
		return (await create(dataDb, {
			resource: MESSAGE_RESOURCE,
			data: {
				fk,
				resource: targetResourceRef,
				data: { type: "pickup", value: "pending" },
				visibility: "private" as const,
			},
		})) as DATA_EVY_Message;
	}

	async function createResponse(
		requestId: string,
	): Promise<DATA_EVY_Message> {
		return (await create(dataDb, {
			resource: MESSAGE_RESOURCE,
			data: {
				fk: otherFk,
				resource: targetResourceRef,
				parent_message_id: requestId,
				data: { value: "accept", type: "pickup" },
				visibility: "private" as const,
			},
		})) as DATA_EVY_Message;
	}

	function owns(...fks: string[]) {
		return [{ resource: targetResourceRef, ids: fks }];
	}

	function ownsCoreMessage(...ids: string[]) {
		return [
			{
				resource: MESSAGE_RESOURCE,
				ids,
			},
		];
	}

	async function ownedIds(
		params: Parameters<typeof getSyncRows>[2],
	): Promise<string[]> {
		const owned = (await getSyncRows(
			dataDb,
			MESSAGE_RESOURCE,
			params,
		)) as DATA_EVY_Message[];
		return owned.map((message) => message.id);
	}

	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("returns nothing when the device owns nothing", async () => {
		await createMessage(ownedFk);

		expect(await ownedIds({ owned: [] })).toEqual([]);
	});

	it("returns only messages the device created", async () => {
		const mine = await createMessage(otherFk);
		await createMessage(otherFk);

		expect(
			await ownedIds({
				owned: ownsCoreMessage(mine.id),
			}),
		).toEqual([mine.id]);
	});

	it("returns only messages addressed to a record the device owns", async () => {
		const addressed = await createMessage(ownedFk);
		await createMessage(otherFk);

		expect(
			await ownedIds({
				owned: owns(ownedFk),
			}),
		).toEqual([addressed.id]);
	});

	it("returns the union of created and addressed messages", async () => {
		const addressed = await createMessage(ownedFk);
		const mine = await createMessage(otherFk);
		await createMessage(otherFk);

		const owned = await ownedIds({
			owned: [...ownsCoreMessage(mine.id), ...owns(ownedFk)],
		});

		expect(owned.toSorted()).toEqual([addressed.id, mine.id].toSorted());
	});

	it("matches the fk only within its own resource ref", async () => {
		await createMessage(ownedFk);

		expect(
			await ownedIds({
				owned: [
					{
						resource: "other_svc.items",
						ids: [ownedFk],
					},
				],
			}),
		).toEqual([]);
	});

	it("excludes owned messages unchanged since updated_after", async () => {
		const mine = await createMessage(otherFk);

		expect(
			await ownedIds({
				updated_after: mine.updated_at,
				owned: ownsCoreMessage(mine.id),
			}),
		).toEqual([]);
	});

	it("carries tombstones to the owner on an incremental read", async () => {
		const mine = await createMessage(otherFk);
		const before = mine.updated_at;
		await deleteCore(dataDb, {
			resource: MESSAGE_RESOURCE,
			filter: { id: mine.id },
		});

		const incremental = (await getSyncRows(dataDb, MESSAGE_RESOURCE, {
			updated_after: before,
			owned: ownsCoreMessage(mine.id),
		})) as DATA_EVY_Message[];
		expect(incremental).toHaveLength(1);
		expect(incremental[0].deleted_at).toBeTruthy();

		expect(
			await ownedIds({
				owned: ownsCoreMessage(mine.id),
			}),
		).toEqual([]);
	});

	it("ignores owned groups that cannot address a message", async () => {
		const addressed = await createMessage(ownedFk);

		expect(
			await ownedIds({
				owned: [
					{
						resource: EVY_CORE_RESOURCE_REF.ADDRESSES,
						ids: [crypto.randomUUID()],
					},
					...owns(ownedFk),
				],
			}),
		).toEqual([addressed.id]);
	});

	it("ignores owned groups with no ids", async () => {
		await createMessage(ownedFk);

		expect(await ownedIds({ owned: owns() })).toEqual([]);
	});

	it("returns responses to a message the device owns", async () => {
		const request = await createMessage(otherFk);
		const response = await createResponse(request.id);

		const owned = await ownedIds({
			owned: ownsCoreMessage(request.id),
		});

		expect(owned.toSorted()).toEqual([request.id, response.id].toSorted());
	});

	it("does not return responses to a message the device does not own", async () => {
		const request = await createMessage(otherFk);
		const mine = await createMessage(otherFk);
		await createResponse(request.id);

		expect(
			await ownedIds({
				owned: ownsCoreMessage(mine.id),
			}),
		).toEqual([mine.id]);
	});

	it("leaves messages with no parent_message_id unaffected", async () => {
		const mine = await createMessage(otherFk);
		await createMessage(otherFk);

		expect(
			await ownedIds({
				owned: ownsCoreMessage(mine.id),
			}),
		).toEqual([mine.id]);
	});
});

describe("getSyncRows entitlement", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	async function syncedIds(
		resource: string,
		params: Parameters<typeof getSyncRows>[2],
	): Promise<string[]> {
		const rows = (await getSyncRows(dataDb, resource, params)) as {
			id: string;
		}[];
		return rows.map((row) => row.id);
	}

	const ownsNothing = { owned: [] };

	function ownsCoreResource(resource: string, ...ids: string[]) {
		return [
			{
				resource,
				ids,
			},
		];
	}

	it("sends a public row to a device that owns nothing", async () => {
		const flow = flowRow({ visibility: "public" });
		await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: flow,
		});

		expect(await syncedIds(FLOW_RESOURCE, ownsNothing)).toEqual([flow.id]);
	});

	it("withholds a private row from a device that owns nothing", async () => {
		await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: flowRow({ visibility: "private" }),
		});

		expect(await syncedIds(FLOW_RESOURCE, ownsNothing)).toEqual([]);
	});

	it("sends a private row to the device that owns it", async () => {
		const mine = flowRow({ visibility: "private" });
		const theirs = flowRow({ visibility: "private" });
		for (const data of [mine, theirs]) {
			await create(dataDb, {
				resource: FLOW_RESOURCE,
				data,
			});
		}

		expect(
			await syncedIds(FLOW_RESOURCE, {
				owned: ownsCoreResource(FLOW_RESOURCE, mine.id),
			}),
		).toEqual([mine.id]);
	});

	it("sends rows of a resource that has no visibility at all", async () => {
		const formatterId = crypto.randomUUID();
		await create(dataDb, {
			resource: FORMATTER_RESOURCE,
			data: {
				id: formatterId,
				name: `fmt-${formatterId.slice(0, 8)}`,
				formatting_config: "{input.country}",
				formatting: { default: "{input.postcode}" },
				...timestamps(),
			},
		});

		expect(await syncedIds(FORMATTER_RESOURCE, ownsNothing)).toEqual([
			formatterId,
		]);
	});

	it("carries a tombstone for a private row its owner still owns", async () => {
		const mine = flowRow({ visibility: "private" });
		const created = (await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: mine,
		})) as DATA_EVY_Flow;
		await deleteCore(dataDb, {
			resource: FLOW_RESOURCE,
			filter: { id: mine.id },
		});

		const rows = (await getSyncRows(dataDb, FLOW_RESOURCE, {
			updated_after: created.updated_at,
			owned: ownsCoreResource(FLOW_RESOURCE, mine.id),
		})) as DATA_EVY_Flow[];

		expect(rows).toHaveLength(1);
		expect(rows[0].deleted_at).toBeTruthy();
	});
});

describe("service resources", () => {
	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	it("creates and updates Service rows", async () => {
		const serviceId = "create_svc";
		const payload = {
			id: serviceId,
			name: "CreateSvc",
			description: "D",
			visibility: "public" as const,
			...timestamps(),
		};

		const created = (await create(dataDb, {
			resource: EVY_CORE_RESOURCE_REF.SERVICES,
			data: payload,
		})) as DATA_EVY_Service;
		expect(created.id).toBe(serviceId);

		const updated = (await update(dataDb, {
			resource: EVY_CORE_RESOURCE_REF.SERVICES,
			filter: { id: serviceId },
			data: { ...payload, name: "UpdatedSvc" },
		})) as DATA_EVY_Service;
		expect(updated.name).toBe("UpdatedSvc");
	});

	it("rejects reserved service slugs", async () => {
		await expect(
			create(dataDb, {
				resource: EVY_CORE_RESOURCE_REF.SERVICES,
				data: {
					id: "local",
					name: "Bad",
					description: "D",
					visibility: "public",
					...timestamps(),
				},
			}),
		).rejects.toThrow("Invalid service slug");
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
			upload_id: fileId,
			index: 0,
			byte_offset: 0,
			byte_length: bytes.length,
		});
		const metadataBytes = Buffer.from(metadata);
		const header = Buffer.alloc(4);
		header.writeUInt32BE(metadataBytes.length, 0);
		await handleUploadChunk(Buffer.concat([header, metadataBytes, bytes]));

		const result = await create(dataDb, {
			resource: EVY_CORE_RESOURCE_REF.FILES,
			filter: { id: fileId },
			data: {
				id: fileId,
				type: "text/plain",
				visibility: "public",
				...timestamps(),
			},
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
				resource: "evy.not_a_resource",
			} as unknown as GetRequest),
		).rejects.toThrow("Resource is not served by the core API");
	});

	it("rejects non-evy resource refs", async () => {
		await expect(
			get(dataDb, {
				resource: "marketplace.items",
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
			resource: FLOW_RESOURCE,
			data: payload,
		});
		await deleteCore(dataDb, {
			resource: FLOW_RESOURCE,
			filter: { id: payload.id },
		});
		return payload;
	}

	it("hides a deleted record from a plain read", async () => {
		await createAndDeleteFlow();

		expect(
			await get(dataDb, {
				resource: FLOW_RESOURCE,
			}),
		).toEqual([]);
	});

	it("hides a deleted record from a read by id", async () => {
		const payload = await createAndDeleteFlow();

		expect(
			await get(dataDb, {
				resource: FLOW_RESOURCE,
				filter: { id: payload.id },
			}),
		).toEqual([]);
	});

	it("includes the tombstone in an incremental read", async () => {
		const payload = await createAndDeleteFlow();

		const rows = (await get(dataDb, {
			resource: FLOW_RESOURCE,
			filter: { updated_after: "1970-01-01T00:00:00.000Z" },
		})) as DATA_EVY_Flow[];

		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe(payload.id);
		expect(rows[0]?.deleted_at).toBeTruthy();
	});

	it("stamps updated_at on delete so the tombstone lands after the cursor", async () => {
		const payload = flowRow();
		const created = (await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: payload,
		})) as DATA_EVY_Flow;

		const deleted = (await deleteCore(dataDb, {
			resource: FLOW_RESOURCE,
			filter: { id: payload.id },
		})) as DATA_EVY_Flow;

		expect(deleted.updated_at >= created.updated_at).toBe(true);
		expect(deleted.deleted_at).toBeTruthy();
	});

	it("refuses to delete an already-tombstoned record", async () => {
		const payload = await createAndDeleteFlow();

		await expect(
			deleteCore(dataDb, {
				resource: FLOW_RESOURCE,
				filter: { id: payload.id },
			}),
		).rejects.toThrow("Resource not found");
	});

	it("omits deleted_at entirely for a live record", async () => {
		const payload = flowRow();
		const created = (await create(dataDb, {
			resource: FLOW_RESOURCE,
			data: payload,
		})) as DATA_EVY_Flow;

		expect("deleted_at" in created).toBe(false);
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
			resource: EVY_CORE_RESOURCE_REF.FILES,
			filter: { id: fileId },
		});

		const [row] = await testDb.select().from(schema.file);
		expect(row?.deleted_at).toBeTruthy();
		expect(
			await get(dataDb, {
				resource: EVY_CORE_RESOURCE_REF.FILES,
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
			resource: FORMATTER_RESOURCE,
			data: payload,
		});
		expect(created).toMatchObject({
			id: payload.id,
			name: "formatCurrency",
		});

		const listed = await get(dataDb, {
			resource: FORMATTER_RESOURCE,
		});
		expect(listed).toHaveLength(1);

		const updated = await update(dataDb, {
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
			resource: FORMATTER_RESOURCE,
			filter: { id: payload.id },
		});
		expect(
			await get(dataDb, {
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
			resource: FORMATTER_RESOURCE,
			data: payload,
		});
		await expect(
			create(dataDb, {
				resource: FORMATTER_RESOURCE,
				data: {
					...payload,
					id: crypto.randomUUID(),
				},
			}),
		).rejects.toThrow("Resource already exists");
	});
});
