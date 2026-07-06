import { describe, expect, it } from "bun:test";
import {
	type PlaceSearchDependencies,
	placeSearch,
} from "../procedures/placeSearch";

const ROTHCHILD_PLACE = {
	id: "ChIJRothschild",
	addressComponents: [
		{ longText: "C509", shortText: "C509", types: ["subpremise"] },
		{ longText: "28", shortText: "28", types: ["street_number"] },
		{
			longText: "Rothschild Avenue",
			shortText: "Rothschild Ave",
			types: ["route"],
		},
		{ longText: "Rosebery", shortText: "Rosebery", types: ["locality"] },
		{
			longText: "New South Wales",
			shortText: "NSW",
			types: ["administrative_area_level_1"],
		},
		{ longText: "2018", shortText: "2018", types: ["postal_code"] },
		{ longText: "Australia", shortText: "AU", types: ["country"] },
	],
	location: { latitude: -33.9172075, longitude: 151.1985883 },
};

describe("placeSearch", () => {
	it("maps the EVY request to Places autocomplete", async () => {
		const deps: PlaceSearchDependencies = {
			runAutocomplete: async (request) => {
				expect(request).toEqual({
					input: "28 Rothschild",
					languageCode: "en-US",
					regionCode: "au",
					origin: { latitude: 37.7893, longitude: -122.4039 },
					includedPrimaryTypes: ["housing"],
				});
				return { suggestions: [] };
			},
			getPlaceDetails: async () => {
				throw new Error("getPlaceDetails should not be called");
			},
		};

		const result = await placeSearch(
			{
				input: "28 Rothschild",
				language: "en-US",
				region: "au",
				origin: { lat: 37.7893, lng: -122.4039 },
				types: ["housing"],
			},
			deps,
		);

		expect(result).toEqual([]);
	});

	it("resolves place predictions into flat EVY addresses", async () => {
		const deps: PlaceSearchDependencies = {
			runAutocomplete: async () => ({
				suggestions: [
					{
						placePrediction: {
							placeId: "place-1",
							structuredFormat: {
								mainText: { text: "28 Rothschild Avenue" },
							},
							text: {
								text: "28 Rothschild Avenue, Rosebery NSW, Australia",
							},
						},
					},
					{ queryPrediction: {} },
				],
			}),
			getPlaceDetails: async (placeId) => {
				expect(placeId).toBe("place-1");
				return ROTHCHILD_PLACE;
			},
		};

		const result = await placeSearch(
			{ input: "28 Rothschild", language: "en-US", region: "au" },
			deps,
		);

		expect(result).toEqual([
			{
				id: "ChIJRothschild",
				unit: "C509",
				street: "28 Rothschild Avenue",
				city: "Rosebery",
				state: "NSW",
				postcode: "2018",
				country: "Australia",
				latitude: -33.9172075,
				longitude: 151.1985883,
			},
		]);
	});
});
