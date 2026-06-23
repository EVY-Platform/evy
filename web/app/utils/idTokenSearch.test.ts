import { describe, expect, test } from "bun:test";

import {
	findSuggestionContextAtCursor,
	replaceSearchToken,
} from "./idTokenSearch";

describe("idTokenSearch", () => {
	test("replaceSearchToken replaces only the active occurrence", () => {
		const value = "item {item.";
		const context = findSuggestionContextAtCursor(value, 10);
		if (context.type !== "root" || !context.token)
			throw new Error("Expected root context with token");
		expect(replaceSearchToken(value, context.token, "res-1")).toBe(
			"item {res-1.",
		);
	});

	test("findSuggestionContextAtCursor detects root triggers", () => {
		expect(findSuggestionContextAtCursor("{", 1)).toEqual({
			type: "root",
			trigger: "{",
			token: null,
		});
		expect(findSuggestionContextAtCursor("{it", 3)).toEqual({
			type: "root",
			trigger: "{",
			token: { text: "it", start: 1, end: 3 },
		});
		expect(findSuggestionContextAtCursor("create(it", 9)).toEqual({
			type: "root",
			trigger: "(",
			token: { text: "it", start: 7, end: 9 },
		});
		expect(findSuggestionContextAtCursor("{item, p", 8)).toEqual({
			type: "root",
			trigger: ",",
			token: { text: "p", start: 7, end: 8 },
		});
	});

	test("findSuggestionContextAtCursor detects attribute qualifiers", () => {
		expect(findSuggestionContextAtCursor("{item.", 6)).toEqual({
			type: "attribute",
			trigger: ".",
			qualifier: "item",
			token: null,
		});
		expect(findSuggestionContextAtCursor("{item.tit", 9)).toEqual({
			type: "attribute",
			trigger: ".",
			qualifier: "item",
			token: { text: "tit", start: 6, end: 9 },
		});
		expect(findSuggestionContextAtCursor("{$datum.", 8)).toEqual({
			type: "attribute",
			trigger: ".",
			qualifier: "$datum",
			token: null,
		});
		expect(findSuggestionContextAtCursor("{$datum.tit", 11)).toEqual({
			type: "attribute",
			trigger: ".",
			qualifier: "$datum",
			token: { text: "tit", start: 8, end: 11 },
		});
	});

	test("findSuggestionContextAtCursor returns none without a trigger", () => {
		expect(findSuggestionContextAtCursor("tit", 3)).toEqual({
			type: "none",
			token: { text: "tit", start: 0, end: 3 },
		});
	});
});
