import type { protos } from "@googlemaps/places";
import { ROTHCHILD_CANONICAL_ADDRESS } from "../../../scripts/fixtures/canonicalAddresses";
import type { PlacesClientLike } from "./placeSearch";

type PlacesAutocompleteResponse =
	protos.google.maps.places.v1.IAutocompletePlacesResponse;
type PlacesPlace = protos.google.maps.places.v1.IPlace;

const MOCK_SYDNEY_PLACE_ID = "mock-place-sydney";
const MOCK_ROTHSCHILD_PLACE_ID = "mock-place-rothschild";

const MOCK_SYDNEY_PLACE: PlacesPlace = {
	id: "mock-id-sydney",
	addressComponents: [
		{ longText: "1", shortText: "1", types: ["street_number"] },
		{ longText: "George Street", shortText: "George St", types: ["route"] },
		{ longText: "Sydney", shortText: "Sydney", types: ["locality"] },
		{
			longText: "New South Wales",
			shortText: "NSW",
			types: ["administrative_area_level_1"],
		},
		{ longText: "2000", shortText: "2000", types: ["postal_code"] },
		{ longText: "Australia", shortText: "AU", types: ["country"] },
	],
	location: { latitude: -33.86882, longitude: 151.2092955 },
};

const MOCK_ROTHSCHILD_PLACE: PlacesPlace = {
	id: ROTHCHILD_CANONICAL_ADDRESS.id,
	addressComponents: [
		{
			longText: ROTHCHILD_CANONICAL_ADDRESS.unit,
			shortText: ROTHCHILD_CANONICAL_ADDRESS.unit,
			types: ["subpremise"],
		},
		{ longText: "28", shortText: "28", types: ["street_number"] },
		{
			longText: ROTHCHILD_CANONICAL_ADDRESS.street,
			shortText: "Rothschild Ave",
			types: ["route"],
		},
		{
			longText: ROTHCHILD_CANONICAL_ADDRESS.city,
			shortText: ROTHCHILD_CANONICAL_ADDRESS.city,
			types: ["locality"],
		},
		{
			longText: "New South Wales",
			shortText: ROTHCHILD_CANONICAL_ADDRESS.state,
			types: ["administrative_area_level_1"],
		},
		{
			longText: ROTHCHILD_CANONICAL_ADDRESS.postcode,
			shortText: ROTHCHILD_CANONICAL_ADDRESS.postcode,
			types: ["postal_code"],
		},
		{
			longText: ROTHCHILD_CANONICAL_ADDRESS.country,
			shortText: "AU",
			types: ["country"],
		},
	],
	location: {
		latitude: ROTHCHILD_CANONICAL_ADDRESS.latitude,
		longitude: ROTHCHILD_CANONICAL_ADDRESS.longitude,
	},
};

const MOCK_PLACES_BY_ID: Record<string, PlacesPlace> = {
	[MOCK_SYDNEY_PLACE_ID]: MOCK_SYDNEY_PLACE,
	[MOCK_ROTHSCHILD_PLACE_ID]: MOCK_ROTHSCHILD_PLACE,
};

function autocompleteSuggestionsForInput(
	input: string,
): PlacesAutocompleteResponse["suggestions"] {
	const normalized = input.trim().toLowerCase();
	const suggestions: NonNullable<PlacesAutocompleteResponse["suggestions"]> =
		[];

	if (normalized.includes("sydney")) {
		suggestions.push({
			placePrediction: { placeId: MOCK_SYDNEY_PLACE_ID },
		});
	}
	if (normalized.includes("rothschild")) {
		suggestions.push({
			placePrediction: { placeId: MOCK_ROTHSCHILD_PLACE_ID },
		});
	}

	return suggestions;
}

export function createMockPlacesClient(): PlacesClientLike {
	return {
		async autocompletePlaces(request) {
			return [
				{ suggestions: autocompleteSuggestionsForInput(request.input) },
			];
		},
		async getPlace(request) {
			const placeId = request.name.replace(/^places\//, "");
			const place = MOCK_PLACES_BY_ID[placeId];
			if (!place) {
				throw new Error(`Mock Places: unknown place id ${placeId}`);
			}
			return [place];
		},
	};
}
