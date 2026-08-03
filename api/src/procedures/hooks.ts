import type {
	CreateRequest,
	CreateResponse,
	DATA_EVY_Message,
} from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { serviceOfRef } from "evy-types/resourceRef";
import { create as createCore } from "../data/data";
import type { EvyDb } from "../database/db";
import { derivedMessageData } from "./paymentsShared";
import { forwardHook } from "./services";

class HookVetoError extends Error {
	readonly vetoReason: string;

	constructor(target: string, resource: string, reason: string) {
		super(`Service "${target}" rejected ${resource} create: ${reason}`);
		this.name = "HookVetoError";
		this.vetoReason = reason;
	}
}

const HOOKED_CORE_RESOURCE_REFS = new Set<string>([
	EVY_CORE_RESOURCE_REF.MESSAGES,
	EVY_CORE_RESOURCE_REF.TRANSACTIONS,
]);

function resolveHookTarget(resource: string, data: unknown): string | null {
	if (!HOOKED_CORE_RESOURCE_REFS.has(resource)) return null;
	if (data === null || typeof data !== "object") return null;
	const record = data as Record<string, unknown>;
	const ref = record.resource;
	if (typeof ref !== "string") return null;
	try {
		const target = serviceOfRef(ref);
		if (target === EVY_CORE_SERVICE) return null;
		return target;
	} catch {
		return null;
	}
}

async function runBeforeCreateHook(
	resource: string,
	data: unknown,
): Promise<void> {
	const target = resolveHookTarget(resource, data);
	if (!target) return;

	const response = await forwardHook(target, {
		hook: "before_create",
		resource,
		data: data as CreateRequest["data"],
	});
	if (!response) return;
	if (!response.ok) {
		throw new HookVetoError(
			target,
			resource,
			response.reason ?? "no reason given",
		);
	}
}

async function runAfterCreateHook(
	resource: string,
	row: unknown,
): Promise<void> {
	const target = resolveHookTarget(resource, row);
	if (!target) return;

	try {
		await forwardHook(target, {
			hook: "after_create",
			resource,
			data: row as CreateRequest["data"],
		});
	} catch (error) {
		console.error(
			`after_create hook failed for ${resource} on service "${target}":`,
			error,
		);
	}
}

async function authorRequestFailedOnVeto(
	db: EvyDb,
	params: CreateRequest,
	error: unknown,
): Promise<void> {
	if (params.resource !== EVY_CORE_RESOURCE_REF.MESSAGES) {
		return;
	}
	const data = params.data;
	if (data === null || typeof data !== "object") {
		return;
	}
	const messageData = data as Record<string, unknown>;
	if (messageData.value === "request_failed") {
		return;
	}

	const reason =
		error instanceof HookVetoError
			? error.vetoReason
			: error instanceof Error
				? error.message
				: "create vetoed";

	try {
		const message = messageData as DATA_EVY_Message;
		await createCore(db, {
			resource: EVY_CORE_RESOURCE_REF.MESSAGES,
			data: derivedMessageData(message, {
				value: "request_failed",
				data: { reason },
				visibility: message.visibility,
			}),
		});
	} catch (authorError) {
		console.error("Failed to author request_failed message:", authorError);
	}
}

export async function hookedCreate(
	db: EvyDb,
	params: CreateRequest,
): Promise<CreateResponse> {
	try {
		await runBeforeCreateHook(params.resource, params.data);
	} catch (error) {
		await authorRequestFailedOnVeto(db, params, error);
		throw error;
	}
	const response = await createCore(db, params);
	await runAfterCreateHook(params.resource, response);
	return response;
}
