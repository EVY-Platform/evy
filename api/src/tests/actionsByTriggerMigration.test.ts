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
import * as schema from "evy-types/db/schema.generated";
import { clearAllTestTables, createPgliteTestDatabase } from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

const MIGRATION_SQL = readFileSync(
	join(import.meta.dir, "../../drizzle/0009_actions_by_trigger.sql"),
	"utf8",
);

function nowIso(): string {
	return new Date().toISOString();
}

async function insertRow(row: {
	id: string;
	name: string;
	type: string;
	visible?: string;
	data: Record<string, unknown>;
}): Promise<void> {
	const iso = nowIso();
	await testDb.insert(schema.row).values({
		id: row.id,
		name: row.name,
		type: row.type,
		visible: row.visible ?? "true",
		data: row.data,
		createdAt: iso,
		updatedAt: iso,
	});
}

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
	await clearAllTestTables(testDb);
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await clearAllTestTables(testDb);
});

describe("0009_actions_by_trigger", () => {
	it("wraps array actions, backfills SelectPhoto delete, drops empty actions, and show-self backfills required tap", async () => {
		const textId = "11111111-1111-4111-8111-111111111111";
		const dropdownId = "22222222-2222-4222-8222-222222222222";
		const selectPhotoId = "33333333-3333-4333-8333-333333333333";
		const buttonId = "44444444-4444-4444-8444-444444444444";

		await insertRow({
			id: textId,
			name: "Optional tap text",
			type: "Text",
			data: {
				title: "Hello",
				actions: [],
			},
		});
		await insertRow({
			id: dropdownId,
			name: "Required tap dropdown",
			type: "Dropdown",
			data: {
				source: "{items}",
				destination: "{item}",
				value: "a",
				actions: [],
			},
		});
		await insertRow({
			id: selectPhotoId,
			name: "Photos",
			type: "SelectPhoto",
			data: {
				source: "{photos}",
				destination: "{photo}",
				actions: [
					{
						condition: "",
						false: "",
						true: "{select_photo()}",
					},
				],
			},
		});
		await insertRow({
			id: buttonId,
			name: "Close",
			type: "Button",
			data: {
				label: "Done",
				actions: {
					tap: [
						{
							condition: "",
							false: "",
							true: "{close()}",
						},
					],
				},
			},
		});

		await pgliteClient.exec(MIGRATION_SQL);

		const text = await testDb.query.row.findFirst({
			where: eq(schema.row.id, textId),
		});
		expect(text?.data).not.toHaveProperty("actions");

		const dropdown = await testDb.query.row.findFirst({
			where: eq(schema.row.id, dropdownId),
		});
		expect(dropdown?.data).toMatchObject({
			actions: {
				tap: [
					{
						condition: "",
						false: "",
						true: `{show(${dropdownId})}`,
					},
				],
			},
		});

		const selectPhoto = await testDb.query.row.findFirst({
			where: eq(schema.row.id, selectPhotoId),
		});
		expect(selectPhoto?.data).toMatchObject({
			actions: {
				tap: [
					{
						condition: "",
						false: "",
						true: "{select_photo()}",
					},
				],
				delete: [
					{
						condition: "",
						false: "",
						true: "{delete_photo()}",
					},
				],
			},
		});

		const button = await testDb.query.row.findFirst({
			where: eq(schema.row.id, buttonId),
		});
		expect(button?.data).toMatchObject({
			actions: {
				tap: [
					{
						condition: "",
						false: "",
						true: "{close()}",
					},
				],
			},
		});
	});
});
