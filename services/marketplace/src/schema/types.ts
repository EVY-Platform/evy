/**
 * Marketplace data types. Hand-owned by this service: marketplace data shapes
 * are not part of the shared EVY contract, so they are not generated from
 * types/. Keep in sync with the sibling *.schema.json files, which are what
 * actually run at validation time.
 */

/**
 * A simple label row, shared by `selling_reasons`, `conditions`, `durations`,
 * and `areas`.
 */
export interface DATA_MARKETPLACE_Lookup {
	id: string;
	value: string;
}

/**
 * A TextSelect writes its state as text, so this is the string "true" or "false" rather than a boolean. SDUI compares it with an unquoted literal (`{x.payment_cash == true}`), which matches the string.
 */
export type DraftFlag = "true" | "false";
/**
 * An InlinePicker whose tap action selects `$datum` stores the chosen rows' ids, not the rows.
 */
export type DraftIdList = string[];
/**
 * Local ISO datetime strings, e.g. 2026-06-03T09:00:00.
 */
export type TimeslotList = string[];
/**
 * Millimetres or milligrams, as a number or as typed text.
 */
export type Measurement = number | string;

/**
 * Currency amount. Both keys are optional: an unset fee persists as {}. `value` may be a number (seeded data) or a string (destination object templates write the user's typed text).
 */
export interface Price {
	currency?: string;
	value?: number | string;
}

/**
 * A marketplace listing. Fields are typed but optional, and additional properties are allowed: the create flow merges flat draft fields into a new item, so a freshly created item is shaped differently from a seeded one. This schema therefore constrains the type of every field it knows about without asserting which fields must be present. The flat draft fields are typed from what the create flow actually persists - text inputs and text selects write strings (including "true"/"false"), and inline pickers write arrays of bare ids.
 */
export interface DATA_MARKETPLACE_Item {
	id: string;
	title?: string;
	description?: string;
	seller_id?: string;
	created_at?: string;
	condition_id?: string;
	selling_reason_id?: string;
	photo_ids?: string[];
	/** Listing price when present; schema rejects value <= 0 (TS Price type is shared with delivery fees). */
	price?: Price;
	payment_cash?: DraftFlag;
	payment_app?: DraftFlag;
	delivery_fee?: string;
	shipping_fee?: string;
	shipping_source_postal_code?: string;
	distance?: DraftIdList;
	shipping_destination_areas?: DraftIdList;
	pickup_selection?: TimeslotList;
	delivery_selection?: TimeslotList;
	dimensions?: {
		width?: Measurement;
		height?: Measurement;
		length?: Measurement;
		weight?: Measurement;
	};
	payment_methods?: {
		cash?: boolean;
		app?: boolean;
	};
	transfer_options?: {
		pickup?: {
			selection?: TimeslotList;
			lead_time_hours?: string;
			address_id?: string;
		};
		delivery?: {
			selection?: TimeslotList;
			fee?: Price;
		};
		ship?: {
			postal_code?: string;
			areas?: {
				id?: string;
				value?: string;
			}[];
		};
	};
	[k: string]: unknown;
}
