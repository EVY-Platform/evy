import type { DATA_EVY_Service } from "evy-types";
import { validateDataEvyService } from "evy-types/validators";

import { service } from "../../../../types/generated/ts/db/schema.generated";
import type { ResourceEntityConfig } from "./resourceEntity";

export function mapServiceRow(
	r: typeof service.$inferSelect,
): DATA_EVY_Service {
	return {
		id: r.id,
		name: r.name,
		description: r.description,
		...(r.sortOrder !== null ? { sortOrder: r.sortOrder } : {}),
		...(r.defaultWeightKg !== null
			? { defaultWeightKg: r.defaultWeightKg }
			: {}),
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	};
}

export const serviceResourceConfig: ResourceEntityConfig<DATA_EVY_Service> = {
	table: service,
	validate: validateDataEvyService,
	toUpdateSet: (validated, nowIso) => ({
		name: validated.name,
		description: validated.description,
		sortOrder: validated.sortOrder ?? null,
		defaultWeightKg: validated.defaultWeightKg ?? null,
		updatedAt: nowIso,
	}),
	toInsertValues: (validated, nowIso, filterId) => ({
		id: filterId ?? validated.id,
		name: validated.name,
		description: validated.description,
		sortOrder: validated.sortOrder ?? null,
		defaultWeightKg: validated.defaultWeightKg ?? null,
		createdAt: validated.createdAt,
		updatedAt: nowIso,
	}),
	mapRow: (row: unknown) => mapServiceRow(row as typeof service.$inferSelect),
};
