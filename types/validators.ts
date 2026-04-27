/**
 * Runtime JSON Schema validation (ajv) for shared EVY types.
 * Source of truth: types/schema/*.schema.json
 *
 * Schemas are split into two lazy-loaded bundles so importing request validation
 * does not compile data-row / SDUI validators (and vice versa).
 */
import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { posix } from "node:path";

import type {
	DATA_EVY_Organization,
	DATA_EVY_Service,
	DATA_EVY_ServiceProvider,
} from "./generated/ts/data/data";
import type { DATA_PRIMITIVE } from "./generated/ts/data/primitive";
import type { GetRequest } from "./generated/ts/rpc/get.request";
import type { GetResponse } from "./generated/ts/rpc/get.response";
import type { SyncServiceDataRequest } from "./generated/ts/rpc/syncServiceData.request";
import type { SyncServiceDataResponse } from "./generated/ts/rpc/syncServiceData.response";
import type { UpsertRequest } from "./generated/ts/rpc/upsert.request";
import type { UpsertResponse } from "./generated/ts/rpc/upsert.response";
import type { UI_Flow } from "./generated/ts/sdui/evy";

import commonJsonRaw from "./schema/common/json.schema.json" with {
	type: "json",
};
import commonRpcRaw from "./schema/common/rpc.schema.json" with {
	type: "json",
};
import dataSchemaRaw from "./schema/data/data.schema.json" with {
	type: "json",
};
import primitiveSchemaRaw from "./schema/data/primitive.schema.json" with {
	type: "json",
};
import evySduiRaw from "./schema/sdui/evy.schema.json" with { type: "json" };
import getRequestRaw from "./schema/rpc/get.request.schema.json" with {
	type: "json",
};
import upsertRequestRaw from "./schema/rpc/upsert.request.schema.json" with {
	type: "json",
};
import syncServiceDataRequestRaw from "./schema/rpc/syncServiceData.request.schema.json" with {
	type: "json",
};
import getResponseRaw from "./schema/rpc/get.response.schema.json" with {
	type: "json",
};
import upsertResponseRaw from "./schema/rpc/upsert.response.schema.json" with {
	type: "json",
};
import syncServiceDataResponseRaw from "./schema/rpc/syncServiceData.response.schema.json" with {
	type: "json",
};

/** Canonical base URI for ajv $ref resolution */
const SCHEMA_BASE = "https://evy.local";

const RAW_SCHEMAS: Record<string, Record<string, unknown>> = {
	"common/json.schema.json": commonJsonRaw as Record<string, unknown>,
	"common/rpc.schema.json": commonRpcRaw as Record<string, unknown>,
	"data/data.schema.json": dataSchemaRaw as Record<string, unknown>,
	"data/primitive.schema.json": primitiveSchemaRaw as Record<string, unknown>,
	"sdui/evy.schema.json": evySduiRaw as Record<string, unknown>,
	"rpc/get.request.schema.json": getRequestRaw as Record<string, unknown>,
	"rpc/upsert.request.schema.json": upsertRequestRaw as Record<string, unknown>,
	"rpc/syncServiceData.request.schema.json":
		syncServiceDataRequestRaw as Record<string, unknown>,
	"rpc/get.response.schema.json": getResponseRaw as Record<string, unknown>,
	"rpc/upsert.response.schema.json": upsertResponseRaw as Record<
		string,
		unknown
	>,
	"rpc/syncServiceData.response.schema.json":
		syncServiceDataResponseRaw as Record<string, unknown>,
};

const preparedCache = new Map<string, Record<string, unknown>>();

function fileId(relPath: string): string {
	return `${SCHEMA_BASE}/${relPath.replace(/\\/g, "/")}`;
}

function resolveRef(currentFileRel: string, ref: string): string {
	if (ref.startsWith("http")) return ref;
	if (ref.startsWith("#")) {
		return `${fileId(currentFileRel)}${ref}`;
	}
	const hashIndex = ref.indexOf("#");
	const pathPart = hashIndex >= 0 ? ref.slice(0, hashIndex) : ref;
	const hashPart = hashIndex >= 0 ? ref.slice(hashIndex) : "";
	const dir = posix.dirname(currentFileRel.replace(/\\/g, "/"));
	const resolved = posix
		.normalize(posix.join(dir, pathPart))
		.replace(/\\/g, "/");
	return `${fileId(resolved)}${hashPart}`;
}

function rewriteRefs(node: unknown, currentFileRel: string): void {
	if (node === null || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const item of node) rewriteRefs(item, currentFileRel);
		return;
	}
	const o = node as Record<string, unknown>;
	if (typeof o.$ref === "string") {
		o.$ref = resolveRef(currentFileRel, o.$ref);
	}
	for (const v of Object.values(o)) rewriteRefs(v, currentFileRel);
}

function prepareSchema(
	relPath: string,
	raw: Record<string, unknown>,
): Record<string, unknown> {
	const cloned = structuredClone(raw) as Record<string, unknown>;
	rewriteRefs(cloned, relPath);
	cloned.$id = fileId(relPath);
	return cloned;
}

function getPrepared(relPath: string): Record<string, unknown> {
	let cached = preparedCache.get(relPath);
	if (!cached) {
		const raw = RAW_SCHEMAS[relPath];
		if (!raw) {
			throw new Error(`validators: unknown schema path ${relPath}`);
		}
		cached = prepareSchema(relPath, raw);
		preparedCache.set(relPath, cached);
	}
	return cached;
}

function formatAjvErrors(
	label: string,
	errors: ErrorObject[] | null | undefined,
): string {
	if (!errors?.length) return `${label} validation failed`;
	const parts = errors.map((e) => {
		const path = e.instancePath === "" ? "(root)" : e.instancePath;
		return `${path}: ${e.message ?? "invalid"}`;
	});
	return `${label} validation failed: ${parts.join("; ")}`;
}

function compileRoot<T>(
	instance: InstanceType<typeof Ajv2020>,
	uri: string,
): ValidateFunction<T> {
	const validate = instance.getSchema<T>(uri);
	if (!validate) {
		throw new Error(`ajv: schema not registered: ${uri}`);
	}
	return validate;
}

function assertValid<T>(
	label: string,
	validate: ValidateFunction<T>,
	data: unknown,
): asserts data is T {
	if (validate(data)) return;
	throw new Error(formatAjvErrors(label, validate.errors));
}

const REQUEST_SCHEMA_FILES = [
	"common/json.schema.json",
	"common/rpc.schema.json",
	"rpc/get.request.schema.json",
	"rpc/upsert.request.schema.json",
	"rpc/syncServiceData.request.schema.json",
] as const;

/** data.schema references SDUI for DATA_EVY_Flow; register both in one instance */
const ENTITY_SCHEMA_FILES = [
	"common/json.schema.json",
	"data/data.schema.json",
	"data/primitive.schema.json",
	"sdui/evy.schema.json",
	"rpc/get.response.schema.json",
	"rpc/upsert.response.schema.json",
	"rpc/syncServiceData.response.schema.json",
] as const;

let requestAjv: InstanceType<typeof Ajv2020> | null = null;
let entityAjv: InstanceType<typeof Ajv2020> | null = null;

function getRequestAjv(): InstanceType<typeof Ajv2020> {
	if (!requestAjv) {
		const ajv = new Ajv2020({
			allErrors: true,
			strict: false,
		});
		addFormats(ajv);
		for (const f of REQUEST_SCHEMA_FILES) {
			ajv.addSchema(getPrepared(f));
		}
		requestAjv = ajv;
	}
	return requestAjv;
}

function getEntityAjv(): InstanceType<typeof Ajv2020> {
	if (!entityAjv) {
		const ajv = new Ajv2020({
			allErrors: true,
			strict: false,
		});
		addFormats(ajv);
		for (const f of ENTITY_SCHEMA_FILES) {
			ajv.addSchema(getPrepared(f));
		}
		entityAjv = ajv;
	}
	return entityAjv;
}

let validateGetRequestFn: ValidateFunction<GetRequest> | null = null;
let validateUpsertRequestFn: ValidateFunction<UpsertRequest> | null = null;
let validateSyncServiceDataRequestFn: ValidateFunction<SyncServiceDataRequest> | null =
	null;
let validateUpsertDataPayloadFn: ValidateFunction<
	DATA_PRIMITIVE["data"]
> | null = null;
let validateUiFlowFn: ValidateFunction<UI_Flow> | null = null;
let validateDataEvyServiceFn: ValidateFunction<DATA_EVY_Service> | null = null;
let validateDataEvyOrganizationFn: ValidateFunction<DATA_EVY_Organization> | null =
	null;
let validateDataEvyServiceProviderFn: ValidateFunction<DATA_EVY_ServiceProvider> | null =
	null;
let validateGetResponseFn: ValidateFunction<GetResponse> | null = null;
let validateUpsertResponseFn: ValidateFunction<UpsertResponse> | null = null;
let validateSyncServiceDataResponseFn: ValidateFunction<SyncServiceDataResponse> | null =
	null;

function getValidateGetRequest(): ValidateFunction<GetRequest> {
	if (!validateGetRequestFn) {
		validateGetRequestFn = compileRoot<GetRequest>(
			getRequestAjv(),
			fileId("rpc/get.request.schema.json"),
		);
	}
	return validateGetRequestFn;
}

function getValidateUpsertRequest(): ValidateFunction<UpsertRequest> {
	if (!validateUpsertRequestFn) {
		validateUpsertRequestFn = compileRoot<UpsertRequest>(
			getRequestAjv(),
			fileId("rpc/upsert.request.schema.json"),
		);
	}
	return validateUpsertRequestFn;
}

function getValidateSyncServiceDataRequest(): ValidateFunction<SyncServiceDataRequest> {
	if (!validateSyncServiceDataRequestFn) {
		validateSyncServiceDataRequestFn = compileRoot<SyncServiceDataRequest>(
			getRequestAjv(),
			fileId("rpc/syncServiceData.request.schema.json"),
		);
	}
	return validateSyncServiceDataRequestFn;
}

function getValidateUpsertDataPayload(): ValidateFunction<
	DATA_PRIMITIVE["data"]
> {
	if (!validateUpsertDataPayloadFn) {
		validateUpsertDataPayloadFn = compileRoot<DATA_PRIMITIVE["data"]>(
			getRequestAjv(),
			`${fileId("rpc/upsert.request.schema.json")}#/$defs/UpsertDataPayload`,
		);
	}
	return validateUpsertDataPayloadFn;
}

function getValidateUiFlow(): ValidateFunction<UI_Flow> {
	if (!validateUiFlowFn) {
		validateUiFlowFn = compileRoot<UI_Flow>(
			getEntityAjv(),
			fileId("sdui/evy.schema.json"),
		);
	}
	return validateUiFlowFn;
}

function getValidateDataEvyService(): ValidateFunction<DATA_EVY_Service> {
	if (!validateDataEvyServiceFn) {
		validateDataEvyServiceFn = compileRoot<DATA_EVY_Service>(
			getEntityAjv(),
			`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Service`,
		);
	}
	return validateDataEvyServiceFn;
}

function getValidateDataEvyOrganization(): ValidateFunction<DATA_EVY_Organization> {
	if (!validateDataEvyOrganizationFn) {
		validateDataEvyOrganizationFn = compileRoot<DATA_EVY_Organization>(
			getEntityAjv(),
			`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Organization`,
		);
	}
	return validateDataEvyOrganizationFn;
}

function getValidateDataEvyServiceProvider(): ValidateFunction<DATA_EVY_ServiceProvider> {
	if (!validateDataEvyServiceProviderFn) {
		validateDataEvyServiceProviderFn = compileRoot<DATA_EVY_ServiceProvider>(
			getEntityAjv(),
			`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_ServiceProvider`,
		);
	}
	return validateDataEvyServiceProviderFn;
}

function getValidateGetResponse(): ValidateFunction<GetResponse> {
	if (!validateGetResponseFn) {
		validateGetResponseFn = compileRoot<GetResponse>(
			getEntityAjv(),
			fileId("rpc/get.response.schema.json"),
		);
	}
	return validateGetResponseFn;
}

function getValidateUpsertResponse(): ValidateFunction<UpsertResponse> {
	if (!validateUpsertResponseFn) {
		validateUpsertResponseFn = compileRoot<UpsertResponse>(
			getEntityAjv(),
			fileId("rpc/upsert.response.schema.json"),
		);
	}
	return validateUpsertResponseFn;
}

function getValidateSyncServiceDataResponse(): ValidateFunction<SyncServiceDataResponse> {
	if (!validateSyncServiceDataResponseFn) {
		validateSyncServiceDataResponseFn = compileRoot<SyncServiceDataResponse>(
			getEntityAjv(),
			fileId("rpc/syncServiceData.response.schema.json"),
		);
	}
	return validateSyncServiceDataResponseFn;
}

export function validateGetRequest(data: unknown): GetRequest {
	assertValid("GetRequest", getValidateGetRequest(), data);
	return data;
}

export function validateUpsertRequest(data: unknown): UpsertRequest {
	assertValid("UpsertRequest", getValidateUpsertRequest(), data);
	return data;
}

export function validateSyncServiceDataRequest(
	data: unknown,
): SyncServiceDataRequest {
	assertValid(
		"SyncServiceDataRequest",
		getValidateSyncServiceDataRequest(),
		data,
	);
	return data;
}

/** Human-oriented label for API errors (matches prior `validation.ts` wrappers). */
export function validateUiFlow(data: unknown): UI_Flow {
	assertValid("Flow", getValidateUiFlow(), data);
	return data;
}

export function validateDataEvyService(data: unknown): DATA_EVY_Service {
	assertValid("Service", getValidateDataEvyService(), data);
	return data;
}

export function validateDataEvyOrganization(
	data: unknown,
): DATA_EVY_Organization {
	assertValid("Organization", getValidateDataEvyOrganization(), data);
	return data;
}

export function validateDataEvyServiceProvider(
	data: unknown,
): DATA_EVY_ServiceProvider {
	assertValid("ServiceProvider", getValidateDataEvyServiceProvider(), data);
	return data;
}

export function validateUpsertDataPayload(
	data: unknown,
): DATA_PRIMITIVE["data"] {
	assertValid("Upsert data", getValidateUpsertDataPayload(), data);
	return data;
}

export function validateGetResponse(data: unknown): GetResponse {
	assertValid("GetResponse", getValidateGetResponse(), data);
	return data;
}

export function validateUpsertResponse(data: unknown): UpsertResponse {
	assertValid("UpsertResponse", getValidateUpsertResponse(), data);
	return data;
}

export function validateSyncServiceDataResponse(
	data: unknown,
): SyncServiceDataResponse {
	assertValid(
		"SyncServiceDataResponse",
		getValidateSyncServiceDataResponse(),
		data,
	);
	return data;
}

function isIsoDateTimeFieldName(key: string): boolean {
	if (key.endsWith("_timestamp")) {
		return true;
	}
	if (key.length >= 3 && key.endsWith("At")) {
		return true;
	}
	return false;
}

function throwDataIsoValidationError(path: string, reason: string): never {
	throw new Error(`Data validation failed: ${path}: ${reason}`);
}

/**
 * Walks arbitrary JSON under a data payload and enforces ISO date-time strings on
 * keys matched by {@link isIsoDateTimeFieldName}. Rejects finite numbers and non-string types for those keys.
 */
export function assertIsoDateTimeJsonFields(
	value: unknown,
	pathPrefix = "",
): void {
	if (value === null || typeof value !== "object") {
		return;
	}
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index++) {
			assertIsoDateTimeJsonFields(
				value[index],
				pathPrefix ? `${pathPrefix}[${index}]` : `[${index}]`,
			);
		}
		return;
	}

	const record = value as Record<string, unknown>;
	for (const [key, child] of Object.entries(record)) {
		const path = pathPrefix ? `${pathPrefix}.${key}` : key;
		if (isIsoDateTimeFieldName(key)) {
			if (typeof child === "number" && Number.isFinite(child)) {
				throwDataIsoValidationError(
					path,
					"date-time fields must be ISO 8601 strings, not numeric timestamps",
				);
			}
			if (child === null || child === undefined) {
				throwDataIsoValidationError(
					path,
					"date-time field must be an ISO 8601 string",
				);
			}
			if (typeof child !== "string") {
				throwDataIsoValidationError(
					path,
					"date-time field must be an ISO 8601 string",
				);
			}
			if (Number.isNaN(Date.parse(child))) {
				throwDataIsoValidationError(path, "expected ISO 8601 date-time string");
			}
		}
		assertIsoDateTimeJsonFields(child, path);
	}
}
