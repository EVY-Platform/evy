import type { DATA_EVY_ServiceResource } from "evy-types";
import { serviceResource } from "evy-types/db/schema.generated";
import { validateDataEvyServiceResource } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

const serviceResourceModule = makeCoreResource<DATA_EVY_ServiceResource>({
	table: serviceResource,
	validate: validateDataEvyServiceResource,
	toUpdateSet: (validated) => ({
		fkServiceId: validated.fkServiceId,
		name: validated.name,
	}),
});

export const listServiceResourceRows = serviceResourceModule.list;
export const createServiceResourceRow = serviceResourceModule.create;
export const updateServiceResourceRow = serviceResourceModule.update;
