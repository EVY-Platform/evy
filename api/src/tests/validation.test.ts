import { describe, it, expect } from "bun:test";
import {
	validateDataEvyOrganization as validateOrganizationPayload,
	validateDataEvyService as validateServicePayload,
	validateDataEvyServiceProvider as validateServiceProviderPayload,
	validateDataEvyImage,
	validateGetImageParams,
	validateUiFlow as validateFlowData,
} from "evy-types/validators";

describe("validateServicePayload", () => {
	const id = "550e8400-e29b-41d4-a716-446655440000";
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
	const id = "550e8400-e29b-41d4-a716-446655440000";
	const now = "2024-01-19T12:00:00.000Z";

	it("accepts a valid Organization payload", () => {
		const out = validateOrganizationPayload({
			id,
			name: "Org",
			description: "D",
			logo: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
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
	const id = "550e8400-e29b-41d4-a716-446655440000";
	const sid = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
	const oid = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
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
});

describe("validateGetImageParams", () => {
	const id = "550e8400-e29b-41d4-a716-446655440000";

	it("accepts a valid image id", () => {
		const out = validateGetImageParams({ id });
		expect(out.id).toBe(id);
	});

	it("rejects invalid params", () => {
		expect(() => validateGetImageParams({ id: "not-a-uuid" })).toThrow(
			"GetImageRequest validation failed",
		);
		expect(() => validateGetImageParams({ id, extra: true })).toThrow(
			"GetImageRequest validation failed",
		);
	});
});

describe("validateDataEvyImage", () => {
	const id = "550e8400-e29b-41d4-a716-446655440000";
	const now = "2024-01-19T12:00:00.000Z";

	it("accepts valid image metadata", () => {
		const out = validateDataEvyImage({
			id,
			type: "image/jpeg",
			createdAt: now,
			updatedAt: now,
		});
		expect(out.id).toBe(id);
		expect(out.type).toBe("image/jpeg");
	});

	it("rejects unsupported type", () => {
		expect(() =>
			validateDataEvyImage({
				id,
				type: "image/gif",
				createdAt: now,
				updatedAt: now,
			}),
		).toThrow("Image validation failed");
	});

	it("rejects missing id", () => {
		expect(() =>
			validateDataEvyImage({
				type: "image/jpeg",
				createdAt: now,
				updatedAt: now,
			}),
		).toThrow("Image validation failed");
	});
});
