import { describe, expect, it } from "bun:test";
import {
	coreResourceCatalogVisibility,
	EVY_CORE_RESOURCE_REF,
} from "evy-types/coreResources";
import { assertCoreResourceMutable } from "../data/catalogVisibility";

describe("catalog visibility", () => {
	it("declares visibility on every core resource", () => {
		for (const resourceRef of Object.values(EVY_CORE_RESOURCE_REF)) {
			expect(coreResourceCatalogVisibility(resourceRef)).toBeDefined();
		}
	});

	it("allows mutations on public and private core resources", () => {
		expect(() =>
			assertCoreResourceMutable(EVY_CORE_RESOURCE_REF.FLOWS),
		).not.toThrow();
		expect(() =>
			assertCoreResourceMutable(EVY_CORE_RESOURCE_REF.MESSAGES),
		).not.toThrow();
	});
});
