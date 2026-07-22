import { describe, expect, test } from "bun:test";
import { SDUI_ROW_TRIGGERS } from "evy-types";
import { getRowTriggers } from "./rowTriggers";

const ALL_ROW_TYPES = Object.keys(SDUI_ROW_TRIGGERS);
const KNOWN_TRIGGER_NAMES = [
	"tap",
	"delete",
	"tap-row",
	"tap-column",
	"slide-left",
];

describe("rowTriggers", () => {
	test("returns declared triggers for each row type", () => {
		for (const type of ALL_ROW_TYPES) {
			const triggers = getRowTriggers(type);
			expect(triggers.length).toBeGreaterThan(0);
			for (const spec of triggers) {
				expect(KNOWN_TRIGGER_NAMES).toContain(spec.trigger);
			}
		}
	});

	test("Calendar requires tap, tap-row, and tap-column", () => {
		expect(getRowTriggers("Calendar")).toEqual([
			{ trigger: "tap", required: true },
			{ trigger: "tap-column", required: true },
			{ trigger: "tap-row", required: true },
		]);
	});

	test("SelectPhoto requires tap and delete", () => {
		expect(getRowTriggers("SelectPhoto")).toEqual([
			{ trigger: "delete", required: true },
			{ trigger: "tap", required: true },
		]);
	});

	test("Heading, Input, ListItem, and Text declare optional slide-left", () => {
		for (const type of ["Heading", "Input", "ListItem", "Text"]) {
			expect(getRowTriggers(type)).toEqual([
				{ trigger: "slide-left", required: false },
				{ trigger: "tap", required: false },
			]);
		}
	});
});
