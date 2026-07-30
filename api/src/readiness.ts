import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";
import { runReadinessCli } from "evy-types/readiness";
import * as data from "./data/data";
import { createDb, type EvyDb } from "./database/db";
import {
	forwardResources,
	resolveServiceWsEndpoint,
} from "./procedures/services";

/**
 * Services named here must have a resolvable endpoint for the API to be ready.
 * Everything else only warns: one misconfigured optional service should not
 * take the whole gateway out of rotation.
 */
function requiredServiceNames(): Set<string> {
	return new Set(
		(process.env.REQUIRED_SERVICES ?? "")
			.split(",")
			.map((name) => name.trim().toLowerCase())
			.filter(Boolean),
	);
}

// exported for tests
export async function assertApiReadable(
	db: EvyDb,
	requireSeeded: boolean,
): Promise<void> {
	const externalServices = await data.listExternalServices(db);
	const required = requiredServiceNames();

	for (const svc of externalServices) {
		try {
			resolveServiceWsEndpoint(svc);
		} catch (error) {
			const detail =
				error instanceof Error ? error.message : String(error);
			if (required.has(svc.name.toLowerCase())) {
				throw new Error(`API readiness failed: ${detail}`);
			}
			console.warn(`API readiness degraded: ${detail}`);
		}

		if (!required.has(svc.name.toLowerCase())) {
			continue;
		}

		try {
			const manifest = await forwardResources(svc.id);
			const descriptor = manifest.services.find(
				(service) => service.id === svc.id,
			);
			if (!descriptor) {
				throw new Error(
					`service "${svc.name}" did not include itself in resources`,
				);
			}
		} catch (error) {
			const detail =
				error instanceof Error ? error.message : String(error);
			throw new Error(`API readiness failed: ${detail}`);
		}
	}

	const response = await data.get(db, {
		resource: EVY_CORE_RESOURCE_REF.FLOWS,
	});
	if (!Array.isArray(response)) {
		throw new Error(
			"API readiness failed: expected flows response data array",
		);
	}

	if (!requireSeeded) {
		return;
	}

	if (response.length === 0) {
		throw new Error("Seed verification failed: missing seeded flows");
	}
}

export function runHealthCli(): Promise<void> {
	const db = createDb();
	return runReadinessCli({
		label: "API",
		assertReadable: (requireSeeded) => assertApiReadable(db, requireSeeded),
	});
}
