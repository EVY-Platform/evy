import { describe, expect, it } from "bun:test";

import {
	formatBranchDisplay,
	parseBranch,
	serializeBranch,
} from "./actionBranch";

describe("action branch helpers", () => {
	it("parses show action", () => {
		expect(parseBranch("{show()}")).toEqual({
			functionName: "show",
			args: [],
		});
	});

	it("serializes show action", () => {
		expect(serializeBranch("show", [])).toBe("{show()}");
	});

	it("parses create with namespace and resource", () => {
		const MARKETPLACE_ID = "66b092ae-7cd8-4d67-95b7-30b03568fd90";
		const ITEMS_RESOURCE_ID = "dc28ed59-298e-493c-8ff3-3e60f2ebccbd";
		expect(
			parseBranch(`{create(${MARKETPLACE_ID},${ITEMS_RESOURCE_ID})}`),
		).toEqual({
			functionName: "create",
			args: [MARKETPLACE_ID, ITEMS_RESOURCE_ID],
		});
	});

	it("serializes create with namespace and resource", () => {
		const MARKETPLACE_ID = "66b092ae-7cd8-4d67-95b7-30b03568fd90";
		const ITEMS_RESOURCE_ID = "dc28ed59-298e-493c-8ff3-3e60f2ebccbd";
		expect(
			serializeBranch("create", [MARKETPLACE_ID, ITEMS_RESOURCE_ID]),
		).toBe(`{create(${MARKETPLACE_ID},${ITEMS_RESOURCE_ID})}`);
	});

	it("parses navigate query as a third function argument", () => {
		expect(
			parseBranch("{navigate(flow-1,page-2,{items: [id-1, id-2]})}"),
		).toEqual({
			functionName: "navigate",
			args: ["flow-1", "page-2", "{items: [id-1, id-2]}"],
		});
	});

	it("serializes navigate query as a third function argument", () => {
		expect(
			serializeBranch("navigate", [
				"flow-1",
				"page-2",
				"{items: [$datum.id]}",
			]),
		).toBe("{navigate(flow-1,page-2,{items: [$datum.id]})}");
	});

	it("keeps the optional query in navigate display text", () => {
		expect(
			formatBranchDisplay(
				"{navigate(flow-1,page-2,{items: [$datum.id]})}",
			),
		).toBe("navigate(flow-1, page-2, {items: [$datum.id]})");
	});
});
