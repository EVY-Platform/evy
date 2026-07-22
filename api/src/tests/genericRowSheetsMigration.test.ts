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
import {
	clearAllTestTables,
	createPgliteTestDatabase,
	insertRow,
	nowIso,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

const MIGRATION_SQL = readFileSync(
	join(import.meta.dir, "../../drizzle/0008_generic_row_sheets.sql"),
	"utf8",
);

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

describe("0008_generic_row_sheets", () => {
	it("migrates sheet owners, rewrites show(), removes container templates, and keeps shared templates", async () => {
		const buttonSheetId = "11111111-1111-4111-8111-111111111111";
		const buttonId = "22222222-2222-4222-8222-222222222222";
		const searchChildId = "33333333-3333-4333-8333-333333333333";
		const searchId = "44444444-4444-4444-8444-444444444444";
		const sharedTemplateId = "55555555-5555-4555-8555-555555555555";
		const containerId = "66666666-6666-4666-8666-666666666666";
		const orphanTemplateId = "77777777-7777-4777-8777-777777777777";
		const orphanContainerId = "88888888-8888-4888-8888-888888888888";
		const pageId = "99999999-9999-4999-8999-999999999999";

		await insertRow(testDb, {
			id: buttonSheetId,
			name: "Confirm sheet",
			type: "VerticalContainer",
			data: { title: "Confirm", children_row_ids: [] },
		});
		await insertRow(testDb, {
			id: buttonId,
			name: "Submit",
			type: "Button",
			data: {
				label: "Submit",
				child_row_id: buttonSheetId,
				actions: [
					{ condition: "", true: "{show()}", false: "" },
					{ condition: "x", true: "{close()}", false: "{show()}" },
				],
			},
		});
		await insertRow(testDb, {
			id: searchChildId,
			name: "Search result",
			type: "Text",
			data: { title: "{$datum.title}", text: "" },
		});
		await insertRow(testDb, {
			id: searchId,
			name: "Place search",
			type: "Search",
			data: {
				source: "{$api:place_search}",
				destination: "{item.address}",
				child_row_id: searchChildId,
			},
		});
		await insertRow(testDb, {
			id: sharedTemplateId,
			name: "Shared template",
			type: "Text",
			data: { title: "Shared", text: "keep me" },
		});
		await insertRow(testDb, {
			id: containerId,
			name: "Photos",
			type: "VerticalContainer",
			data: {
				source: "{item.photo_ids}",
				child_row_id: sharedTemplateId,
				children_row_ids: [searchId, sharedTemplateId],
			},
		});
		await insertRow(testDb, {
			id: orphanTemplateId,
			name: "Orphan template",
			type: "Text",
			data: { title: "Orphan", text: "delete me" },
		});
		await insertRow(testDb, {
			id: orphanContainerId,
			name: "Orphan container",
			type: "HorizontalContainer",
			data: {
				source: "{item.items}",
				child_row_id: orphanTemplateId,
				children_row_ids: [],
			},
		});

		const iso = nowIso();
		await testDb.insert(schema.page).values({
			id: pageId,
			name: "Page",
			title: "Page",
			rowIds: [buttonId, containerId, orphanContainerId],
			createdAt: iso,
			updatedAt: iso,
		});

		await pgliteClient.exec(MIGRATION_SQL);

		const button = await testDb.query.row.findFirst({
			where: eq(schema.row.id, buttonId),
		});
		expect(button?.data).toMatchObject({
			label: "Submit",
			sheet_row_id: buttonSheetId,
			actions: [
				{
					condition: "",
					true: `{show(${buttonSheetId})}`,
					false: "",
				},
				{
					condition: "x",
					true: "{close()}",
					false: `{show(${buttonSheetId})}`,
				},
			],
		});
		expect(button?.data).not.toHaveProperty("child_row_id");

		const search = await testDb.query.row.findFirst({
			where: eq(schema.row.id, searchId),
		});
		expect(search?.data).toMatchObject({
			child_row_id: searchChildId,
		});
		expect(search?.data).not.toHaveProperty("sheet_row_id");

		const container = await testDb.query.row.findFirst({
			where: eq(schema.row.id, containerId),
		});
		expect(container?.data).toMatchObject({
			children_row_ids: [searchId, sharedTemplateId],
		});
		expect(container?.data).not.toHaveProperty("source");
		expect(container?.data).not.toHaveProperty("child_row_id");

		const shared = await testDb.query.row.findFirst({
			where: eq(schema.row.id, sharedTemplateId),
		});
		expect(shared).toBeDefined();

		const orphan = await testDb.query.row.findFirst({
			where: eq(schema.row.id, orphanTemplateId),
		});
		expect(orphan).toBeUndefined();
	});

	it("fails when unsupported {show()} branches remain", async () => {
		const strayId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
		await insertRow(testDb, {
			id: strayId,
			name: "Stray",
			type: "Input",
			data: {
				destination: "{item.title}",
				actions: [{ condition: "", true: "{show()}", false: "" }],
			},
		});

		await expect(pgliteClient.exec(MIGRATION_SQL)).rejects.toThrow(
			/unsupported \{show\(\)\}/,
		);
	});
});
