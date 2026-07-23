import { afterEach, describe, expect, it } from "bun:test";
import {
	isGooglePlacesMockEnabled,
	placeSearch,
	setPlacesClientForTests,
} from "../procedures/placeSearch";

function restoreEnv(key: string, previous: string | undefined) {
	if (previous === undefined) {
		delete process.env[key];
	} else {
		process.env[key] = previous;
	}
}

describe("placeSearch mock client", () => {
	const previousMockFlag = process.env.GOOGLE_PLACES_MOCK;
	const previousApiKey = process.env.GOOGLE_PLACES_API_KEY;

	afterEach(() => {
		restoreEnv("GOOGLE_PLACES_MOCK", previousMockFlag);
		restoreEnv("GOOGLE_PLACES_API_KEY", previousApiKey);
		setPlacesClientForTests(undefined);
	});

	it("is enabled when GOOGLE_PLACES_MOCK is true", () => {
		process.env.GOOGLE_PLACES_MOCK = "true";
		process.env.GOOGLE_PLACES_API_KEY = "real-key";
		expect(isGooglePlacesMockEnabled()).toBe(true);
	});

	it("is disabled when GOOGLE_PLACES_MOCK is false", () => {
		process.env.GOOGLE_PLACES_MOCK = "false";
		process.env.GOOGLE_PLACES_API_KEY = "googlekey";
		expect(isGooglePlacesMockEnabled()).toBe(false);
	});

	it("returns Sydney fixtures for sydney queries", async () => {
		process.env.GOOGLE_PLACES_MOCK = "true";
		process.env.GOOGLE_PLACES_API_KEY = "googlekey";

		const result = await placeSearch({ input: "Sydney" });

		expect(result).toEqual([
			{
				id: "mock-id-sydney",
				unit: "",
				street: "1 George Street",
				city: "Sydney",
				state: "NSW",
				postcode: "2000",
				country: "Australia",
				latitude: -33.86882,
				longitude: 151.2092955,
			},
		]);
	});
});
