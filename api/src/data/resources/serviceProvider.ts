import type { DATA_EVY_ServiceProvider } from "evy-types";
import { validateDataEvyServiceProvider } from "evy-types/validators";
import { serviceProvider } from "../../../../types/generated/ts/db/schema.generated";
import { makeCoreResource } from "./coreResource";

const providerResource = makeCoreResource<DATA_EVY_ServiceProvider>({
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
	}),
});

export const listProviderRows = providerResource.list;
export const createProviderResource = providerResource.create;
export const updateProviderResource = providerResource.update;
