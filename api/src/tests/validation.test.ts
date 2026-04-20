import { describe, it, expect } from "bun:test";
import {
	validateFlowData,
	validateOrganizationPayload,
	validateServicePayload,
	validateServiceProviderPayload,
} from "../validation";

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

	it("accepts ISO strings for createdAt and updatedAt", () => {
		const out = validateServicePayload({
			id,
			name: "n",
			description: "d",
			createdAt: now,
			updatedAt: now,
		});
		expect(out.createdAt).toBe(now);
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
