import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";

import { schema } from "../db";
import { createPgliteTestDatabase } from "./dbTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

const MIGRATION_SQL = readFileSync(
	join(import.meta.dir, "../../drizzle/0003_message_status.sql"),
	"utf8",
);

const MESSAGES_RESOURCE = MARKETPLACE_RESOURCE.MESSAGES;
const ITEMS_RESOURCE = MARKETPLACE_RESOURCE.ITEMS;

async function insertDataRow(row: {
	id: string;
	resource: string;
	data: Record<string, unknown>;
}): Promise<void> {
	const iso = "2026-06-01T00:00:00.000Z";
	await testDb.insert(schema.data).values({
		id: row.id,
		resource: row.resource,
		data: row.data,
		createdAt: iso,
		updatedAt: iso,
	});
}

async function insertRawData(id: string, jsonbExpr: string): Promise<void> {
	await pgliteClient.exec(`
		INSERT INTO "Data" (id, resource, data, created_at, updated_at)
		VALUES (
			'${id}',
			'${MESSAGES_RESOURCE}',
			${jsonbExpr},
			'2026-06-01T00:00:00.000Z',
			'2026-06-01T00:00:00.000Z'
		);
	`);
}

function messagePayload(
	id: string,
	extra: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		id,
		fk: "44444444-4444-4444-8444-444444444444",
		service: "66b092ae-7cd8-4d67-95b7-30b03568fd90",
		resource: ITEMS_RESOURCE,
		archivedAt: null,
		createdAt: "2026-06-01T00:00:00.000Z",
		data: { type: "pickup", time: "2026-06-03T09:00:00" },
		...extra,
	};
}

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await testDb.delete(schema.data);
});

describe("0003_message_status", () => {
	it("backfills pending on object and string-encoded messages, leaves others untouched", async () => {
		const needsBackfillId = "11111111-1111-4111-8111-111111111111";
		const stringEncodedId = "66666666-6666-4666-8666-666666666666";
		const alreadyAcceptedId = "22222222-2222-4222-8222-222222222222";
		const scalarMessageId = "55555555-5555-4555-8555-555555555555";
		const conditionRowId = "33333333-3333-4333-8333-333333333333";

		await insertDataRow({
			id: needsBackfillId,
			resource: MESSAGES_RESOURCE,
			data: messagePayload(needsBackfillId),
		});
		await insertRawData(
			stringEncodedId,
			`to_jsonb('${JSON.stringify(messagePayload(stringEncodedId))}'::text)`,
		);
		await insertDataRow({
			id: alreadyAcceptedId,
			resource: MESSAGES_RESOURCE,
			data: messagePayload(alreadyAcceptedId, { status: "accepted" }),
		});
		await insertRawData(scalarMessageId, `'"legacy-scalar"'::jsonb`);
		await insertDataRow({
			id: conditionRowId,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			data: {
				id: conditionRowId,
				value: "good",
			},
		});

		await pgliteClient.exec(MIGRATION_SQL);

		const backfilled = await testDb.query.data.findFirst({
			where: eq(schema.data.id, needsBackfillId),
		});
		expect(backfilled?.data).toMatchObject({ status: "pending" });

		const stringEncoded = await pgliteClient.query(
			`SELECT jsonb_typeof(data) AS dtype, (data #>> '{}')::jsonb AS payload
			 FROM "Data" WHERE id = '${stringEncodedId}'`,
		);
		const stringRow = stringEncoded.rows[0] as {
			dtype: string;
			payload: Record<string, unknown>;
		};
		expect(stringRow.dtype).toBe("string");
		expect(stringRow.payload).toMatchObject({ status: "pending" });

		const accepted = await testDb.query.data.findFirst({
			where: eq(schema.data.id, alreadyAcceptedId),
		});
		expect(accepted?.data).toMatchObject({ status: "accepted" });

		const scalar = await testDb.query.data.findFirst({
			where: eq(schema.data.id, scalarMessageId),
		});
		expect(scalar?.data).toBe("legacy-scalar");

		const condition = await testDb.query.data.findFirst({
			where: eq(schema.data.id, conditionRowId),
		});
		expect(condition?.data).not.toHaveProperty("status");
	});
});
