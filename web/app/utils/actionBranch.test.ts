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
	it("parses show action with row id", () => {
		expect(parseBranch("{show(row-abc)}")).toEqual({
			functionName: "show",
			args: ["row-abc"],
		});
	});

	it("serializes show action with row id", () => {
		expect(serializeBranch("show", ["row-abc"])).toBe("{show(row-abc)}");
	});

	it("does not serialize show without a row id", () => {
		expect(serializeBranch("show", [])).toBe("");
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

	it("parses delete_photo as a zero-arg action", () => {
		expect(parseBranch("{delete_photo()}")).toEqual({
			functionName: "delete_photo",
			args: [],
		});
		expect(serializeBranch("delete_photo", [])).toBe("{delete_photo()}");
	});

	it("parses and serializes select with datum", () => {
		expect(parseBranch("{select($datum)}")).toEqual({
			functionName: "select",
			args: ["$datum"],
		});
		expect(serializeBranch("select", ["$datum"])).toBe("{select($datum)}");
	});

	it("parses and serializes zero-arg row actions", () => {
		expect(parseBranch("{select_photo()}")).toEqual({
			functionName: "select_photo",
			args: [],
		});
		expect(serializeBranch("select_photo", [])).toBe("{select_photo()}");

		expect(parseBranch("{expand_photo()}")).toEqual({
			functionName: "expand_photo",
			args: [],
		});
		expect(serializeBranch("expand_photo", [])).toBe("{expand_photo()}");
	});

	it("parses and serializes expand_text with row id", () => {
		expect(parseBranch("{expand_text(row-expand)}")).toEqual({
			functionName: "expand_text",
			args: ["row-expand"],
		});
		expect(serializeBranch("expand_text", ["row-expand"])).toBe(
			"{expand_text(row-expand)}",
		);
		expect(serializeBranch("expand_text", [])).toBe("");
	});

	it("resolves row labels for show and expand_text display", () => {
		const now = "2024-01-01T00:00:00.000Z";
		const flowsById = {
			"flow-1": {
				id: "flow-1",
				name: "Main",
				pageIds: ["page-1"],
				createdAt: now,
				updatedAt: now,
			},
		};
		const pagesById = {
			"page-1": {
				id: "page-1",
				name: "Home",
				title: "",
				rowIds: ["row-expand"],
				createdAt: now,
				updatedAt: now,
			},
		};
		const rowsById = {
			"row-expand": {
				id: "row-expand",
				name: "Expand target",
				type: "TextExpand",
				visible: "true",
				data: {},
				createdAt: now,
				updatedAt: now,
			},
		};

		const expandDisplay = formatBranchDisplay(
			"{expand_text(row-expand)}",
			flowsById,
			pagesById,
			rowsById,
		);
		const showDisplay = formatBranchDisplay(
			"{show(row-expand)}",
			flowsById,
			pagesById,
			rowsById,
		);
		const locationLabel = "Main / Home / Expand target";
		expect(expandDisplay).toBe(`expand_text(${locationLabel})`);
		expect(showDisplay).toBe(`show(${locationLabel})`);
	});
});
