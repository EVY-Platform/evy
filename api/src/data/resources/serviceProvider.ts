import type { DATA_EVY_ServiceProvider } from "evy-types";
import { validateDataEvyServiceProvider } from "evy-types/validators";

import { serviceProvider } from "../../../../types/generated/ts/db/schema.generated";
import type { ResourceEntityConfig } from "./resourceEntity";

export const providerResourceConfig: ResourceEntityConfig<DATA_EVY_ServiceProvider> =
	{
		table: serviceProvider,
		validate: validateDataEvyServiceProvider,
		toUpdateSet: (validated, nowIso) => ({
			fkServiceId: validated.fkServiceId,
			fkOrganizationId: validated.fkOrganizationId,
			name: validated.name,
			description: validated.description,
			logo: validated.logo,
			url: validated.url,
			retired: validated.retired,
			updatedAt: nowIso,
		}),
		toInsertValues: (validated, nowIso, filterId) => ({
			id: filterId ?? validated.id,
			fkServiceId: validated.fkServiceId,
			fkOrganizationId: validated.fkOrganizationId,
			name: validated.name,
			description: validated.description,
			logo: validated.logo,
			url: validated.url,
			createdAt: validated.createdAt,
			updatedAt: nowIso,
			retired: validated.retired,
		}),
		mapRow: (row) => row,
	};
