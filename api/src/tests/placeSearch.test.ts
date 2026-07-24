import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { protos } from "@googlemaps/places";
import {
	isGooglePlacesMockEnabled,
	PLACEHOLDER_GOOGLE_PLACES_API_KEY,
	placeSearch,
	setPlacesClientForTests,
} from "../procedures/placeSearch";

type PlacesAutocompleteResponse =
	protos.google.maps.places.v1.IAutocompletePlacesResponse;
type PlacesPlace = protos.google.maps.places.v1.IPlace;

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

let autocompleteImpl = async (
	_input: string,
): Promise<[PlacesAutocompleteResponse]> => [{ suggestions: [] }];
let getPlaceImpl = async (_placeId: string): Promise<[PlacesPlace]> => {
	throw new Error("getPlace should not be called");
};

class FakePlacesClient {
	autocompletePlaces(request: { input: string }) {
		return autocompleteImpl(request.input);
	}

	getPlace(request: { name: string }) {
		const placeId = request.name.replace(/^places\//, "");
		return getPlaceImpl(placeId);
	}
}

describe("placeSearch", () => {
	beforeEach(() => {
		setPlacesClientForTests(new FakePlacesClient());
	});

	afterEach(() => {
		setPlacesClientForTests(undefined);
	});

	it("forwards the EVY input into runAutocomplete", async () => {
		autocompleteImpl = async (input) => {
			expect(input).toBe("28 Rothschild");
			return [{ suggestions: [] }];
		};
		getPlaceImpl = async () => {
			throw new Error("getPlaceDetails should not be called");
		};

		const result = await placeSearch({ input: "28 Rothschild" });

		expect(result).toEqual([]);
	});

	it("resolves place predictions into flat EVY addresses", async () => {
		autocompleteImpl = async () => [
			{
				suggestions: [
					{
						placePrediction: {
							placeId: "place-1",
						},
					},
					{ queryPrediction: {} },
				],
			},
		];
		getPlaceImpl = async (placeId) => {
			expect(placeId).toBe("place-1");
			return [ROTHCHILD_PLACE];
		};

		const result = await placeSearch({ input: "28 Rothschild" });

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

	it("skips place predictions that are missing location", async () => {
		autocompleteImpl = async () => [
			{
				suggestions: [
					{
						placePrediction: {
							placeId: "place-without-location",
						},
					},
				],
			},
		];
		getPlaceImpl = async () => [
			{
				id: "place-without-location",
				addressComponents: ROTHCHILD_PLACE.addressComponents,
			},
		];

		const result = await placeSearch({ input: "28 Rothschild" });

		expect(result).toEqual([]);
	});

	it("toggles mock mode from GOOGLE_PLACES_MOCK", () => {
		const previousMockFlag = process.env.GOOGLE_PLACES_MOCK;
		const previousApiKey = process.env.GOOGLE_PLACES_API_KEY;

		try {
			process.env.GOOGLE_PLACES_MOCK = "true";
			process.env.GOOGLE_PLACES_API_KEY = "real-key";
			expect(isGooglePlacesMockEnabled()).toBe(true);

			process.env.GOOGLE_PLACES_MOCK = "false";
			process.env.GOOGLE_PLACES_API_KEY =
				PLACEHOLDER_GOOGLE_PLACES_API_KEY;
			expect(isGooglePlacesMockEnabled()).toBe(false);
		} finally {
			if (previousMockFlag === undefined) {
				delete process.env.GOOGLE_PLACES_MOCK;
			} else {
				process.env.GOOGLE_PLACES_MOCK = previousMockFlag;
			}
			if (previousApiKey === undefined) {
				delete process.env.GOOGLE_PLACES_API_KEY;
			} else {
				process.env.GOOGLE_PLACES_API_KEY = previousApiKey;
			}
		}
	});
});
