import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "evy-types/db/schema.generated";
import { get } from "../data/data";
import { writeFileBinary } from "../data/resources/fileStorage";
import { useFileStorageDirsForTest } from "./fileStorageTestHelpers";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);
useFileStorageDirsForTest("files");

const now = "2024-01-19T12:00:00.000Z";
const fileType = "image/jpeg";
const opaqueBytes = Buffer.from([1, 2, 3, 4, 5]);

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
	await clearAllTestTables(testDb);
});

beforeEach(async () => {
	await clearAllTestTables(testDb);
});

afterAll(async () => {
	await pgliteClient.close();
});

async function insertFileMetadata(id: string): Promise<void> {
	await testDb.insert(schema.file).values({
		id,
		type: fileType,
		visibility: "public",
		created_at: now,
		updated_at: now,
	});
}

describe("get files", () => {
	it("returns metadata with base64 binary when filtered by id", async () => {
		const id = "c48853d2-e94f-4220-bec4-e578d03097c1";
		await insertFileMetadata(id);
		await writeFileBinary({ id, bytes: opaqueBytes });

		const result = await get(dataDb, {
			resource: "evy.files",
			filter: { id },
		});
		expect(result).toEqual([
			{
				id,
				type: fileType,
				visibility: "public",
				created_at: now,
				updated_at: now,
				data_base64: opaqueBytes.toString("base64"),
			},
		]);
	});

	it("returns metadata without binaries when no filter is given", async () => {
		const id = "c48853d2-e94f-4220-bec4-e578d03097c1";
		await insertFileMetadata(id);
		await writeFileBinary({ id, bytes: opaqueBytes });

		const result = await get(dataDb, {
			resource: "evy.files",
		});
		expect(Array.isArray(result)).toBe(true);
		const item = (result as Record<string, unknown>[]).find(
			(r) => r.id === id,
		);
		expect(item).toMatchObject({ id, type: fileType });
		expect(item).not.toHaveProperty("data_base64");
	});

	it("returns metadata without binaries for an updated_after read", async () => {
		const id = "b2b1f2a8-6b1a-4c6f-9f1a-2f1c8d0a77aa";
		await insertFileMetadata(id);
		await writeFileBinary({ id, bytes: opaqueBytes });

		const result = (await get(dataDb, {
			resource: "evy.files",
			filter: { updated_after: "1970-01-01T00:00:00.000Z" },
		})) as Record<string, unknown>[];

		const item = result.find((r) => r.id === id);
		expect(item).toBeDefined();
		expect(item).not.toHaveProperty("data_base64");
	});

	// A binary missing from disk used to fail the whole sync, since sync reads
	// files through the same collection path.
	it("does not fail a collection read when a binary is missing", async () => {
		const id = "f0f5f0f5-1111-4222-8333-444455556666";
		await insertFileMetadata(id);

		const result = (await get(dataDb, {
			resource: "evy.files",
		})) as Record<string, unknown>[];

		expect(result.find((r) => r.id === id)).toMatchObject({ id });
	});

	it("throws when file binary not found", async () => {
		const id = "8356c9ae-24dc-4f92-8794-c389aa3a88fe";
		await insertFileMetadata(id);

		await expect(
			get(dataDb, {
				resource: "evy.files",
				filter: { id },
			}),
		).rejects.toThrow("File binary not found");
	});
});
