import type { DATA_EVY_ServiceResource } from "evy-types";
import { serviceResource } from "evy-types/db/schema.generated";
import { validateDataEvyServiceResource } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

export const serviceResourcesResource =
	makeCoreResource<DATA_EVY_ServiceResource>({
		table: serviceResource,
		validate: validateDataEvyServiceResource,
		toUpdateSet: (validated) => ({
			fkServiceId: validated.fkServiceId,
			name: validated.name,
			visibility: validated.visibility,
		}),
	});
