import type { DATA_EVY_Address } from "evy-types";
import { address } from "evy-types/db/schema.generated";
import { validateDataEvyAddress } from "evy-types/validators";
import { makeCoreResource, omitNulls } from "./coreResource";

function omitNullOptionalFields(
	rowData: typeof address.$inferSelect,
): DATA_EVY_Address {
	return validateDataEvyAddress(omitNulls(rowData));
}

export const addressesResource = makeCoreResource<DATA_EVY_Address>({
	table: address,
	validate: validateDataEvyAddress,
	toUpdateSet: (v) => ({
		unit: v.unit,
		street: v.street,
		city: v.city,
		postcode: v.postcode,
		state: v.state,
		country: v.country,
		latitude: v.latitude,
		longitude: v.longitude,
		instructions: v.instructions,
	}),
	normalize: omitNullOptionalFields,
});
