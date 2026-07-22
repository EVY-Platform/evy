import { describe, expect, test } from "bun:test";
import { SDUI_ROW_TRIGGERS } from "evy-types";
import { getRowTriggers } from "./rowTriggers";

const ALL_ROW_TYPES = Object.keys(SDUI_ROW_TRIGGERS);

describe("rowTriggers", () => {
	test("returns declared triggers for each row type", () => {
		for (const type of ALL_ROW_TYPES) {
			const triggers = getRowTriggers(type);
			expect(triggers.length).toBeGreaterThan(0);
			for (const spec of triggers) {
				expect(["tap", "delete"]).toContain(spec.trigger);
			}
		}
	});

	test("SelectPhoto requires tap and delete", () => {
		expect(getRowTriggers("SelectPhoto")).toEqual([
			{ trigger: "delete", required: true },
			{ trigger: "tap", required: true },
		]);
	});

	test("optional tap rows mark tap as not required", () => {
		expect(getRowTriggers("Text")).toEqual([
			{ trigger: "tap", required: false },
		]);
	});
});
