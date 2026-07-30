import type { DATA_EVY_Service } from "evy-types";
import { service } from "evy-types/db/schema.generated";
import { isValidServiceSlug } from "evy-types/resourceRef";
import { validateDataEvyService } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

function mapServiceRow(r: typeof service.$inferSelect): DATA_EVY_Service {
	return {
		id: r.id,
		name: r.name,
		description: r.description,
		...(r.sort_order !== null ? { sort_order: r.sort_order } : {}),
		created_at: r.created_at,
		updated_at: r.updated_at,
		visibility: r.visibility,
	};
}

function assertValidServiceSlug(id: string): void {
	if (!isValidServiceSlug(id)) {
		throw new Error(`Invalid service slug: ${id}`);
	}
}

function validateServicePayload(raw: unknown): DATA_EVY_Service {
	const validated = validateDataEvyService(raw);
	assertValidServiceSlug(validated.id);
	return validated;
}

export const servicesResource = makeCoreResource<DATA_EVY_Service>({
	table: service,
	validate: validateServicePayload,
	toUpdateSet: (validated) => ({
		name: validated.name,
		description: validated.description,
		sort_order: validated.sort_order ?? null,
		visibility: validated.visibility,
	}),
	normalize: mapServiceRow,
});
