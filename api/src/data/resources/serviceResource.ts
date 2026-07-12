import type { DATA_EVY_ServiceResource } from "evy-types";
import { validateDataEvyServiceResource } from "evy-types/validators";
import { serviceResource } from "../../../../types/generated/ts/db/schema.generated";
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
