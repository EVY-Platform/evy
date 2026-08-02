import type { HookRequest } from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { serviceOfRef } from "evy-types/resourceRef";
import { forwardHook } from "./services";

const HOOKED_CORE_RESOURCES: Record<
	string,
	(data: Record<string, unknown>) => string | null
> = {
	[EVY_CORE_RESOURCE_REF.MESSAGES]: (data) => {
		const ref = data.resource;
		if (typeof ref !== "string") return null;
		try {
			const target = serviceOfRef(ref);
			if (target === EVY_CORE_SERVICE) return null;
			return target;
		} catch {
			return null;
		}
	},
};

function resolveHookTarget(resource: string, data: unknown): string | null {
	const resolver = HOOKED_CORE_RESOURCES[resource];
	if (!resolver) return null;
	if (data === null || typeof data !== "object") return null;
	return resolver(data as Record<string, unknown>);
}

export async function runBeforeCreateHook(
	resource: string,
	data: unknown,
): Promise<void> {
	const target = resolveHookTarget(resource, data);
	if (!target) return;

	const response = await forwardHook(target, {
		hook: "before_create",
		resource,
		operation: "create",
		data: data as HookRequest["data"],
	});
	if (!response) return;
	if (!response.ok) {
		throw new Error(
			`Service "${target}" rejected ${resource} create: ${response.reason ?? "no reason given"}`,
		);
	}
}

export async function runAfterCreateHook(
	resource: string,
	row: unknown,
): Promise<void> {
	const target = resolveHookTarget(resource, row);
	if (!target) return;

	try {
		await forwardHook(target, {
			hook: "after_create",
			resource,
			operation: "create",
			data: row as HookRequest["data"],
		});
	} catch (error) {
		console.error(
			`after_create hook failed for ${resource} on service "${target}":`,
			error,
		);
	}
}
