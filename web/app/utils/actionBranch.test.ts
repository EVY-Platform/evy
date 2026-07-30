import { describe, expect, it } from "bun:test";
import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";
import { TEST_RESOURCE_ID } from "../../testFixtures/resourceCatalog";
import {
	branchForStorage,
	branchToEditableString,
	createHasInlineDataArg,
	finalizeCreateBranchForSave,
	formatBranchDisplay,
	parseBranch,
	parseBranchText,
	serializeBranch,
	updateUsesDraftMarker,
} from "./actionBranch";

describe("action branch helpers", () => {
	const resourceRef = TEST_RESOURCE_ID.RECORDS;

	describe("create mode helpers", () => {
		it("detects inline data second argument", () => {
			expect(
				createHasInlineDataArg([resourceRef, "pickup_address"]),
			).toBe(true);
			expect(createHasInlineDataArg([resourceRef, "submit"])).toBe(false);
		});

		it("writes submit when draft signals are offered", () => {
			expect(
				finalizeCreateBranchForSave(`{create(${resourceRef})}`, true),
			).toBe(`{create(${resourceRef},submit)}`);
		});

		it("clears submit when draft signals are not offered", () => {
			expect(
				finalizeCreateBranchForSave(
					`{create(${resourceRef},submit)}`,
					false,
				),
			).toBeNull();
		});

		it("detects draft-mode update marker", () => {
			expect(
				updateUsesDraftMarker([
					resourceRef,
					"{}",
					"{title: x}",
					"draft",
				]),
			).toBe(true);
			expect(
				updateUsesDraftMarker([resourceRef, "{}", "{title: x}"]),
			).toBe(false);
		});

		it("finalizes create branches for save", () => {
			expect(
				finalizeCreateBranchForSave(`{create(${resourceRef})}`, true),
			).toBe(`{create(${resourceRef},submit)}`);
			expect(
				finalizeCreateBranchForSave(
					`{create(${resourceRef},submit)}`,
					false,
				),
			).toBeNull();
			expect(
				finalizeCreateBranchForSave(
					`{create(${resourceRef},pickup_address)}`,
					true,
				),
			).toBe(`{create(${resourceRef},pickup_address)}`);
			expect(
				finalizeCreateBranchForSave(`{create(${resourceRef})}`, false),
			).toBeNull();
		});

		it("preserves inline data when draft signals change", () => {
			expect(
				finalizeCreateBranchForSave(
					`{create(${resourceRef},pickup_address,dest)}`,
					true,
				),
			).toBe(`{create(${resourceRef},pickup_address,dest)}`);
		});
	});

	it("parses show action with row id", () => {
		expect(parseBranchText("{show(row-abc)}")).toEqual({
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

	it("parses create with submit marker", () => {
		expect(parseBranchText(`{create(${resourceRef},submit)}`)).toEqual({
			functionName: "create",
			args: [resourceRef, "submit"],
		});
	});

	it("serializes create with submit marker", () => {
		expect(serializeBranch("create", [resourceRef, "submit"])).toBe(
			`{create(${resourceRef},submit)}`,
		);
	});

	it("round-trips draft-mode update with empty filter", () => {
		const branch = `{update(${resourceRef},{},{transfer_options.pickup.address_id: pickup_address.id},draft)}`;
		expect(parseBranchText(branch)).toEqual({
			functionName: "update",
			args: [
				resourceRef,
				"{}",
				"{transfer_options.pickup.address_id: pickup_address.id}",
				"draft",
			],
		});
		expect(
			serializeBranch("update", [
				resourceRef,
				"{}",
				"{transfer_options.pickup.address_id: pickup_address.id}",
				"draft",
			]),
		).toBe(branch);
	});

	it("parses create with resource ref", () => {
		expect(parseBranchText(`{create(${resourceRef})}`)).toEqual({
			functionName: "create",
			args: [resourceRef],
		});
	});

	it("serializes create with resource ref", () => {
		expect(serializeBranch("create", [resourceRef])).toBe(
			`{create(${resourceRef})}`,
		);
	});

	it("parses update with filter and changes objects", () => {
		expect(
			parseBranchText(
				`{update(${EVY_CORE_RESOURCE_REF.MESSAGES},{fk: $datum.id, closedAt: null},{closedAt: now()})}`,
			),
		).toEqual({
			functionName: "update",
			args: [
				EVY_CORE_RESOURCE_REF.MESSAGES,
				"{fk: $datum.id, closedAt: null}",
				"{closedAt: now()}",
			],
		});
	});

	it("serializes update with filter and changes objects", () => {
		expect(
			serializeBranch("update", [
				EVY_CORE_RESOURCE_REF.MESSAGES,
				"{fk: $datum.id, closedAt: null}",
				"{closedAt: now()}",
			]),
		).toBe(
			`{update(${EVY_CORE_RESOURCE_REF.MESSAGES},{fk: $datum.id, closedAt: null},{closedAt: now()})}`,
		);
	});

	it("keeps filter and changes in update display text", () => {
		expect(
			formatBranchDisplay(
				`{update(${TEST_RESOURCE_ID.RECORDS},{fk: id-1, closedAt: null},{closedAt: now()})}`,
			),
		).toBe(
			`update(${TEST_RESOURCE_ID.RECORDS}, {fk: id-1, closedAt: null}, {closedAt: now()})`,
		);
	});

	it("parses navigate query as a third function argument", () => {
		expect(
			parseBranchText("{navigate(flow-1,page-2,{items: [id-1, id-2]})}"),
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
		expect(parseBranchText("{delete_photo()}")).toEqual({
			functionName: "delete_photo",
			args: [],
		});
		expect(serializeBranch("delete_photo", [])).toBe("{delete_photo()}");
	});

	it("parses and serializes select with datum", () => {
		expect(parseBranchText("{select($datum)}")).toEqual({
			functionName: "select",
			args: ["$datum"],
		});
		expect(serializeBranch("select", ["$datum"])).toBe("{select($datum)}");
	});

	it("parses and serializes zero-arg row actions", () => {
		expect(parseBranchText("{select_photo()}")).toEqual({
			functionName: "select_photo",
			args: [],
		});
		expect(serializeBranch("select_photo", [])).toBe("{select_photo()}");

		expect(parseBranchText("{expand_photo()}")).toEqual({
			functionName: "expand_photo",
			args: [],
		});
		expect(serializeBranch("expand_photo", [])).toBe("{expand_photo()}");
	});

	it("parses and serializes expand_text with row id", () => {
		expect(parseBranchText("{expand_text(row-expand)}")).toEqual({
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
		const flowsById: Record<string, DATA_EVY_Flow> = {
			"flow-1": {
				id: "flow-1",
				name: "Main",
				page_ids: ["page-1"],
				visibility: "public",
				created_at: now,
				updated_at: now,
			},
		};
		const pagesById: Record<string, DATA_EVY_Page> = {
			"page-1": {
				id: "page-1",
				name: "Home",
				title: "",
				row_ids: ["row-expand"],
				visibility: "public",
				created_at: now,
				updated_at: now,
			},
		};
		const rowsById: Record<string, DATA_EVY_Row> = {
			"row-expand": {
				id: "row-expand",
				name: "Expand target",
				type: "text_expand",
				visible: "true",
				data: {},
				visibility: "public",
				created_at: now,
				updated_at: now,
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

describe("structured branch storage", () => {
	it("stores a convertible branch structurally", () => {
		expect(branchForStorage("{close()}")).toEqual({ fn: "close" });
	});

	it("stores the submit keyword as a typed mode", () => {
		expect(branchForStorage("{create(marketplace.items,submit)}")).toEqual({
			fn: "create",
			resource: "marketplace.items",
			mode: "submit",
		});
	});

	it("keeps an empty branch empty", () => {
		expect(branchForStorage("")).toBe("");
	});

	it("refuses to store an unconvertible branch", () => {
		expect(() => branchForStorage("{teleport(x)}")).toThrow(
			"Cannot store action branch",
		);
		expect(() => branchForStorage("not an action")).toThrow(
			"Cannot store action branch",
		);
	});

	it("renders a structured branch back to a string for editing", () => {
		expect(branchToEditableString({ fn: "show", row_id: "row-1" })).toBe(
			"{show(row-1)}",
		);
	});

	it("round-trips a structured branch through the editor model", () => {
		const stored = { fn: "show", row_id: "row-1" } as const;
		expect(branchForStorage(branchToEditableString(stored))).toEqual(
			stored,
		);
	});

	it("parses a structured branch into the editor model", () => {
		expect(parseBranch({ fn: "show", row_id: "row-1" })).toEqual({
			functionName: "show",
			args: ["row-1"],
		});
	});
});
