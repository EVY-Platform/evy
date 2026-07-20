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

	it("parses update with filter and changes objects", () => {
		expect(
			parseBranch(
				`{update(${MARKETPLACE_SERVICE},${MARKETPLACE_RESOURCE.MESSAGES},{fk: $datum.id, archivedAt: null},{archivedAt: now()})}`,
			),
		).toEqual({
			functionName: "update",
			args: [
				MARKETPLACE_SERVICE,
				MARKETPLACE_RESOURCE.MESSAGES,
				"{fk: $datum.id, archivedAt: null}",
				"{archivedAt: now()}",
			],
		});
	});

	it("serializes update with filter and changes objects", () => {
		expect(
			serializeBranch("update", [
				MARKETPLACE_SERVICE,
				MARKETPLACE_RESOURCE.MESSAGES,
				"{fk: $datum.id, archivedAt: null}",
				"{archivedAt: now()}",
			]),
		).toBe(
			`{update(${MARKETPLACE_SERVICE},${MARKETPLACE_RESOURCE.MESSAGES},{fk: $datum.id, archivedAt: null},{archivedAt: now()})}`,
		);
	});

	it("keeps filter and changes in update display text", () => {
		expect(
			formatBranchDisplay(
				"{update(svc-1,res-1,{fk: id-1, archivedAt: null},{archivedAt: now()})}",
			),
		).toBe(
			"update(svc-1, res-1, {fk: id-1, archivedAt: null}, {archivedAt: now()})",
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
