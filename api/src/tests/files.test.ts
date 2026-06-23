import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";

import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import * as schema from "../../../types/generated/ts/db/schema.generated";
import { get } from "../data/data";
import { writeFileBinary } from "../data/resources/files";
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
		createdAt: now,
		updatedAt: now,
	});
}

describe("get files", () => {
	it("returns metadata with base64 binary when filtered by id", async () => {
		const id = "c48853d2-e94f-4220-bec4-e578d03097c1";
		await insertFileMetadata(id);
		await writeFileBinary({ id, bytes: opaqueBytes });

		const result = await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: "files",
			filter: { id },
		});
		expect(result).toEqual([
			{
				id,
				type: fileType,
				createdAt: now,
				updatedAt: now,
				dataBase64: opaqueBytes.toString("base64"),
			},
		]);
	});

	it("returns all files with binaries when no filter is given", async () => {
		const id = "c48853d2-e94f-4220-bec4-e578d03097c1";
		await insertFileMetadata(id);
		await writeFileBinary({ id, bytes: opaqueBytes });

		const result = await get(dataDb, {
			service: EVY_CORE_SERVICE,
			resource: "files",
		});
		expect(Array.isArray(result)).toBe(true);
		const item = (result as Record<string, unknown>[]).find(
			(r) => r.id === id,
		);
		expect(item).toMatchObject({
			id,
			type: fileType,
			dataBase64: opaqueBytes.toString("base64"),
		});
	});

	it("throws when file binary not found", async () => {
		const id = "8356c9ae-24dc-4f92-8794-c389aa3a88fe";
		await insertFileMetadata(id);

		await expect(
			get(dataDb, {
				service: EVY_CORE_SERVICE,
				resource: "files",
				filter: { id },
			}),
		).rejects.toThrow("File binary not found");
	});
});
