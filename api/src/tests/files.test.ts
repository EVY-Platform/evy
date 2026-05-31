import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../../../types/generated/ts/db/schema.generated";
import { get } from "../data/core";
import { setDbForTest } from "../data/db";
import { writeFileBinary } from "../data/files";
import { useFileStorageDirsForTest } from "./fileStorageTestHelpers";
import { clearAllTestTables, createPgliteTestDatabase } from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
setDbForTest(testDb as unknown as Parameters<typeof setDbForTest>[0]);
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
		const id = "550e8400-e29b-41d4-a716-446655440001";
		await insertFileMetadata(id);
		await writeFileBinary({ id, bytes: opaqueBytes });

		const result = await get({
			service: "evy",
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
		const id = "550e8400-e29b-41d4-a716-446655440001";
		await insertFileMetadata(id);
		await writeFileBinary({ id, bytes: opaqueBytes });

		const result = await get({ service: "evy", resource: "files" });
		expect(Array.isArray(result)).toBe(true);
		const item = (result as Record<string, unknown>[]).find((r) => r.id === id);
		expect(item).toMatchObject({
			id,
			type: fileType,
			dataBase64: opaqueBytes.toString("base64"),
		});
	});

	it("throws when file binary not found", async () => {
		const id = "00000000-0000-0000-0000-000000000003";
		await insertFileMetadata(id);

		await expect(
			get({ service: "evy", resource: "files", filter: { id } }),
		).rejects.toThrow("File binary not found");
	});
});
