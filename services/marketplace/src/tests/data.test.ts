import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import { schema } from "../db";
import { MARKETPLACE_RESOURCE, MARKETPLACE_SERVICE } from "../resources";
import {
	createPgliteTestDatabase,
	registerMarketplaceTestDb,
} from "./dbTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

registerMarketplaceTestDb(testDb);

const { create, deleteResource, get, update } = await import("../data");

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await testDb.delete(schema.data);
});

describe("marketplace get/create/update", () => {
	it("rejects unsupported resources", async () => {
		await expect(
			get({
				service: MARKETPLACE_SERVICE,
				resource: "unsupported-resource",
			}),
		).rejects.toThrow("Unsupported resource id for marketplace service");
		await expect(
			create({
				service: MARKETPLACE_SERVICE,
				resource: "unsupported-resource",
				data: { id: crypto.randomUUID(), name: "X" },
			}),
		).rejects.toThrow("Unsupported resource id for marketplace service");
	});

	it("persists resource rows for service marketplace", async () => {
		const row = { id: crypto.randomUUID(), value: "Like new" };
		await create({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			data: row,
		});
		const result = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
		});
		expect(result).toHaveLength(1);
		expect(result).toEqual([row]);
	});

	it("returns rows ordered by oldest first", async () => {
		const olderRow = { id: crypto.randomUUID(), value: "older" };
		const newerRow = { id: crypto.randomUUID(), value: "newer" };

		await testDb.insert(schema.data).values([
			{
				id: olderRow.id,
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: olderRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: newerRow.id,
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: newerRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
		});

		expect(result).toEqual([olderRow, newerRow]);
	});

	it("filters rows by updatedAfter", async () => {
		const oldRow = { id: crypto.randomUUID(), value: "old" };
		const newRow = { id: crypto.randomUUID(), value: "new" };

		await testDb.insert(schema.data).values([
			{
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: oldRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: newRow,
				createdAt: "2024-01-03T00:00:00.000Z",
				updatedAt: "2024-01-03T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { updatedAfter: "2024-01-02T00:00:00.000Z" },
		});

		expect(result).toHaveLength(1);
		expect(result).toEqual([newRow]);
	});

	it("filters rows by id", async () => {
		const firstId = crypto.randomUUID();
		const secondId = crypto.randomUUID();
		const firstRow = { id: firstId, title: "First" };
		const secondRow = { id: secondId, title: "Second" };
		await testDb.insert(schema.data).values([
			{
				id: firstId,
				resource: MARKETPLACE_RESOURCE.ITEMS,
				data: firstRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: secondId,
				resource: MARKETPLACE_RESOURCE.ITEMS,
				data: secondRow,
				createdAt: "2024-01-02T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			filter: { id: secondId },
		});

		expect(result).toHaveLength(1);
		expect(result).toEqual([secondRow]);
	});

	it("uses filter.id as primary key when inserting a new row (client id)", async () => {
		const clientId = crypto.randomUUID();
		const payload = { id: clientId, title: "client-keyed" };
		const inserted = await create({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			filter: { id: clientId },
			data: payload,
		});
		expect(inserted.id).toBe(clientId);
		const byFilter = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			filter: { id: clientId },
		});
		expect(byFilter).toEqual([payload]);
	});

	it("create then update row", async () => {
		const rowId = crypto.randomUUID();
		const row = { id: rowId, value: "v1" };
		await create({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
			data: row,
		});
		const updated = await update({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
			data: { ...row, value: "v2" },
		});
		expect(updated).toMatchObject({ data: { ...row, value: "v2" } });
	});

	it("rejects unknown marketplace resource ids", async () => {
		await expect(
			create({
				service: MARKETPLACE_SERVICE,
				resource: "000c2d05-851e-4456-8f22-bb1e54f17c8c",
				filter: { id: crypto.randomUUID() },
				data: { id: crypto.randomUUID(), value: "orphan" },
			}),
		).rejects.toThrow();
	});

	it("deletes a row by resource and id", async () => {
		const rowId = crypto.randomUUID();
		const row = { id: rowId, value: "delete-me" };
		await create({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
			data: row,
		});

		const deleted = await deleteResource({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
		});
		expect(deleted).toMatchObject({ id: rowId, data: row });

		const remaining = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
		});
		expect(remaining).toEqual([]);
	});
});

describe("marketplace item payload validation", () => {
	const fixtureItem = {
		id: "12401f50-cf1a-45d7-a112-2e68a2070466",
		title: "Amazing Fridge",
		photo_ids: ["cfa7e4aa-928d-4920-a370-57ed713b2917"],
		price: { currency: "AUD", value: 250 },
		seller_id: "04b34671-4eeb-4f1c-8435-5e029a0e455c",
		createdAt: "2026-05-20T22:56:17.000Z",
		dimensions: { width: 500, height: 1600, length: 600, weight: 10 },
		payment_methods: { cash: true, app: true },
		transfer_options: {
			pickup: {
				selection: ["2026-06-03T09:00:00"],
				lead_time_hours: "24",
				address_id: "c81e85dd-f7fb-4310-8fc6-7c018aeaf82a",
			},
			delivery: { selection: [], fee: {} },
			ship: { postal_code: "", areas: [] },
		},
	};

	function createItem(data: unknown) {
		return create({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			filter: { id: fixtureItem.id },
			data,
		});
	}

	it("accepts a full item", async () => {
		await expect(createItem(fixtureItem)).resolves.toMatchObject({
			id: fixtureItem.id,
		});
	});

	// The create flow merges flat draft fields into a new item, so an item is
	// shaped differently depending on how it was made.
	it("accepts unknown top-level fields", async () => {
		await expect(
			createItem({ ...fixtureItem, some_future_field: "whatever" }),
		).resolves.toBeDefined();
	});

	// Shapes taken from an item the real create flow produced, not from what
	// the field names suggest: a TextSelect writes the *string* "true".
	it("accepts the flat draft fields the create flow writes", async () => {
		await expect(
			createItem({
				...fixtureItem,
				payment_cash: "true",
				payment_app: "false",
				delivery_fee: "1",
				shipping_fee: "12.50",
				shipping_source_postal_code: "2018",
				distance: ["3e0f4b97-97c3-46da-a242-a5c1e8e63245"],
				shipping_destination_areas: [
					"bd87e698-7623-474b-bf87-48600d103253",
				],
			}),
		).resolves.toBeDefined();
	});

	it("rejects a draft flag written as a boolean", async () => {
		// The row writes text; a real boolean means something else wrote it.
		await expect(
			createItem({ ...fixtureItem, payment_cash: true }),
		).rejects.toThrow();
	});

	it("rejects a fee written as a number", async () => {
		await expect(
			createItem({ ...fixtureItem, delivery_fee: 12.5 }),
		).rejects.toThrow();
	});

	it("rejects a picker list holding rows instead of ids", async () => {
		await expect(
			createItem({
				...fixtureItem,
				shipping_destination_areas: [
					{ id: "bd87e698-7623-474b-bf87-48600d103253" },
				],
			}),
		).rejects.toThrow();
	});

	it("accepts a price value as typed text", async () => {
		await expect(
			createItem({
				...fixtureItem,
				price: { currency: "AUD", value: "13.50" },
			}),
		).resolves.toBeDefined();
	});

	it("accepts an unset fee persisted as an empty object", async () => {
		await expect(
			createItem({
				...fixtureItem,
				transfer_options: {
					...fixtureItem.transfer_options,
					delivery: { selection: [], fee: {} },
				},
			}),
		).resolves.toBeDefined();
	});

	it("rejects a price that is not an object", async () => {
		await expect(
			createItem({ ...fixtureItem, price: 250 }),
		).rejects.toThrow("/price: must be object");
	});

	it("rejects a non-uuid photo id", async () => {
		await expect(
			createItem({ ...fixtureItem, photo_ids: ["not-a-uuid"] }),
		).rejects.toThrow('/photo_ids/0: must match format "uuid"');
	});

	it("rejects a non-boolean payment method", async () => {
		await expect(
			createItem({ ...fixtureItem, payment_methods: { cash: "yes" } }),
		).rejects.toThrow("/payment_methods/cash: must be boolean");
	});

	it("rejects a misspelled key inside a typed sub-object", async () => {
		await expect(
			createItem({ ...fixtureItem, transfer_options: { pickupp: {} } }),
		).rejects.toThrow(
			"/transfer_options: must NOT have additional propert",
		);
	});

	// The item is public and the address it links to is private, so the public
	// page cannot read the address record. It carries the fields that page needs
	// itself - the unit and street stay behind on the private record.
	it("round-trips the public pickup location alongside the address id", async () => {
		const created = (await createItem({
			...fixtureItem,
			transfer_options: {
				...fixtureItem.transfer_options,
				pickup: {
					...fixtureItem.transfer_options.pickup,
					postcode: "2018",
					latitude: -33.9172075,
					longitude: 151.1985883,
				},
			},
		})) as { data: { transfer_options: { pickup: unknown } } };

		expect(created.data.transfer_options.pickup).toMatchObject({
			address_id: "c81e85dd-f7fb-4310-8fc6-7c018aeaf82a",
			postcode: "2018",
			latitude: -33.9172075,
			longitude: 151.1985883,
		});
	});

	it("rejects an unknown key under pickup", async () => {
		await expect(
			createItem({
				...fixtureItem,
				transfer_options: {
					...fixtureItem.transfer_options,
					pickup: {
						...fixtureItem.transfer_options.pickup,
						postcodee: "2018",
					},
				},
			}),
		).rejects.toThrow(
			"/transfer_options/pickup: must NOT have additional propert",
		);
	});

	it("rejects an item with no id", async () => {
		const { id: _omitted, ...withoutId } = fixtureItem;
		await expect(createItem(withoutId)).rejects.toThrow(
			"must have required property 'id'",
		);
	});

	it("validates update payloads too", async () => {
		await createItem(fixtureItem);
		await expect(
			update({
				service: MARKETPLACE_SERVICE,
				resource: MARKETPLACE_RESOURCE.ITEMS,
				filter: { id: fixtureItem.id },
				data: { ...fixtureItem, price: 999 },
			}),
		).rejects.toThrow("/price: must be object");
	});

	// Every marketplace resource has a schema: the core api forwards these
	// payloads without inspecting them, so anything unvalidated here is
	// unvalidated everywhere.
	it("validates the lookup resources too", async () => {
		await expect(
			create({
				service: MARKETPLACE_SERVICE,
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: { id: crypto.randomUUID(), anything: { goes: true } },
			}),
		).rejects.toThrow("MarketplaceLookup validation failed");

		await expect(
			create({
				service: MARKETPLACE_SERVICE,
				resource: MARKETPLACE_RESOURCE.AREAS,
				data: { id: crypto.randomUUID(), value: "City" },
			}),
		).resolves.toBeDefined();
	});
});

describe("marketplace tombstones", () => {
	const resource = MARKETPLACE_RESOURCE.CONDITIONS;

	async function createAndDelete() {
		const rowId = crypto.randomUUID();
		await create({
			service: MARKETPLACE_SERVICE,
			resource,
			filter: { id: rowId },
			data: { id: rowId, value: "gone" },
		});
		await deleteResource({
			service: MARKETPLACE_SERVICE,
			resource,
			filter: { id: rowId },
		});
		return rowId;
	}

	it("hides a deleted row from a plain read", async () => {
		await createAndDelete();

		expect(await get({ service: MARKETPLACE_SERVICE, resource })).toEqual(
			[],
		);
	});

	it("includes the tombstone in an incremental read", async () => {
		const rowId = await createAndDelete();

		const rows = await get({
			service: MARKETPLACE_SERVICE,
			resource,
			filter: { updatedAfter: "1970-01-01T00:00:00.000Z" },
		});

		expect(rows).toHaveLength(1);
		expect((rows[0] as { id?: string })?.id).toBe(rowId);
	});

	it("reports the tombstone on the delete response", async () => {
		const rowId = crypto.randomUUID();
		await create({
			service: MARKETPLACE_SERVICE,
			resource,
			filter: { id: rowId },
			data: { id: rowId, value: "x" },
		});

		const deleted = await deleteResource({
			service: MARKETPLACE_SERVICE,
			resource,
			filter: { id: rowId },
		});

		expect((deleted as { deletedAt?: string }).deletedAt).toBeTruthy();
	});

	it("refuses to delete an already-tombstoned row", async () => {
		const rowId = await createAndDelete();

		await expect(
			deleteResource({
				service: MARKETPLACE_SERVICE,
				resource,
				filter: { id: rowId },
			}),
		).rejects.toThrow("Resource not found");
	});

	it("omits deletedAt for a live row", async () => {
		const rowId = crypto.randomUUID();
		const created = await create({
			service: MARKETPLACE_SERVICE,
			resource,
			filter: { id: rowId },
			data: { id: rowId, value: "live" },
		});

		expect("deletedAt" in (created as object)).toBe(false);
	});
});
