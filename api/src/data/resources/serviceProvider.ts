import type { DATA_EVY_ServiceProvider } from "evy-types";
import { service_provider } from "evy-types/db/schema.generated";
import { validateDataEvyServiceProvider } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

export const providersResource = makeCoreResource<DATA_EVY_ServiceProvider>({
	table: service_provider,
	validate: validateDataEvyServiceProvider,
	toUpdateSet: (validated) => ({
		fk_service_id: validated.fk_service_id,
		fk_organization_id: validated.fk_organization_id,
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		retired: validated.retired,
		visibility: validated.visibility,
	}),
});
