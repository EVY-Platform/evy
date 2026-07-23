import type { DATA_EVY_Address } from "evy-types";
import { address } from "evy-types/db/schema.generated";
import { validateDataEvyAddress } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

function omitNullOptionalFields(
	rowData: typeof address.$inferSelect,
): DATA_EVY_Address {
	return validateDataEvyAddress({
		id: rowData.id,
		...(rowData.unit === null ? {} : { unit: rowData.unit }),
		...(rowData.street === null ? {} : { street: rowData.street }),
		...(rowData.city === null ? {} : { city: rowData.city }),
		...(rowData.postcode === null ? {} : { postcode: rowData.postcode }),
		...(rowData.state === null ? {} : { state: rowData.state }),
		...(rowData.country === null ? {} : { country: rowData.country }),
		...(rowData.latitude === null ? {} : { latitude: rowData.latitude }),
		...(rowData.longitude === null ? {} : { longitude: rowData.longitude }),
		...(rowData.instructions === null
			? {}
			: { instructions: rowData.instructions }),
		createdAt: rowData.createdAt,
		updatedAt: rowData.updatedAt,
	});
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
