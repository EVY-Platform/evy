import { describe, expect, test } from "bun:test";
import { SDUI_ROW_TRIGGERS } from "evy-types";
import { getRowTriggers, TRIGGER_LABELS } from "./rowTriggers";

const ALL_ROW_TYPES = Object.keys(SDUI_ROW_TRIGGERS);
const KNOWN_TRIGGER_NAMES = Object.keys(TRIGGER_LABELS);

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
		expect(getRowTriggers("calendar")).toEqual([
			{ trigger: "tap", required: true },
			{ trigger: "tap_column", required: true },
			{ trigger: "tap_row", required: true },
		]);
	});

	test("SelectPhoto requires tap and delete", () => {
		expect(getRowTriggers("select_photo")).toEqual([
			{ trigger: "delete", required: true },
			{ trigger: "tap", required: true },
		]);
	});

	test("Heading, ListItem, and Text declare optional swipe-left", () => {
		for (const type of ["heading", "list_item", "text"]) {
			expect(getRowTriggers(type)).toEqual([
				{ trigger: "swipe_left", required: false },
				{ trigger: "tap", required: false },
			]);
		}
	});

	test("Input declares optional submit, swipe-left, and tap", () => {
		expect(getRowTriggers("input")).toEqual([
			{ trigger: "submit", required: false },
			{ trigger: "swipe_left", required: false },
			{ trigger: "tap", required: false },
		]);
	});

	test("TextArea declares optional submit and tap", () => {
		expect(getRowTriggers("text_area")).toEqual([
			{ trigger: "submit", required: false },
			{ trigger: "tap", required: false },
		]);
	});

	test("Search declares optional tap only", () => {
		expect(getRowTriggers("search")).toEqual([
			{ trigger: "tap", required: false },
		]);
	});
});
