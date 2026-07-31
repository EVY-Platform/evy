import { describe, expect, it } from "bun:test";
import {
	validateDataEvyFile,
	validateFileUploadChunkMetadata,
	validateFileWithBinary,
	validateUiFlow as validateFlowData,
	validateDataEvyOrganization as validateOrganizationPayload,
	validatePlaceSearchRequest,
	validatePlaceSearchResponse,
	validateDataEvyRow as validateRowPayload,
	validateDataEvyService as validateServicePayload,
	validateDataEvyServiceProvider as validateServiceProviderPayload,
} from "evy-types/validators";
import { EXTERNAL_TEST_RESOURCE } from "./externalServiceFixture";

describe("place search validators", () => {
	it("accepts valid place search payloads", () => {
		const request = validatePlaceSearchRequest({
			input: "28 Rothschild",
		});
		const response = validatePlaceSearchResponse([
			{
				id: "ChIJRothschild",
				street: "28 Rothschild Avenue",
				city: "Rosebery",
				country: "Australia",
				latitude: -33.9172075,
				longitude: 151.1985883,
			},
		]);

		expect(request.input).toBe("28 Rothschild");
		expect(response[0]?.street).toBe("28 Rothschild Avenue");
	});

	it.each([
		{ field: "region", value: "au" },
		{ field: "language", value: "en-US" },
	])("rejects place search payloads that include $field", ({
		field,
		value,
	}) => {
		expect(() =>
			validatePlaceSearchRequest({
				input: "28 Rothschild",
				[field]: value,
			}),
		).toThrow("PlaceSearchRequest validation failed");
	});
});

describe("validateServicePayload", () => {
	const id = "marketplace";
	const now = "2024-01-19T12:00:00.000Z";

	it("accepts a valid Service row payload", () => {
		const out = validateServicePayload({
			id,
			name: "Svc",
			description: "D",
			created_at: now,
			updated_at: now,
			visibility: "public",
		});
		expect(out.name).toBe("Svc");
		expect(out.description).toBe("D");
	});

	it("rejects non-object root", () => {
		expect(() => validateServicePayload([])).toThrow(
			"Service validation failed",
		);
		expect(() => validateServicePayload("x")).toThrow(
			"Service validation failed",
		);
	});

	it("rejects NaN in optional numeric fields", () => {
		expect(() =>
			validateServicePayload({
				id,
				name: "n",
				description: "d",
				sort_order: Number.NaN,
				created_at: now,
				updated_at: now,
			}),
		).toThrow("Service validation failed");
	});

	it("rejects numeric timestamps for created_at", () => {
		expect(() =>
			validateServicePayload({
				id,
				name: "n",
				description: "d",
				created_at: 1_705_651_372 as unknown as string,
				updated_at: now,
			}),
		).toThrow("Service validation failed");
	});
});

describe("validateOrganizationPayload", () => {
	const id = "440dcda6-3a4c-4767-8de0-dffe860fd5ba";
	const now = "2024-01-19T12:00:00.000Z";

	it("accepts a valid Organization payload", () => {
		const out = validateOrganizationPayload({
			id,
			name: "Org",
			description: "D",
			logo: "d92f474b-eebb-4c93-9487-dc864f3d814c",
			url: "https://example.com",
			support_email: "a@b.co",
			created_at: now,
			updated_at: now,
			visibility: "public",
		});
		expect(out.name).toBe("Org");
	});

	it("rejects invalid payload", () => {
		expect(() => validateOrganizationPayload({})).toThrow(
			"Organization validation failed",
		);
	});
});

describe("validateServiceProviderPayload", () => {
	const id = "440dcda6-3a4c-4767-8de0-dffe860fd5ba";
	const sid = "marketplace";
	const logo = "d92f474b-eebb-4c93-9487-dc864f3d814c";
	const oid = "02e8dadc-e141-46ff-81f3-17122d170caf";
	const now = "2024-01-19T12:00:00.000Z";

	it("accepts a valid ServiceProvider payload", () => {
		const out = validateServiceProviderPayload({
			id,
			fk_service_id: sid,
			fk_organization_id: oid,
			name: "P",
			description: "D",
			logo,
			url: "https://x.com",
			retired: false,
			visibility: "public",
			created_at: now,
			updated_at: now,
		});
		expect(out.name).toBe("P");
	});

	it("rejects invalid payload", () => {
		expect(() => validateServiceProviderPayload({})).toThrow(
			"ServiceProvider validation failed",
		);
	});
});

function flowWithRow(row: Record<string, unknown>) {
	return {
		id: crypto.randomUUID(),
		name: "F",
		pages: [
			{
				id: crypto.randomUUID(),
				name: "Page",
				title: "P",
				rows: [
					{
						id: crypto.randomUUID(),
						...row,
					},
				],
			},
		],
	};
}

describe("validateFlowData", () => {
	it("accepts minimal valid flow", () => {
		const id = crypto.randomUUID();
		const out = validateFlowData({
			id,
			name: "F",
			pages: [],
		});
		expect(out.name).toBe("F");
	});

	it("rejects empty name", () => {
		expect(() =>
			validateFlowData({
				name: "",
				pages: [],
			}),
		).toThrow("Flow validation failed");
	});

	it("requires row visible", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Always Visible Row",
					type: "text",
					actions: {},
					title: "Always visible",
				}),
			),
		).toThrow("Flow validation failed");
	});

	it("accepts row with visible predicate", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Cash Accepted Row",
				type: "text",
				actions: {},
				visible: `{${EXTERNAL_TEST_RESOURCE.RECORDS}.payment_methods.cash == true}`,
				title: "Cash accepted",
			}),
		);
		expect(out.pages[0]?.rows[0]?.visible).toBe(
			`{${EXTERNAL_TEST_RESOURCE.RECORDS}.payment_methods.cash == true}`,
		);
	});

	it("rejects required tap trigger with no actions", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Submit",
					type: "button",
					actions: {},
					visible: "true",
					label: "Go",
				}),
			),
		).toThrow("required trigger must have at least one action");
	});

	it("rejects triggers not declared for the row type", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Submit",
					type: "button",
					actions: {
						delete: [
							{
								condition: "",
								false: "",
								true: "{delete_photo()}",
							},
						],
					},
					visible: "true",
					label: "Go",
				}),
			),
		).toThrow('trigger "delete" is not declared');
	});

	it("accepts submit trigger on Input rows", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Field",
				type: "input",
				source: "{item.title}",
				destination: "{item.title}",
				actions: {
					tap: [
						{
							condition: "",
							false: "",
							true: "{close()}",
						},
					],
					submit: [
						{
							condition: "",
							false: "",
							true: "{close()}",
						},
					],
				},
				visible: "true",
			}),
		);
		expect(out.pages[0]?.rows[0]?.type).toBe("input");
	});

	it("rejects submit trigger on Search rows", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "search",
					type: "search",
					source: "{search}",
					destination: "{result}",
					actions: {
						submit: [
							{
								condition: "",
								false: "",
								true: "{close()}",
							},
						],
					},
					visible: "true",
				}),
			),
		).toThrow('trigger "submit" is not declared');
	});

	it("accepts optional tap trigger when absent", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Label",
				type: "text",
				actions: {},
				visible: "true",
				title: "Hello",
			}),
		);
		expect(out.pages[0]?.rows[0]?.type).toBe("text");
	});

	it("rejects Calendar missing required tap-row actions", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Availability",
					type: "calendar",
					actions: {
						tap: [
							{
								condition: "",
								false: "",
								true: "{select($datum)}",
							},
						],
						tap_column: [
							{
								condition: "",
								false: "",
								true: "{select($datum)}",
							},
						],
					},
					visible: "true",
					source: "{item.pickup_selection}",
					destination: "{item.pickup_selection}",
					start_time: "07:00",
					end_time: "19:00",
					timeslot_interval_minutes: "30",
					label_interval_minutes: "60",
					header_format: "EEE d",
					timeslot_format: "HH:mm",
				}),
			),
		).toThrow("required trigger must have at least one action");
	});

	it("accepts Calendar with tap, tap-row, and tap-column actions", () => {
		const selectAction = {
			condition: "",
			false: "",
			true: "{select($datum)}",
		};
		const out = validateFlowData(
			flowWithRow({
				name: "Availability",
				type: "calendar",
				actions: {
					tap: [selectAction],
					tap_row: [selectAction],
					tap_column: [selectAction],
				},
				visible: "true",
				source: "{item.pickup_selection}",
				destination: "{item.pickup_selection}",
				start_time: "07:00",
				end_time: "19:00",
				timeslot_interval_minutes: "30",
				label_interval_minutes: "60",
				header_format: "EEE d",
				timeslot_format: "HH:mm",
			}),
		);
		expect(out.pages[0]?.rows[0]?.type).toBe("calendar");
	});

	it("rejects tap-row on a non-Calendar row", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Submit",
					type: "button",
					actions: {
						tap: [
							{
								condition: "",
								false: "",
								true: "{close()}",
							},
						],
						tap_row: [
							{
								condition: "",
								false: "",
								true: "{select($datum)}",
							},
						],
					},
					visible: "true",
					label: "Go",
				}),
			),
		).toThrow('trigger "tap_row" is not declared');
	});

	it("accepts Text with optional swipe-left actions", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Label",
				type: "text",
				actions: {
					swipe_left: [
						{
							condition: "",
							false: "",
							true: "{close()}",
						},
					],
				},
				visible: "true",
				title: "Hello",
			}),
		);
		expect(out.pages[0]?.rows[0]?.type).toBe("text");
	});

	it("accepts ListItem with swipe_color hex override", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Item",
				type: "list_item",
				actions: {
					swipe_left: [
						{
							condition: "",
							false: "",
							true: "{close()}",
						},
					],
				},
				visible: "true",
				title: "Hello",
				swipe_label: "Accept",
				swipe_color: "#34C759",
			}),
		);
		expect(out.pages[0]?.rows[0]?.type).toBe("list_item");
	});

	it("rejects invalid swipe_color hex", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Item",
					type: "list_item",
					actions: {},
					visible: "true",
					title: "Hello",
					swipe_color: "blue",
				}),
			),
		).toThrow();
	});

	it("rejects swipe-left on a Button", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Submit",
					type: "button",
					actions: {
						tap: [
							{
								condition: "",
								false: "",
								true: "{close()}",
							},
						],
						swipe_left: [
							{
								condition: "",
								false: "",
								true: "{close()}",
							},
						],
					},
					visible: "true",
					label: "Go",
				}),
			),
		).toThrow('trigger "swipe_left" is not declared');
	});

	it("accepts ListItem without swipe-left when optional", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Item",
				type: "list_item",
				actions: {},
				visible: "true",
				title: "Hello",
			}),
		);
		expect(out.pages[0]?.rows[0]?.type).toBe("list_item");
	});
});

describe("row actions shape validation", () => {
	const baseRow = {
		id: "11111111-1111-4111-8111-111111111111",
		name: "R",
		type: "button",
		visible: "true",
		created_at: "2024-01-01T00:00:00.000Z",
		updated_at: "2024-01-01T00:00:00.000Z",
		visibility: "public" as const,
	};

	function rowWithActions(actions: unknown) {
		return validateRowPayload({ ...baseRow, data: { actions } });
	}

	it("accepts a well-formed trigger list", () => {
		const out = rowWithActions({
			tap: [{ condition: "", false: "", true: "{close()}" }],
		});
		expect(out.data.actions?.tap?.[0]?.true).toBe("{close()}");
	});

	it("accepts the canonical empty actions object", () => {
		expect(() => rowWithActions({})).not.toThrow();
	});

	it("accepts a row with no actions key at all", () => {
		expect(() =>
			validateRowPayload({ ...baseRow, data: { text: "Hello" } }),
		).not.toThrow();
	});

	it("rejects an undeclared trigger name", () => {
		expect(() =>
			rowWithActions({ hover: [{ condition: "", false: "", true: "" }] }),
		).toThrow("must NOT have additional properties");
	});

	it("rejects an action missing a required branch key", () => {
		expect(() =>
			rowWithActions({ tap: [{ false: "", true: "x" }] }),
		).toThrow("must have required property 'condition'");
	});

	it("rejects a trigger whose value is not a list", () => {
		expect(() =>
			rowWithActions({ tap: { condition: "", false: "", true: "" } }),
		).toThrow("must be array");
	});

	it("rejects unknown keys inside an action", () => {
		expect(() =>
			rowWithActions({
				tap: [{ condition: "", false: "", true: "", extra: 1 }],
			}),
		).toThrow("must NOT have additional properties");
	});

	it("names the offending path in the error", () => {
		expect(() => rowWithActions({ tap: [{ true: "x" }] })).toThrow(
			"/data/actions/tap/0",
		);
	});
});

describe("action expression strings", () => {
	const ITEMS = "marketplace.items";
	const ADDRESSES = "evy.addresses";
	const baseRow = {
		id: "11111111-1111-4111-8111-111111111111",
		name: "R",
		type: "button",
		visible: "true",
		created_at: "2024-01-01T00:00:00.000Z",
		updated_at: "2024-01-01T00:00:00.000Z",
		visibility: "public" as const,
	};

	function rowWithBranch(branch: unknown) {
		return validateRowPayload({
			...baseRow,
			data: {
				actions: { tap: [{ condition: "", false: "", true: branch }] },
			},
		});
	}

	it.each([
		["empty branch", ""],
		["close", "{close()}"],
		["delete_photo", "{delete_photo()}"],
		["show", "{show(row-1)}"],
		["expand_text", "{expand_text(row-1)}"],
		["highlight_required", "{highlight_required(title)}"],
		["select", "{select($datum)}"],
		["navigate", "{navigate(f,p)}"],
		["navigate with query", "{navigate(f,p,{id: {$datum.id}})}"],
		["create submit", `{create(${ITEMS},submit)}`],
		["create inline", `{create(${ADDRESSES},{street: {$datum.street}})}`],
		[
			"create from path with id destination",
			`{create(${ADDRESSES},pickup_address,{pickup_address.id})}`,
		],
		[
			"update store",
			`{update(${ITEMS},{id: {item.id}},{status: accepted})}`,
		],
		["update draft", `{update(${ITEMS},{},{status: accepted},draft)}`],
		[
			"update store from path",
			`{update(${ADDRESSES},{id: {item.id}},pickup_address)}`,
		],
	])("accepts %s", (_label, branch) => {
		expect(() => rowWithBranch(branch)).not.toThrow();
	});

	it.each([
		["an unknown function", "{explode()}"],
		["show without a row id", "{show()}"],
		[
			"create submit with extra args",
			"{create(marketplace.a,submit,extra)}",
		],
		["create with unprefixed resource", "{create(items,submit)}"],
		[
			"a store update with an empty filter",
			"{update(marketplace.i,{},{a: b})}",
		],
		[
			"a draft update carrying a filter",
			"{update(marketplace.i,{id: x},{a: b},draft)}",
		],
		[
			"an update with empty changes",
			"{update(marketplace.i,{id: x},{},draft)}",
		],
		["not a brace-wrapped call", "close()"],
	])("rejects %s", (_label, branch) => {
		expect(() => rowWithBranch(branch)).toThrow("Row validation failed");
	});

	it("rejects structured invocations", () => {
		expect(() => rowWithBranch({ fn: "explode" })).toThrow(
			"/data/actions/tap/0/true",
		);
	});

	it("reports the offending branch path for parse errors", () => {
		expect(() => rowWithBranch("{explode()}")).toThrow(
			"data/actions/tap/0/true",
		);
	});
});

describe("validateFlowData submits declaration", () => {
	const ITEMS = "marketplace.items";
	const ADDRESSES = "evy.addresses";

	function submitButton(resource: string) {
		return {
			name: "Submit",
			type: "button",
			actions: {
				tap: [
					{
						condition: "",
						false: "",
						true: `{create(${resource},submit)}`,
					},
				],
			},
			visible: "true",
			label: "Go",
		};
	}

	function flowWithSubmit(
		row: Record<string, unknown>,
		submits?: { resource: string },
	) {
		const flow = flowWithRow(row) as Record<string, unknown>;
		if (submits) flow.submits = submits;
		return flow;
	}

	it("accepts a submitting flow whose declaration matches", () => {
		const out = validateFlowData(
			flowWithSubmit(submitButton(ITEMS), {
				resource: ITEMS,
			}),
		);
		expect(out.submits?.resource).toBe(ITEMS);
	});

	it("rejects a submitting flow with no declaration", () => {
		expect(() =>
			validateFlowData(flowWithSubmit(submitButton(ITEMS))),
		).toThrow('declares no "submits"');
	});

	it("rejects a declaration whose resource does not match the action", () => {
		expect(() =>
			validateFlowData(
				flowWithSubmit(submitButton(ITEMS), {
					resource: ADDRESSES,
				}),
			),
		).toThrow("but its create(...,submit) targets");
	});

	it("rejects a flow submitting more than one entity", () => {
		const flow = flowWithRow(submitButton(ITEMS)) as Record<
			string,
			unknown
		>;
		const pages = flow.pages as Record<string, unknown>[];
		const rows = pages[0]?.rows as Record<string, unknown>[];
		rows.push({
			id: crypto.randomUUID(),
			...submitButton(ADDRESSES),
		});

		expect(() => validateFlowData(flow)).toThrow(
			"submits more than one entity",
		);
	});

	it("ignores non-submit creates", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Inline",
				type: "button",
				actions: {
					tap: [
						{
							condition: "",
							false: "",
							true: "{create(evy.messages,{status: pending})}",
						},
					],
				},
				visible: "true",
				label: "Go",
			}),
		);
		expect(out.submits).toBeUndefined();
	});

	// Flows are authored incrementally, so the declaration may land first.
	it("allows a declaration with no submitting action yet", () => {
		const out = validateFlowData(
			flowWithSubmit(
				{
					name: "Plain",
					type: "text",
					actions: {},
					visible: "true",
					title: "Hello",
				},
				{ resource: ITEMS },
			),
		);
		expect(out.submits?.resource).toBe(ITEMS);
	});

	it("finds submit actions nested in a sheet", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Opener",
					type: "button",
					actions: {
						tap: [{ condition: "", false: "", true: "{close()}" }],
					},
					visible: "true",
					label: "Open",
					sheet: {
						id: crypto.randomUUID(),
						...submitButton(ITEMS),
					},
				}),
			),
		).toThrow('declares no "submits"');
	});
});

describe("validateFileUploadChunkMetadata", () => {
	const upload_id = "440dcda6-3a4c-4767-8de0-dffe860fd5ba";

	it("accepts valid file chunk metadata", () => {
		const out = validateFileUploadChunkMetadata({
			upload_id,
			index: 0,
			byte_offset: 0,
			byte_length: 1,
		});
		expect(out.byte_length).toBe(1);
	});

	it("rejects invalid chunk metadata", () => {
		expect(() =>
			validateFileUploadChunkMetadata({
				upload_id,
				index: 0,
				byte_offset: 0,
				byte_length: 0,
			}),
		).toThrow("FileUploadChunkMetadata validation failed");
	});
});

describe("validateFileWithBinary", () => {
	const id = "440dcda6-3a4c-4767-8de0-dffe860fd5ba";
	const now = "2024-01-19T12:00:00.000Z";
	const type = "image/jpeg";

	it("accepts valid file metadata with base64 data", () => {
		const out = validateFileWithBinary({
			id,
			type,
			created_at: now,
			updated_at: now,
			visibility: "public",
			data_base64: "abc=",
		});
		expect(out.data_base64).toBe("abc=");
		expect(out.type).toBe(type);
	});

	it("requires base64 data", () => {
		expect(() =>
			validateFileWithBinary({
				id,
				type,
				created_at: now,
				updated_at: now,
			}),
		).toThrow("FileWithBinary validation failed");
	});

	it("requires type", () => {
		expect(() =>
			validateFileWithBinary({
				id,
				created_at: now,
				updated_at: now,
				data_base64: "abc=",
			}),
		).toThrow("FileWithBinary validation failed");
	});
});

describe("validateDataEvyFile", () => {
	const id = "440dcda6-3a4c-4767-8de0-dffe860fd5ba";
	const now = "2024-01-19T12:00:00.000Z";
	const type = "image/jpeg";

	it("accepts valid file metadata", () => {
		const out = validateDataEvyFile({
			id,
			type,
			created_at: now,
			updated_at: now,
			visibility: "public",
		});
		expect(out.id).toBe(id);
		expect(out.type).toBe(type);
	});

	it("requires type", () => {
		expect(() =>
			validateDataEvyFile({
				id,
				created_at: now,
				updated_at: now,
			}),
		).toThrow("File validation failed");
	});

	it("rejects missing id", () => {
		expect(() =>
			validateDataEvyFile({
				type,
				created_at: now,
				updated_at: now,
			}),
		).toThrow("File validation failed");
	});
});
