/** Canonical Rothschild Avenue seed address shared by API mocks and tests. */
export const ROTHCHILD_CANONICAL_ADDRESS = {
	id: "ChIJRothschild",
	unit: "C509",
	street: "28 Rothschild Avenue",
	city: "Rosebery",
	postcode: "2018",
	state: "NSW",
	country: "Australia",
	latitude: -33.9172075,
	longitude: 151.1985883,
	instructions: "",
} as const;

/** Buyer destination embedded in delivery/shipping message `data`. */
export const MESSAGE_DESTINATION_ADDRESS = {
	unit: ROTHCHILD_CANONICAL_ADDRESS.unit,
	street: ROTHCHILD_CANONICAL_ADDRESS.street,
	city: ROTHCHILD_CANONICAL_ADDRESS.city,
	postcode: ROTHCHILD_CANONICAL_ADDRESS.postcode,
	state: ROTHCHILD_CANONICAL_ADDRESS.state,
	country: ROTHCHILD_CANONICAL_ADDRESS.country,
	latitude: ROTHCHILD_CANONICAL_ADDRESS.latitude,
	longitude: ROTHCHILD_CANONICAL_ADDRESS.longitude,
} as const;

/** Full `evy.addresses` row for Amazing Fridge pickup — embedded in accept `pickup_address`. */
export const SEEDED_AMAZING_FRIDGE_PICKUP_ADDRESS_ROW = {
	id: "c81e85dd-f7fb-4310-8fc6-7c018aeaf82a",
	unit: "C509",
	street: "28 Rothschild Avenue",
	city: "Rosebery",
	postcode: "2018",
	state: "NSW",
	country: "Australia",
	latitude: -33.9172075,
	longitude: 151.1985883,
	instructions: "",
	visibility: "private",
	created_at: "2026-05-20T22:56:17.000Z",
	updated_at: "2026-05-20T22:56:17.000Z",
} as const;

/** Full `evy.addresses` row for the second seeded item — embedded in accept `pickup_address`. */
export const SEEDED_MARTIN_PLACE_PICKUP_ADDRESS_ROW = {
	id: "9d04047d-cd13-4dc6-82e6-85a3e4ef0d6b",
	street: "1 Martin Place",
	city: "Sydney",
	postcode: "2000",
	state: "NSW",
	country: "Australia",
	latitude: -33.867787,
	longitude: 151.209503,
	instructions: "",
	visibility: "private",
	created_at: "2026-05-22T22:56:17.000Z",
	updated_at: "2026-05-22T22:56:17.000Z",
} as const;
