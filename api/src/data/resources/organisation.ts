import type { DATA_EVY_Organization } from "evy-types";
import { validateDataEvyOrganization } from "evy-types/validators";

import { organization } from "../../../../types/generated/ts/db/schema.generated";
import type { ResourceEntityConfig } from "./resourceEntity";

export const organizationResourceConfig: ResourceEntityConfig<DATA_EVY_Organization> =
	{
		table: organization,
		validate: validateDataEvyOrganization,
		toUpdateSet: (validated, nowIso) => ({
			name: validated.name,
			description: validated.description,
			logo: validated.logo,
			url: validated.url,
			supportEmail: validated.supportEmail,
			updatedAt: nowIso,
		}),
		toInsertValues: (validated, nowIso, filterId) => ({
			id: filterId ?? validated.id,
			name: validated.name,
			description: validated.description,
			logo: validated.logo,
			url: validated.url,
			supportEmail: validated.supportEmail,
			createdAt: validated.createdAt,
			updatedAt: nowIso,
		}),
		mapRow: (row) => row,
	};
