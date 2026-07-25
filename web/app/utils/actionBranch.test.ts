import { describe, expect, it } from "bun:test";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import {
	applyCreateModeForDraftSignals,
	branchForStorage,
	branchToEditableString,
	createHasInlineDataArg,
	createUsesSubmitMarker,
	finalizeCreateBranchForSave,
	formatBranchDisplay,
	isUnstorableBranchText,
	isValidCreateBranchForSave,
	parseBranch,
	serializeBranch,
	updateUsesDraftMarker,
} from "./actionBranch";

describe("action branch helpers", () => {
	const serviceId = MARKETPLACE_SERVICE;
	const resourceId = MARKETPLACE_RESOURCE.ITEMS;

	describe("create mode helpers", () => {
		it("detects explicit submit marker", () => {
			expect(
				createUsesSubmitMarker([serviceId, resourceId, "submit"]),
			).toBe(true);
			expect(createUsesSubmitMarker([serviceId, resourceId])).toBe(false);
		});

		it("detects inline data third argument", () => {
			expect(
				createHasInlineDataArg([
					serviceId,
					resourceId,
					"pickup_address",
				]),
			).toBe(true);
			expect(
				createHasInlineDataArg([serviceId, resourceId, "submit"]),
			).toBe(false);
		});

		it("writes submit when draft signals are offered", () => {
			expect(
				applyCreateModeForDraftSignals([serviceId, resourceId], true),
			).toEqual([serviceId, resourceId, "submit"]);
		});

		it("clears submit when draft signals are not offered", () => {
			expect(
				applyCreateModeForDraftSignals(
					[serviceId, resourceId, "submit"],
					false,
				),
			).toEqual([serviceId, resourceId, ""]);
		});

		it("returns the same reference when submit mode is already correct", () => {
			const args = [serviceId, resourceId, "submit"];
			expect(applyCreateModeForDraftSignals(args, true)).toBe(args);
		});

		it("detects draft-mode update marker", () => {
			expect(
				updateUsesDraftMarker([
					serviceId,
					resourceId,
					"{}",
					"{title: x}",
					"draft",
				]),
			).toBe(true);
			expect(
				updateUsesDraftMarker([
					serviceId,
					resourceId,
					"{}",
					"{title: x}",
				]),
			).toBe(false);
		});

		it("validates create branches for save", () => {
			expect(
				isValidCreateBranchForSave(
					[serviceId, resourceId, "submit"],
					true,
				),
			).toBe(true);
			expect(
				isValidCreateBranchForSave(
					[serviceId, resourceId, "pickup_address"],
					false,
				),
			).toBe(true);
			expect(
				isValidCreateBranchForSave([serviceId, resourceId], false),
			).toBe(false);
			expect(
				isValidCreateBranchForSave(
					[serviceId, resourceId, "submit"],
					false,
				),
			).toBe(false);
		});

		it("finalizes create branches for save", () => {
			expect(
				finalizeCreateBranchForSave(
					`{create(${serviceId},${resourceId})}`,
					true,
				),
			).toBe(`{create(${serviceId},${resourceId},submit)}`);
			expect(
				finalizeCreateBranchForSave(
					`{create(${serviceId},${resourceId},submit)}`,
					false,
				),
			).toBeNull();
			expect(
				finalizeCreateBranchForSave(
					`{create(${serviceId},${resourceId},pickup_address)}`,
					true,
				),
			).toBe(`{create(${serviceId},${resourceId},pickup_address)}`);
		});

		it("preserves inline data when draft signals change", () => {
			expect(
				applyCreateModeForDraftSignals(
					[serviceId, resourceId, "pickup_address", "dest"],
					true,
				),
			).toEqual([serviceId, resourceId, "pickup_address", "dest"]);
		});
	});

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

	it("parses create with submit marker", () => {
		expect(
			parseBranch(
				`{create(${MARKETPLACE_SERVICE},${MARKETPLACE_RESOURCE.ITEMS},submit)}`,
			),
		).toEqual({
			functionName: "create",
			args: [MARKETPLACE_SERVICE, MARKETPLACE_RESOURCE.ITEMS, "submit"],
		});
	});

	it("serializes create with submit marker", () => {
		expect(
			serializeBranch("create", [
				MARKETPLACE_SERVICE,
				MARKETPLACE_RESOURCE.ITEMS,
				"submit",
			]),
		).toBe(
			`{create(${MARKETPLACE_SERVICE},${MARKETPLACE_RESOURCE.ITEMS},submit)}`,
		);
	});

	it("round-trips draft-mode update with empty filter", () => {
		const branch = `{update(${MARKETPLACE_SERVICE},${MARKETPLACE_RESOURCE.ITEMS},{},{transfer_options.pickup.address_id: pickup_address.id},draft)}`;
		expect(parseBranch(branch)).toEqual({
			functionName: "update",
			args: [
				MARKETPLACE_SERVICE,
				MARKETPLACE_RESOURCE.ITEMS,
				"{}",
				"{transfer_options.pickup.address_id: pickup_address.id}",
				"draft",
			],
		});
		expect(
			serializeBranch("update", [
				MARKETPLACE_SERVICE,
				MARKETPLACE_RESOURCE.ITEMS,
				"{}",
				"{transfer_options.pickup.address_id: pickup_address.id}",
				"draft",
			]),
		).toBe(branch);
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
				`{update(${EVY_CORE_SERVICE},${EVY_CORE_RESOURCE.MESSAGES},{fk: $datum.id, archivedAt: null},{archivedAt: now()})}`,
			),
		).toEqual({
			functionName: "update",
			args: [
				EVY_CORE_SERVICE,
				EVY_CORE_RESOURCE.MESSAGES,
				"{fk: $datum.id, archivedAt: null}",
				"{archivedAt: now()}",
			],
		});
	});

	it("serializes update with filter and changes objects", () => {
		expect(
			serializeBranch("update", [
				EVY_CORE_SERVICE,
				EVY_CORE_RESOURCE.MESSAGES,
				"{fk: $datum.id, archivedAt: null}",
				"{archivedAt: now()}",
			]),
		).toBe(
			`{update(${EVY_CORE_SERVICE},${EVY_CORE_RESOURCE.MESSAGES},{fk: $datum.id, archivedAt: null},{archivedAt: now()})}`,
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

describe("structured branch storage", () => {
	const SVC = "66b092ae-7cd8-4d67-95b7-30b03568fd90";

	it("stores a convertible branch structurally", () => {
		expect(branchForStorage("{close()}")).toEqual({ fn: "close" });
	});

	it("stores the submit keyword as a typed mode", () => {
		expect(branchForStorage(`{create(${SVC},items,submit)}`)).toEqual({
			fn: "create",
			service: SVC,
			resource: "items",
			mode: "submit",
		});
	});

	it("keeps an empty branch empty", () => {
		expect(branchForStorage("")).toBe("");
	});

	// Legacy strings are no longer storable, so an unconvertible branch is a
	// bug to surface rather than something to persist and discover later.
	it("refuses to store an unconvertible branch", () => {
		expect(() => branchForStorage("{teleport(x)}")).toThrow(
			"Cannot store action branch",
		);
		expect(() => branchForStorage("not an action")).toThrow(
			"Cannot store action branch",
		);
	});

	it("renders a structured branch back to a string for editing", () => {
		expect(branchToEditableString({ fn: "show", rowId: "row-1" })).toBe(
			"{show(row-1)}",
		);
		expect(branchToEditableString("{close()}")).toBe("{close()}");
	});

	it("round-trips a structured branch through the editor model", () => {
		const stored = { fn: "show", rowId: "row-1" } as const;
		expect(branchForStorage(branchToEditableString(stored))).toEqual(
			stored,
		);
	});

	it("parses a structured branch into the editor model", () => {
		expect(parseBranch({ fn: "show", rowId: "row-1" })).toEqual({
			functionName: "show",
			args: ["row-1"],
		});
	});

	it("flags only unstorable editor text", () => {
		expect(isUnstorableBranchText("{teleport(x)}")).toBe(true);
		expect(isUnstorableBranchText("{close()}")).toBe(false);
		expect(isUnstorableBranchText("")).toBe(false);
	});
});
