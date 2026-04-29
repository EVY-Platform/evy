import { describe, expect, it } from "bun:test";

import {
	formatBranchDisplay,
	parseBranch,
	serializeBranch,
} from "./actionBranch";

describe("action branch helpers", () => {
	it("parses navigate query JSON as a third function argument", () => {
		expect(
			parseBranch('{navigate(flow-1,page-2,{"items": ["id-1", "id-2"]})}'),
		).toEqual({
			functionName: "navigate",
			args: ["flow-1", "page-2", '{"items": ["id-1", "id-2"]}'],
		});
	});

	it("serializes navigate query as a third function argument", () => {
		expect(
			serializeBranch("navigate", [
				"flow-1",
				"page-2",
				'{"items": [$datum.id]}',
			]),
		).toBe('{navigate(flow-1,page-2,{"items": [$datum.id]})}');
	});

	it("keeps the optional query in navigate display text", () => {
		expect(
			formatBranchDisplay('{navigate(flow-1,page-2,{"items": [$datum.id]})}'),
		).toBe('navigate(flow-1, page-2, {"items": [$datum.id]})');
	});
});
