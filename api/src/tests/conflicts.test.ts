import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { ConflictError } from "../data/conflicts";
import * as dataModule from "../data/data";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const db = asEvyDb(testDb);

async function createFlow() {
	return dataModule.create(db, {
		service: EVY_CORE_SERVICE,
		resource: EVY_CORE_RESOURCE.FLOWS,
		data: {
			id: crypto.randomUUID(),
			name: "Flow",
			page_ids: [],
			visibility: "public",
		},
	});
}

function updateFlow(
	id: string,
	name: string,
	expected_updated_at?: string,
): Promise<unknown> {
	return dataModule.update(db, {
		service: EVY_CORE_SERVICE,
		resource: EVY_CORE_RESOURCE.FLOWS,
		filter: { id, ...(expected_updated_at ? { expected_updated_at } : {}) },
		data: { id, name, page_ids: [], visibility: "public" },
	});
}

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await clearAllTestTables(testDb);
});

describe("optimistic locking", () => {
	it("applies a write whose expected version is current", async () => {
		const created = await createFlow();

		await expect(
			updateFlow(created.id, "Renamed", created.updated_at),
		).resolves.toMatchObject({ id: created.id });
	});

	// The case the lock exists for: two editors, and the second write is based
	// on a version the first already replaced.
	it("rejects a write based on a version that has since moved", async () => {
		const created = await createFlow();
		const staleVersion = created.updated_at;

		// Another session saves first.
		await updateFlow(created.id, "First writer", staleVersion);

		await expect(
			updateFlow(created.id, "Second writer", staleVersion),
		).rejects.toThrow(ConflictError);
	});

	it("leaves the winning write in place after a rejected one", async () => {
		const created = await createFlow();
		await updateFlow(created.id, "First writer", created.updated_at);

		await updateFlow(created.id, "Second writer", created.updated_at).catch(
			() => undefined,
		);

		const rows = await dataModule.get(db, {
			service: EVY_CORE_SERVICE,
			resource: EVY_CORE_RESOURCE.FLOWS,
			filter: { id: created.id },
		});
		expect(rows[0]).toMatchObject({ name: "First writer" });
	});

	it("reports both versions so a client can explain the conflict", async () => {
		const created = await createFlow();
		const updated = (await updateFlow(
			created.id,
			"First writer",
			created.updated_at,
		)) as { updated_at: string };

		const failure = await updateFlow(
			created.id,
			"Second writer",
			created.updated_at,
		).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictError);
		const conflict = failure as ConflictError;
		expect(conflict.expected_updated_at).toBe(created.updated_at);
		expect(conflict.actualUpdatedAt).toBe(updated.updated_at);
	});

	// iOS and the seed do not track versions; they must keep working.
	it("accepts a write that sends no expected version", async () => {
		const created = await createFlow();
		await updateFlow(created.id, "First writer", created.updated_at);

		await expect(
			updateFlow(created.id, "No precondition"),
		).resolves.toMatchObject({ id: created.id });
	});

	// updated_at is the version token, so it has to move on every write even
	// when two land inside the same millisecond.
	it("advances the version on every write", async () => {
		const created = await createFlow();
		let previous = created.updated_at;

		for (let i = 0; i < 5; i++) {
			const updated = (await updateFlow(
				created.id,
				`Rename ${i}`,
				previous,
			)) as { updated_at: string };
			expect(updated.updated_at > previous).toBe(true);
			previous = updated.updated_at;
		}
	});

	it("rejects a delete based on a stale version", async () => {
		const created = await createFlow();
		await updateFlow(created.id, "Moved on", created.updated_at);

		await expect(
			dataModule.deleteResource(db, {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
				filter: {
					id: created.id,
					expected_updated_at: created.updated_at,
				},
			}),
		).rejects.toThrow(ConflictError);
	});

	it("allows a delete whose expected version is current", async () => {
		const created = await createFlow();

		await expect(
			dataModule.deleteResource(db, {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
				filter: {
					id: created.id,
					expected_updated_at: created.updated_at,
				},
			}),
		).resolves.toBeDefined();
	});
});
