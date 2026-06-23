import { describe, expect, it } from "bun:test";
import {
	validateDataEvyFile,
	validateFileUploadChunkMetadata,
	validateFileWithBinary,
	validateUiFlow as validateFlowData,
	validateDataEvyOrganization as validateOrganizationPayload,
	validateDataEvyService as validateServicePayload,
	validateDataEvyServiceProvider as validateServiceProviderPayload,
} from "evy-types/validators";

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
		const flowId = crypto.randomUUID();
		const pageId = crypto.randomUUID();
		const rowId = crypto.randomUUID();
		expect(() =>
			validateFlowData({
				id: flowId,
				name: "F",
				pages: [
					{
						id: pageId,
						title: "P",
						rows: [
							{
								id: rowId,
								type: "Text",
								source: "",
								actions: [],
								view: {
									content: {
										title: "Always visible",
									},
								},
							},
						],
					},
				],
			}),
		).toThrow("Flow validation failed");
	});

	it("accepts row with visible predicate", () => {
		const flowId = crypto.randomUUID();
		const pageId = crypto.randomUUID();
		const rowId = crypto.randomUUID();
		const out = validateFlowData({
			id: flowId,
			name: "F",
			pages: [
				{
					id: pageId,
					title: "P",
					rows: [
						{
							id: rowId,
							type: "Text",
							source: "",
							actions: [],
							visible:
								"{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.payment_methods.cash == true}",
							view: {
								content: {
									title: "Cash accepted",
								},
							},
						},
					],
				},
			],
		});
		expect(out.pages[0]?.rows[0]?.visible).toBe(
			"{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.payment_methods.cash == true}",
		);
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
