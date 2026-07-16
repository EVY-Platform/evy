import { PlacesClient, type protos } from "@googlemaps/places";
import type { PlaceSearchRequest, PlaceSearchResponse } from "evy-types";

type PlacesAutocompleteResponse =
	protos.google.maps.places.v1.IAutocompletePlacesResponse;
type PlacesPlace = protos.google.maps.places.v1.IPlace;
type PlacesAddressComponent =
	protos.google.maps.places.v1.Place.IAddressComponent;
type PlatformAddress = Omit<PlaceSearchResponse[number], "id">;

const AUTOCOMPLETE_FIELD_MASK = "suggestions.placePrediction.placeId";
const PLACE_DETAILS_FIELD_MASK = "id,addressComponents,location";

const placesLocale = {
	languageCode: "en-US",
	regionCode: "au",
};

type PlacesClientLike = Pick<PlacesClient, "autocompletePlaces" | "getPlace">;

let placesClient: PlacesClient | undefined;
let placesClientOverride: PlacesClientLike | undefined;

export function setPlacesClientForTests(
	client: PlacesClientLike | undefined,
): void {
	placesClientOverride = client;
	placesClient = undefined;
}

function getPlacesClient(): PlacesClient {
	if (placesClientOverride) {
		return placesClientOverride as PlacesClient;
	}
	if (placesClient) {
		return placesClient;
	}
	const apiKey = process.env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) {
		throw new Error("Missing required env: GOOGLE_PLACES_API_KEY");
	}
	placesClient = new PlacesClient({ apiKey });
	return placesClient;
}

async function runAutocomplete(
	input: string,
): Promise<PlacesAutocompleteResponse> {
	const [response] = await getPlacesClient().autocompletePlaces(
		{
			input,
			...placesLocale,
		},
		{
			otherArgs: {
				headers: {
					"X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
				},
			},
		},
	);
	return response;
}

async function getPlaceDetails(placeId: string): Promise<PlacesPlace> {
	const [place] = await getPlacesClient().getPlace(
		{
			name: `places/${placeId}`,
			...placesLocale,
		},
		{
			otherArgs: {
				headers: {
					"X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
				},
			},
		},
	);
	return place;
}

function findComponent(
	components: PlacesAddressComponent[],
	type: string,
): PlacesAddressComponent | undefined {
	return components.find((component) => component.types?.includes(type));
}

function componentLongText(
	components: PlacesAddressComponent[],
	type: string,
): string {
	return findComponent(components, type)?.longText ?? "";
}

function componentShortText(
	components: PlacesAddressComponent[],
	type: string,
): string {
	return findComponent(components, type)?.shortText ?? "";
}

function cityFromComponents(components: PlacesAddressComponent[]): string {
	return (
		componentLongText(components, "locality") ||
		componentLongText(components, "postal_town") ||
		componentLongText(components, "sublocality")
	);
}

function mapAddressComponents(place: PlacesPlace): PlatformAddress | null {
	const latitude = place.location?.latitude;
	const longitude = place.location?.longitude;
	if (latitude === undefined || longitude === undefined) {
		return null;
	}

	const components = place.addressComponents ?? [];
	const streetNumber = componentLongText(components, "street_number");
	const route = componentLongText(components, "route");

	return {
		unit: componentLongText(components, "subpremise"),
		street: `${streetNumber} ${route}`.trim(),
		city: cityFromComponents(components),
		postcode: componentLongText(components, "postal_code"),
		state: componentShortText(components, "administrative_area_level_1"),
		country: componentLongText(components, "country"),
		latitude,
		longitude,
	};
}

export async function placeSearch(
	params: PlaceSearchRequest,
): Promise<PlaceSearchResponse> {
	const autocompleteResponse = await runAutocomplete(params.input);
	const placeIds = (autocompleteResponse.suggestions ?? [])
		.map((suggestion) => suggestion.placePrediction?.placeId ?? null)
		.filter((placeId): placeId is string => placeId !== null);

	const results = await Promise.all(
		placeIds.map(async (placeId) => {
			const place = await getPlaceDetails(placeId);
			const address = mapAddressComponents(place);
			if (!address) {
				return null;
			}
			return {
				id: place.id ?? placeId,
				...address,
			};
		}),
	);

	return results.filter(
		(result): result is PlaceSearchResponse[number] => result !== null,
	);
}
