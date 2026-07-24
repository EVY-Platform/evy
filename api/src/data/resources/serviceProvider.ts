import type { DATA_EVY_ServiceProvider } from "evy-types";
import { serviceProvider } from "evy-types/db/schema.generated";
import { validateDataEvyServiceProvider } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

export const providersResource = makeCoreResource<DATA_EVY_ServiceProvider>({
	table: serviceProvider,
	validate: validateDataEvyServiceProvider,
	toUpdateSet: (validated) => ({
		fkServiceId: validated.fkServiceId,
		fkOrganizationId: validated.fkOrganizationId,
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		retired: validated.retired,
		visibility: validated.visibility,
	}),
});
