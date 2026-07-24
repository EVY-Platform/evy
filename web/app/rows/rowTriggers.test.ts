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

	test("Heading, ListItem, and Text declare optional swipe-left", () => {
		for (const type of ["Heading", "ListItem", "Text"]) {
			expect(getRowTriggers(type)).toEqual([
				{ trigger: "swipe-left", required: false },
				{ trigger: "tap", required: false },
			]);
		}
	});

	test("Input declares optional submit, swipe-left, and tap", () => {
		expect(getRowTriggers("Input")).toEqual([
			{ trigger: "submit", required: false },
			{ trigger: "swipe-left", required: false },
			{ trigger: "tap", required: false },
		]);
	});

	test("TextArea declares optional submit and tap", () => {
		expect(getRowTriggers("TextArea")).toEqual([
			{ trigger: "submit", required: false },
			{ trigger: "tap", required: false },
		]);
	});

	test("Search declares optional tap only", () => {
		expect(getRowTriggers("Search")).toEqual([
			{ trigger: "tap", required: false },
		]);
	});
});
