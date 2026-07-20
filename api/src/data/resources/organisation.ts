import type { DATA_EVY_Organization } from "evy-types";
import { organization } from "evy-types/db/schema.generated";
import { validateDataEvyOrganization } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

const organizationResource = makeCoreResource<DATA_EVY_Organization>({
	table: organization,
	validate: validateDataEvyOrganization,
	toUpdateSet: (validated) => ({
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		supportEmail: validated.supportEmail,
	}),
});

export const listOrganizationRows = organizationResource.list;
export const createOrganizationResource = organizationResource.create;
export const updateOrganizationResource = organizationResource.update;
