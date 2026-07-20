import type { DATA_EVY_Service } from "evy-types";
import { service } from "evy-types/db/schema.generated";
import { validateDataEvyService } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

function mapServiceRow(r: typeof service.$inferSelect): DATA_EVY_Service {
	return {
		id: r.id,
		name: r.name,
		description: r.description,
		...(r.sortOrder !== null ? { sortOrder: r.sortOrder } : {}),
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	};
}

const serviceResource = makeCoreResource<DATA_EVY_Service>({
	table: service,
	validate: validateDataEvyService,
	toUpdateSet: (validated) => ({
		name: validated.name,
		description: validated.description,
		sortOrder: validated.sortOrder ?? null,
	}),
	normalize: mapServiceRow,
});

export const listServiceRows = serviceResource.list;
export const createServiceResource = serviceResource.create;
export const updateServiceResource = serviceResource.update;
