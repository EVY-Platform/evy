import type { DATA_EVY_Organization } from "evy-types";
import { organization } from "evy-types/db/schema.generated";
import { validateDataEvyOrganization } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

export const organisationsResource = makeCoreResource<DATA_EVY_Organization>({
	table: organization,
	validate: validateDataEvyOrganization,
	toUpdateSet: (validated) => ({
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		supportEmail: validated.supportEmail,
		visibility: validated.visibility,
	}),
});
