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
import { writeImageBinary } from "../data/images";
import { useImageStorageDirsForTest } from "./imageStorageTestHelpers";
import { clearAllTestTables, createPgliteTestDatabase } from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
setDbForTest(testDb as unknown as Parameters<typeof setDbForTest>[0]);
useImageStorageDirsForTest("images");

const now = "2024-01-19T12:00:00.000Z";
const validJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

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

async function insertImageMetadata(id: string): Promise<void> {
	await testDb.insert(schema.image).values({
		id,
		type: "image/jpeg",
		createdAt: now,
		updatedAt: now,
	});
}

describe("get images", () => {
	it("returns metadata with base64 binary when filtered by id", async () => {
		const id = "550e8400-e29b-41d4-a716-446655440001";
		await insertImageMetadata(id);
		await writeImageBinary({ id, type: "image/jpeg", bytes: validJpegBytes });

		const result = await get({
			service: "evy",
			resource: "images",
			filter: { id },
		});
		expect(result).toEqual([
			{
				id,
				type: "image/jpeg",
				createdAt: now,
				updatedAt: now,
				dataBase64: validJpegBytes.toString("base64"),
			},
		]);
	});

	it("returns all images with binaries when no filter is given", async () => {
		const id = "550e8400-e29b-41d4-a716-446655440001";
		await insertImageMetadata(id);
		await writeImageBinary({ id, type: "image/jpeg", bytes: validJpegBytes });

		const result = await get({ service: "evy", resource: "images" });
		expect(Array.isArray(result)).toBe(true);
		const item = (result as Record<string, unknown>[]).find((r) => r.id === id);
		expect(item).toMatchObject({
			id,
			type: "image/jpeg",
			dataBase64: validJpegBytes.toString("base64"),
		});
	});

	it("throws when image binary not found", async () => {
		const id = "00000000-0000-0000-0000-000000000003";
		await insertImageMetadata(id);

		await expect(
			get({ service: "evy", resource: "images", filter: { id } }),
		).rejects.toThrow("Image binary not found");
	});
});
