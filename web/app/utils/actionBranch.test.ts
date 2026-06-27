import { describe, expect, it } from "bun:test";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
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
		expect(
			parseBranch(
				`{create(${MARKETPLACE_SERVICE},${MARKETPLACE_RESOURCE.ITEMS})}`,
			),
		).toEqual({
			functionName: "create",
			args: [MARKETPLACE_SERVICE, MARKETPLACE_RESOURCE.ITEMS],
		});
	});

	it("serializes create with namespace and resource", () => {
		expect(
			serializeBranch("create", [
				MARKETPLACE_SERVICE,
				MARKETPLACE_RESOURCE.ITEMS,
			]),
		).toBe(
			`{create(${MARKETPLACE_SERVICE},${MARKETPLACE_RESOURCE.ITEMS})}`,
		);
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
