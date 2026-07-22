import { describe, expect, it } from "bun:test";
import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import {
	validateDataEvyFile,
	validateFileUploadChunkMetadata,
	validateFileWithBinary,
	validateUiFlow as validateFlowData,
	validateDataEvyOrganization as validateOrganizationPayload,
	validatePlaceSearchRequest,
	validatePlaceSearchResponse,
	validateDataEvyService as validateServicePayload,
	validateDataEvyServiceProvider as validateServiceProviderPayload,
} from "evy-types/validators";

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
	const id = "440dcda6-3a4c-4767-8de0-dffe860fd5ba";
	const now = "2024-01-19T12:00:00.000Z";

	it("accepts a valid Service row payload", () => {
		const out = validateServicePayload({
			id,
			name: "Svc",
			description: "D",
			createdAt: now,
			updatedAt: now,
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
				sortOrder: Number.NaN,
				createdAt: now,
				updatedAt: now,
			}),
		).toThrow("Service validation failed");
	});

	it("rejects numeric timestamps for createdAt", () => {
		expect(() =>
			validateServicePayload({
				id,
				name: "n",
				description: "d",
				createdAt: 1_705_651_372 as unknown as string,
				updatedAt: now,
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
			supportEmail: "a@b.co",
			createdAt: now,
			updatedAt: now,
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
	const sid = "d92f474b-eebb-4c93-9487-dc864f3d814c";
	const oid = "02e8dadc-e141-46ff-81f3-17122d170caf";
	const now = "2024-01-19T12:00:00.000Z";

	it("accepts a valid ServiceProvider payload", () => {
		const out = validateServiceProviderPayload({
			id,
			fkServiceId: sid,
			fkOrganizationId: oid,
			name: "P",
			description: "D",
			logo: sid,
			url: "https://x.com",
			createdAt: now,
			updatedAt: now,
			retired: false,
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
					type: "Text",
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
				type: "Text",
				actions: {},
				visible: `{${MARKETPLACE_RESOURCE.ITEMS}.payment_methods.cash == true}`,
				title: "Cash accepted",
			}),
		);
		expect(out.pages[0]?.rows[0]?.visible).toBe(
			`{${MARKETPLACE_RESOURCE.ITEMS}.payment_methods.cash == true}`,
		);
	});

	it("rejects required tap trigger with no actions", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Submit",
					type: "Button",
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
					type: "Button",
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

	it("accepts optional tap trigger when absent", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Label",
				type: "Text",
				actions: {},
				visible: "true",
				title: "Hello",
			}),
		);
		expect(out.pages[0]?.rows[0]?.type).toBe("Text");
	});

	it("rejects Calendar missing required tap-row actions", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Availability",
					type: "Calendar",
					actions: {
						tap: [
							{
								condition: "",
								false: "",
								true: "{select($datum)}",
							},
						],
						"tap-column": [
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
				type: "Calendar",
				actions: {
					tap: [selectAction],
					"tap-row": [selectAction],
					"tap-column": [selectAction],
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
		expect(out.pages[0]?.rows[0]?.type).toBe("Calendar");
	});

	it("rejects tap-row on a non-Calendar row", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Submit",
					type: "Button",
					actions: {
						tap: [
							{
								condition: "",
								false: "",
								true: "{close()}",
							},
						],
						"tap-row": [
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
		).toThrow('trigger "tap-row" is not declared');
	});

	it("accepts Text with optional swipe-left actions", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Label",
				type: "Text",
				actions: {
					"swipe-left": [
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
		expect(out.pages[0]?.rows[0]?.type).toBe("Text");
	});

	it("rejects swipe-left on a Button", () => {
		expect(() =>
			validateFlowData(
				flowWithRow({
					name: "Submit",
					type: "Button",
					actions: {
						tap: [
							{
								condition: "",
								false: "",
								true: "{close()}",
							},
						],
						"swipe-left": [
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
		).toThrow('trigger "swipe-left" is not declared');
	});

	it("accepts ListItem without swipe-left when optional", () => {
		const out = validateFlowData(
			flowWithRow({
				name: "Item",
				type: "ListItem",
				actions: {},
				visible: "true",
				title: "Hello",
			}),
		);
		expect(out.pages[0]?.rows[0]?.type).toBe("ListItem");
	});
});

describe("validateFileUploadChunkMetadata", () => {
	const uploadId = "440dcda6-3a4c-4767-8de0-dffe860fd5ba";

	it("accepts valid file chunk metadata", () => {
		const out = validateFileUploadChunkMetadata({
			uploadId,
			index: 0,
			byteOffset: 0,
			byteLength: 1,
		});
		expect(out.byteLength).toBe(1);
	});

	it("rejects invalid chunk metadata", () => {
		expect(() =>
			validateFileUploadChunkMetadata({
				uploadId,
				index: 0,
				byteOffset: 0,
				byteLength: 0,
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
			createdAt: now,
			updatedAt: now,
			dataBase64: "abc=",
		});
		expect(out.dataBase64).toBe("abc=");
		expect(out.type).toBe(type);
	});

	it("requires base64 data", () => {
		expect(() =>
			validateFileWithBinary({
				id,
				type,
				createdAt: now,
				updatedAt: now,
			}),
		).toThrow("FileWithBinary validation failed");
	});

	it("requires type", () => {
		expect(() =>
			validateFileWithBinary({
				id,
				createdAt: now,
				updatedAt: now,
				dataBase64: "abc=",
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
			createdAt: now,
			updatedAt: now,
		});
		expect(out.id).toBe(id);
		expect(out.type).toBe(type);
	});

	it("requires type", () => {
		expect(() =>
			validateDataEvyFile({
				id,
				createdAt: now,
				updatedAt: now,
			}),
		).toThrow("File validation failed");
	});

	it("rejects missing id", () => {
		expect(() =>
			validateDataEvyFile({
				type,
				createdAt: now,
				updatedAt: now,
			}),
		).toThrow("File validation failed");
	});
});
