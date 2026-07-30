import type { DATA_EVY_Organization } from "evy-types";
import { organization } from "evy-types/db/schema.generated";
import { validateDataEvyOrganization } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

export const organizationsResource = makeCoreResource<DATA_EVY_Organization>({
	table: organization,
	validate: validateDataEvyOrganization,
	toUpdateSet: (validated) => ({
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		support_email: validated.support_email,
		visibility: validated.visibility,
	}),
});
