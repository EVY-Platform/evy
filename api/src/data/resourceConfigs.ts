import type {
	DATA_EVY_Service,
	DATA_EVY_Organization,
	DATA_EVY_ServiceProvider,
	DATA_EVY_Image,
} from "evy-types";
import {
	validateDataEvyOrganization,
	validateDataEvyService,
	validateDataEvyServiceProvider,
	validateDataEvyImage,
} from "evy-types/validators";

import type { ResourceEntityConfig } from "./resources";
import {
	service,
	organization,
	serviceProvider,
	image,
} from "../../../types/generated/ts/db/schema.generated";

function mapServiceRow(r: typeof service.$inferSelect): DATA_EVY_Service {
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

export { mapServiceRow };

const serviceResourceConfig: ResourceEntityConfig<DATA_EVY_Service> = {
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

const organizationResourceConfig: ResourceEntityConfig<DATA_EVY_Organization> =
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

const providerResourceConfig: ResourceEntityConfig<DATA_EVY_ServiceProvider> = {
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

const imageResourceConfig: ResourceEntityConfig<DATA_EVY_Image> = {
	table: image,
	validate: validateDataEvyImage,
	toUpdateSet: (validated, nowIso) => ({
		type: validated.type,
		updatedAt: nowIso,
	}),
	toInsertValues: (validated, nowIso, filterId) => ({
		id: filterId ?? validated.id,
		type: validated.type,
		createdAt: nowIso,
		updatedAt: nowIso,
	}),
	mapRow: (row) => row,
};

export {
	serviceResourceConfig,
	organizationResourceConfig,
	providerResourceConfig,
	imageResourceConfig,
};
