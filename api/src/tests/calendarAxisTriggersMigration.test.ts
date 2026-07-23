import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import * as schema from "evy-types/db/schema.generated";
import { action, insertRow, setupMigrationTest } from "./wsTestHelpers";

const { testDb, runMigration } = setupMigrationTest(
	"0010_calendar_axis_triggers.sql",
);

const SELECT_DATUM_ACTION = action("{select($datum)}");

describe("0010_calendar_axis_triggers", () => {
	it("backfills missing tap-row and tap-column on Calendar rows, leaving custom and non-Calendar untouched", async () => {
		const calendarNeedsBackfillId = "11111111-1111-4111-8111-111111111111";
		const calendarCustomId = "22222222-2222-4222-8222-222222222222";
		const buttonId = "33333333-3333-4333-8333-333333333333";
		const customTapRow = {
			condition: "",
			false: "",
			true: "{show(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa)}",
		};

		await insertRow(testDb, {
			id: calendarNeedsBackfillId,
			name: "Needs backfill",
			type: "Calendar",
			data: {
				source: "{item.pickup_selection}",
				destination: "{item.pickup_selection}",
				actions: {
					tap: [SELECT_DATUM_ACTION],
				},
			},
		});
		await insertRow(testDb, {
			id: calendarCustomId,
			name: "Custom tap-row",
			type: "Calendar",
			data: {
				source: "{item.delivery_selection}",
				destination: "{item.delivery_selection}",
				actions: {
					tap: [SELECT_DATUM_ACTION],
					"tap-row": [customTapRow],
					"tap-column": [SELECT_DATUM_ACTION],
				},
			},
		});
		await insertRow(testDb, {
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

		await runMigration();

		const needsBackfill = await testDb.query.row.findFirst({
			where: eq(schema.row.id, calendarNeedsBackfillId),
		});
		expect(needsBackfill?.data).toMatchObject({
			actions: {
				tap: [SELECT_DATUM_ACTION],
				"tap-row": [SELECT_DATUM_ACTION],
				"tap-column": [SELECT_DATUM_ACTION],
			},
		});

		const custom = await testDb.query.row.findFirst({
			where: eq(schema.row.id, calendarCustomId),
		});
		expect(custom?.data).toMatchObject({
			actions: {
				tap: [SELECT_DATUM_ACTION],
				"tap-row": [customTapRow],
				"tap-column": [SELECT_DATUM_ACTION],
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
		expect(button?.data).not.toHaveProperty(["actions", "tap-row"]);
	});
});
