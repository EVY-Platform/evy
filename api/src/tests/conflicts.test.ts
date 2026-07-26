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
		data: { id: crypto.randomUUID(), name: "Flow", pageIds: [] },
	});
}

function updateFlow(
	id: string,
	name: string,
	expectedUpdatedAt?: string,
): Promise<unknown> {
	return dataModule.update(db, {
		service: EVY_CORE_SERVICE,
		resource: EVY_CORE_RESOURCE.FLOWS,
		filter: { id, ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) },
		data: { id, name, pageIds: [] },
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
			updateFlow(created.id, "Renamed", created.updatedAt),
		).resolves.toMatchObject({ id: created.id });
	});

	// The case the lock exists for: two editors, and the second write is based
	// on a version the first already replaced.
	it("rejects a write based on a version that has since moved", async () => {
		const created = await createFlow();
		const staleVersion = created.updatedAt;

		// Another session saves first.
		await updateFlow(created.id, "First writer", staleVersion);

		await expect(
			updateFlow(created.id, "Second writer", staleVersion),
		).rejects.toThrow(ConflictError);
	});

	it("leaves the winning write in place after a rejected one", async () => {
		const created = await createFlow();
		await updateFlow(created.id, "First writer", created.updatedAt);

		await updateFlow(created.id, "Second writer", created.updatedAt).catch(
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
			created.updatedAt,
		)) as { updatedAt: string };

		const failure = await updateFlow(
			created.id,
			"Second writer",
			created.updatedAt,
		).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictError);
		const conflict = failure as ConflictError;
		expect(conflict.expectedUpdatedAt).toBe(created.updatedAt);
		expect(conflict.actualUpdatedAt).toBe(updated.updatedAt);
	});

	// iOS and the seed do not track versions; they must keep working.
	it("accepts a write that sends no expected version", async () => {
		const created = await createFlow();
		await updateFlow(created.id, "First writer", created.updatedAt);

		await expect(
			updateFlow(created.id, "No precondition"),
		).resolves.toMatchObject({ id: created.id });
	});

	// updatedAt is the version token, so it has to move on every write even
	// when two land inside the same millisecond.
	it("advances the version on every write", async () => {
		const created = await createFlow();
		let previous = created.updatedAt;

		for (let i = 0; i < 5; i++) {
			const updated = (await updateFlow(
				created.id,
				`Rename ${i}`,
				previous,
			)) as { updatedAt: string };
			expect(updated.updatedAt > previous).toBe(true);
			previous = updated.updatedAt;
		}
	});

	it("rejects a delete based on a stale version", async () => {
		const created = await createFlow();
		await updateFlow(created.id, "Moved on", created.updatedAt);

		await expect(
			dataModule.deleteResource(db, {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
				filter: {
					id: created.id,
					expectedUpdatedAt: created.updatedAt,
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
					expectedUpdatedAt: created.updatedAt,
				},
			}),
		).resolves.toBeDefined();
	});
});
