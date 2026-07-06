import { PlacesClient, type protos } from "@googlemaps/places";
import type { PlaceSearchRequest, PlaceSearchResponse } from "evy-types";

type PlacesAutocompleteRequest =
	protos.google.maps.places.v1.IAutocompletePlacesRequest;
type PlacesAutocompleteResponse =
	protos.google.maps.places.v1.IAutocompletePlacesResponse;
type PlacesPlace = protos.google.maps.places.v1.IPlace;
type PlacesAddressComponent =
	protos.google.maps.places.v1.Place.IAddressComponent;
type PlatformAddress = Omit<PlaceSearchResponse[number], "id">;

const AUTOCOMPLETE_FIELD_MASK = "suggestions.placePrediction.placeId";
const PLACE_DETAILS_FIELD_MASK = "id,addressComponents,location";

export type PlaceSearchDependencies = {
	runAutocomplete: (
		request: PlacesAutocompleteRequest,
	) => Promise<PlacesAutocompleteResponse>;
	getPlaceDetails: (placeId: string) => Promise<PlacesPlace>;
};

let placesClient: PlacesClient | null = null;

function defaultPlaceSearchDeps(): PlaceSearchDependencies {
	const apiKey = process.env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) {
		throw new Error("Missing required env: GOOGLE_PLACES_API_KEY");
	}
	if (!placesClient) {
		placesClient = new PlacesClient({ apiKey });
	}
	const client = placesClient;
	return {
		runAutocomplete: async (request) => {
			const [response] = await client.autocompletePlaces(request, {
				otherArgs: {
					headers: {
						"X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
					},
				},
			});
			return response;
		},
		getPlaceDetails: async (placeId) => {
			const [place] = await client.getPlace(
				{ name: `places/${placeId}` },
				{
					otherArgs: {
						headers: {
							"X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
						},
					},
				},
			);
			return place;
		},
	};
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

export function mapAddressComponents(place: PlacesPlace): PlatformAddress {
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
		latitude: place.location?.latitude ?? 0,
		longitude: place.location?.longitude ?? 0,
	};
}

function mapAutocompleteRequest(
	params: PlaceSearchRequest,
): PlacesAutocompleteRequest {
	const request: PlacesAutocompleteRequest = {
		input: params.input,
		languageCode: params.language,
		regionCode: params.region,
	};

	if (params.origin) {
		request.origin = {
			latitude: params.origin.lat,
			longitude: params.origin.lng,
		};
	}

	if (params.types) {
		request.includedPrimaryTypes = [...params.types];
	}

	return request;
}

export async function placeSearch(
	params: PlaceSearchRequest,
	deps: PlaceSearchDependencies = defaultPlaceSearchDeps(),
): Promise<PlaceSearchResponse> {
	const autocompleteResponse = await deps.runAutocomplete(
		mapAutocompleteRequest(params),
	);
	const placeIds = (autocompleteResponse.suggestions ?? [])
		.map((suggestion) => suggestion.placePrediction?.placeId ?? null)
		.filter((placeId): placeId is string => placeId !== null);

	return Promise.all(
		placeIds.map(async (placeId) => {
			const place = await deps.getPlaceDetails(placeId);
			return {
				id: place.id ?? placeId,
				...mapAddressComponents(place),
			};
		}),
	);
}
