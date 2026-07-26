import { eq } from "drizzle-orm";
import type { ResourcesResponse } from "evy-types";
import { EVY_CORE_RESOURCES, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { service } from "evy-types/db/schema.generated";
import { validateResourcesResponse } from "evy-types/validators";
import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import * as services from "./services";

function buildCoreServiceDescriptor(
	coreServiceName: string,
): ResourcesResponse["services"][number] {
	return {
		id: EVY_CORE_SERVICE,
		name: coreServiceName,
		resources: [...EVY_CORE_RESOURCES],
	};
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function discoverResources(db: EvyDb): Promise<ResourcesResponse> {
	const externalServices = await data.listExternalServices(db);
	const [coreServiceRow] = await db
		.select({ name: service.name })
		.from(service)
		.where(eq(service.id, EVY_CORE_SERVICE))
		.limit(1);
	const coreServiceName = coreServiceRow?.name ?? "evy";

	const servicesOut: ResourcesResponse["services"] = [
		buildCoreServiceDescriptor(coreServiceName),
	];
	const errors: NonNullable<ResourcesResponse["errors"]> = [];

	for (const service of externalServices) {
		if (service.id === EVY_CORE_SERVICE) continue;
		try {
			const response = await services.forwardResources(service.id);
			const serviceDescriptor = response.services.find(
				(descriptor) => descriptor.id === service.id,
			);
			if (!serviceDescriptor) {
				throw new Error(
					`Service "${service.name}" (${service.id}) did not include itself in its resources response`,
				);
			}
			servicesOut.push(serviceDescriptor);
		} catch (error) {
			errors.push({
				service: service.id,
				message: describe(error),
			});
		}
	}

	return validateResourcesResponse({
		services: servicesOut,
		...(errors.length > 0 ? { errors } : {}),
	});
}

export async function resourcesMethod(db: EvyDb): Promise<ResourcesResponse> {
	return discoverResources(db);
}
