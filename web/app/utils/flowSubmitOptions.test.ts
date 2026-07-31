import { describe, expect, it } from "bun:test";
import type { ServiceResource } from "../types/resources";
import {
	resourceOptionsForService,
	serviceOfSubmitsRef,
	serviceOptionsFor,
} from "./flowSubmitOptions";

const serviceResources: ServiceResource[] = [
	{ id: "alpha_service.items", name: "items" },
	{ id: "alpha_service.records", name: "records" },
	{ id: "beta_service.orders", name: "orders" },
];

const serviceNamesById = new Map<string, string>([
	["alpha_service", "Alpha Service"],
	["beta_service", "Beta"],
]);

describe("serviceOptionsFor", () => {
	it("derives services from resource refs and de-duplicates", () => {
		const options = serviceOptionsFor(serviceResources, serviceNamesById);
		expect(options.map((option) => option.value).sort()).toEqual([
			"alpha_service",
			"beta_service",
		]);
	});

	it("uses serviceNamesById for labels, falling back to the slug", () => {
		const options = serviceOptionsFor(serviceResources, serviceNamesById);
		const alpha = options.find(
			(option) => option.value === "alpha_service",
		);
		const beta = options.find((option) => option.value === "beta_service");
		expect(alpha?.label).toBe("Alpha Service");
		expect(beta?.label).toBe("Beta");
	});

	it("falls back to display label when the service name is unknown", () => {
		const options = serviceOptionsFor(serviceResources, new Map());
		const alpha = options.find(
			(option) => option.value === "alpha_service",
		);
		expect(alpha?.label).toBe("Alpha service");
	});
});

describe("resourceOptionsForService", () => {
	it("returns only that service's resources, labelled and sorted", () => {
		const options = resourceOptionsForService(
			serviceResources,
			"alpha_service",
		);
		expect(options).toEqual([
			{ value: "alpha_service.items", label: "Items" },
			{ value: "alpha_service.records", label: "Records" },
		]);
	});

	it("returns an empty list for an unknown service", () => {
		expect(
			resourceOptionsForService(serviceResources, "missing_service"),
		).toEqual([]);
	});
});

describe("serviceOfSubmitsRef", () => {
	it('returns "" for an empty ref', () => {
		expect(serviceOfSubmitsRef("")).toBe("");
	});

	it('returns "" for an invalid ref', () => {
		expect(serviceOfSubmitsRef("not-a-ref")).toBe("");
	});

	it("returns the service slug for a valid ref", () => {
		expect(serviceOfSubmitsRef("alpha_service.records")).toBe(
			"alpha_service",
		);
	});
});
