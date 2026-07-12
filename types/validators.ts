/**
 * Runtime JSON Schema validation (ajv) for shared EVY types.
 * Source of truth: types/schema/*.schema.json
 *
 * Schemas are split into two lazy-loaded bundles so importing request validation
 * does not compile data-row / SDUI validators (and vice versa).
 */

import { posix } from "node:path";
import type { ErrorObject, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import type {
	DATA_EVY_File,
	DATA_EVY_Flow,
	DATA_EVY_Organization,
	DATA_EVY_Page,
	DATA_EVY_Row,
	DATA_EVY_Service,
	DATA_EVY_ServiceProvider,
	DATA_EVY_ServiceResource,
} from "./generated/ts/data/data";
import type { DATA_MARKETPLACE_Request } from "./generated/ts/data/request";
import type {
	FileUploadChunkMetadata,
	FileWithBinary,
} from "./generated/ts/files/file";
import type { ApiRequest } from "./generated/ts/rpc/api.request";
import type { CreateRequest } from "./generated/ts/rpc/create.request";
import type { CreateResponse } from "./generated/ts/rpc/create.response";
import type { DeleteRequest } from "./generated/ts/rpc/delete.request";
import type { DeleteResponse } from "./generated/ts/rpc/delete.response";
import type { GetRequest } from "./generated/ts/rpc/get.request";
import type { GetResponse } from "./generated/ts/rpc/get.response";
import type { PlaceSearchRequest } from "./generated/ts/rpc/placeSearch.request";
import type { PlaceSearchResponse } from "./generated/ts/rpc/placeSearch.response";
import type { SyncRequest } from "./generated/ts/rpc/sync.request";
import type { SyncResponse } from "./generated/ts/rpc/sync.response";
import type { UpdateRequest } from "./generated/ts/rpc/update.request";
import type { UpdateResponse } from "./generated/ts/rpc/update.response";
import { SDUI_DEFINITIONS } from "./generated/ts/sdui/definitions.generated";
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
import requestSchemaRaw from "./schema/data/request.schema.json" with {
	type: "json",
};
import fileSchemaRaw from "./schema/files/file.schema.json" with {
	type: "json",
};
import apiRequestRaw from "./schema/rpc/api.request.schema.json" with {
	type: "json",
};
import createRequestRaw from "./schema/rpc/create.request.schema.json" with {
	type: "json",
};
import createResponseRaw from "./schema/rpc/create.response.schema.json" with {
	type: "json",
};
import deleteRequestRaw from "./schema/rpc/delete.request.schema.json" with {
	type: "json",
};
import deleteResponseRaw from "./schema/rpc/delete.response.schema.json" with {
	type: "json",
};
import getRequestRaw from "./schema/rpc/get.request.schema.json" with {
	type: "json",
};
import getResponseRaw from "./schema/rpc/get.response.schema.json" with {
	type: "json",
};
import placeSearchRequestRaw from "./schema/rpc/placeSearch.request.schema.json" with {
	type: "json",
};
import placeSearchResponseRaw from "./schema/rpc/placeSearch.response.schema.json" with {
	type: "json",
};
import syncRequestRaw from "./schema/rpc/sync.request.schema.json" with {
	type: "json",
};
import syncResponseRaw from "./schema/rpc/sync.response.schema.json" with {
	type: "json",
};
import updateRequestRaw from "./schema/rpc/update.request.schema.json" with {
	type: "json",
};
import updateResponseRaw from "./schema/rpc/update.response.schema.json" with {
	type: "json",
};
import sduiActionRaw from "./schema/sdui/action.schema.json" with {
	type: "json",
};
import evySduiRaw from "./schema/sdui/evy.schema.json" with { type: "json" };

/** Canonical base URI for ajv $ref resolution */
const SCHEMA_BASE = "https://evy.local";

/**
 * Derived from SDUI_DEFINITIONS so new row types register automatically.
 * Each definition schema embeds its own $id (e.g. "sdui/definitions/Button"),
 * which maps directly to the relative path key used for $ref resolution.
 */
const SDUI_DEFINITION_SCHEMAS: Record<
	string,
	Record<string, unknown>
> = Object.fromEntries(
	Object.values(SDUI_DEFINITIONS).map((schema) => {
		const s = schema as Record<string, unknown>;
		const id = s.$id;
		if (typeof id !== "string") {
			throw new Error("validators: SDUI definition schema missing $id");
		}
		return [`${id}.schema.json`, s];
	}),
);

const RAW_SCHEMAS: Record<string, Record<string, unknown>> = {
	"common/json.schema.json": commonJsonRaw as Record<string, unknown>,
	"common/rpc.schema.json": commonRpcRaw as Record<string, unknown>,
	"data/data.schema.json": dataSchemaRaw as Record<string, unknown>,
	"data/primitive.schema.json": primitiveSchemaRaw as Record<string, unknown>,
	"data/request.schema.json": requestSchemaRaw as Record<string, unknown>,
	"sdui/action.schema.json": sduiActionRaw as Record<string, unknown>,
	...SDUI_DEFINITION_SCHEMAS,
	"sdui/evy.schema.json": evySduiRaw as Record<string, unknown>,
	"files/file.schema.json": fileSchemaRaw as Record<string, unknown>,
	"rpc/placeSearch.request.schema.json": placeSearchRequestRaw as Record<
		string,
		unknown
	>,
	"rpc/placeSearch.response.schema.json": placeSearchResponseRaw as Record<
		string,
		unknown
	>,
	"rpc/api.request.schema.json": apiRequestRaw as Record<string, unknown>,
	"rpc/get.request.schema.json": getRequestRaw as Record<string, unknown>,
	"rpc/create.request.schema.json": createRequestRaw as Record<
		string,
		unknown
	>,
	"rpc/create.response.schema.json": createResponseRaw as Record<
		string,
		unknown
	>,
	"rpc/update.request.schema.json": updateRequestRaw as Record<
		string,
		unknown
	>,
	"rpc/update.response.schema.json": updateResponseRaw as Record<
		string,
		unknown
	>,
	"rpc/delete.request.schema.json": deleteRequestRaw as Record<
		string,
		unknown
	>,
	"rpc/delete.response.schema.json": deleteResponseRaw as Record<
		string,
		unknown
	>,
	"rpc/sync.request.schema.json": syncRequestRaw as Record<string, unknown>,
	"rpc/sync.response.schema.json": syncResponseRaw as Record<string, unknown>,
	"rpc/get.response.schema.json": getResponseRaw as Record<string, unknown>,
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

function lazyValidator<T>(
	ajvGetter: () => InstanceType<typeof Ajv2020>,
	uri: string,
): () => ValidateFunction<T> {
	let cached: ValidateFunction<T> | null = null;
	return () => {
		if (!cached) cached = compileRoot<T>(ajvGetter(), uri);
		return cached;
	};
}

const REQUEST_SCHEMA_FILES = [
	"common/json.schema.json",
	"common/rpc.schema.json",
	"files/file.schema.json",
	"rpc/api.request.schema.json",
	"rpc/get.request.schema.json",
	"rpc/create.request.schema.json",
	"rpc/update.request.schema.json",
	"rpc/delete.request.schema.json",
	"rpc/sync.request.schema.json",
	"rpc/placeSearch.request.schema.json",
] as const;

/** data.schema references SDUI for DATA_EVY_Flow; register both in one instance */
const ENTITY_SCHEMA_FILES = [
	"common/json.schema.json",
	"common/rpc.schema.json",
	"data/data.schema.json",
	"data/primitive.schema.json",
	"data/request.schema.json",
	"sdui/action.schema.json",
	...Object.keys(SDUI_DEFINITION_SCHEMAS).sort(),
	"sdui/evy.schema.json",
	"files/file.schema.json",
	"rpc/get.response.schema.json",
	"rpc/create.response.schema.json",
	"rpc/update.response.schema.json",
	"rpc/delete.response.schema.json",
	"rpc/sync.response.schema.json",
	"rpc/placeSearch.response.schema.json",
];

let requestAjv: InstanceType<typeof Ajv2020> | null = null;
let entityAjv: InstanceType<typeof Ajv2020> | null = null;

function addAjvFormats(ajv: InstanceType<typeof Ajv2020>): void {
	addFormats(ajv as unknown as Parameters<typeof addFormats>[0]);
}

function getRequestAjv(): InstanceType<typeof Ajv2020> {
	if (!requestAjv) {
		const ajv = new Ajv2020({
			allErrors: true,
			strict: false,
		});
		addAjvFormats(ajv);
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
		addAjvFormats(ajv);
		for (const f of ENTITY_SCHEMA_FILES) {
			ajv.addSchema(getPrepared(f));
		}
		entityAjv = ajv;
	}
	return entityAjv;
}

const getValidateApiRequest = lazyValidator<ApiRequest>(
	getRequestAjv,
	fileId("rpc/api.request.schema.json"),
);
const getValidateCreateRequest = lazyValidator<CreateRequest>(
	getRequestAjv,
	fileId("rpc/create.request.schema.json"),
);
const getValidateUpdateRequest = lazyValidator<UpdateRequest>(
	getRequestAjv,
	fileId("rpc/update.request.schema.json"),
);
const getValidateDeleteRequest = lazyValidator<DeleteRequest>(
	getRequestAjv,
	fileId("rpc/delete.request.schema.json"),
);
const getValidateCreateDataPayload = lazyValidator<CreateRequest["data"]>(
	getRequestAjv,
	`${fileId("rpc/create.request.schema.json")}#/$defs/CreateDataPayload`,
);
const getValidateUpdateDataPayload = lazyValidator<UpdateRequest["data"]>(
	getRequestAjv,
	`${fileId("rpc/update.request.schema.json")}#/$defs/UpdateDataPayload`,
);
const getValidateGetRequest = lazyValidator<GetRequest>(
	getRequestAjv,
	fileId("rpc/get.request.schema.json"),
);
const getValidateUiFlow = lazyValidator<UI_Flow>(
	getEntityAjv,
	fileId("sdui/evy.schema.json"),
);
const getValidateMarketplaceRequest = lazyValidator<DATA_MARKETPLACE_Request>(
	getEntityAjv,
	fileId("data/request.schema.json"),
);
const getValidateDataEvyFlow = lazyValidator<DATA_EVY_Flow>(
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Flow`,
);
const getValidateDataEvyPage = lazyValidator<DATA_EVY_Page>(
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Page`,
);
const getValidateDataEvyRow = lazyValidator<DATA_EVY_Row>(
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Row`,
);
const getValidateDataEvyService = lazyValidator<DATA_EVY_Service>(
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Service`,
);
const getValidateDataEvyOrganization = lazyValidator<DATA_EVY_Organization>(
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Organization`,
);
const getValidateDataEvyServiceProvider =
	lazyValidator<DATA_EVY_ServiceProvider>(
		getEntityAjv,
		`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_ServiceProvider`,
	);
const getValidateDataEvyServiceResource =
	lazyValidator<DATA_EVY_ServiceResource>(
		getEntityAjv,
		`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_ServiceResource`,
	);
const getValidateDataEvyFile = lazyValidator<DATA_EVY_File>(
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_File`,
);
const getValidateGetResponse = lazyValidator<GetResponse>(
	getEntityAjv,
	fileId("rpc/get.response.schema.json"),
);
const getValidateCreateResponse = lazyValidator<CreateResponse>(
	getEntityAjv,
	fileId("rpc/create.response.schema.json"),
);
const getValidateUpdateResponse = lazyValidator<UpdateResponse>(
	getEntityAjv,
	fileId("rpc/update.response.schema.json"),
);
const getValidateDeleteResponse = lazyValidator<DeleteResponse>(
	getEntityAjv,
	fileId("rpc/delete.response.schema.json"),
);
const getValidateSyncRequest = lazyValidator<SyncRequest>(
	getRequestAjv,
	fileId("rpc/sync.request.schema.json"),
);
const getValidateSyncResponse = lazyValidator<SyncResponse>(
	getEntityAjv,
	fileId("rpc/sync.response.schema.json"),
);
const getValidatePlaceSearchRequest = lazyValidator<PlaceSearchRequest>(
	getRequestAjv,
	fileId("rpc/placeSearch.request.schema.json"),
);
const getValidatePlaceSearchResponse = lazyValidator<PlaceSearchResponse>(
	getEntityAjv,
	fileId("rpc/placeSearch.response.schema.json"),
);

const getValidateFileUploadChunkMetadata =
	lazyValidator<FileUploadChunkMetadata>(
		getRequestAjv,
		`${fileId("files/file.schema.json")}#/$defs/FileUploadChunkMetadata`,
	);
const getValidateFileWithBinary = lazyValidator<FileWithBinary>(
	getEntityAjv,
	`${fileId("files/file.schema.json")}#/$defs/FileWithBinary`,
);
function makeValidator<T>(
	label: string,
	getter: () => ValidateFunction<T>,
): (data: unknown) => T {
	return (data: unknown): T => {
		assertValid(label, getter(), data);
		return data;
	};
}

export const validateApiRequest = makeValidator<ApiRequest>(
	"ApiRequest",
	getValidateApiRequest,
);
export const validateCreateRequest = makeValidator<CreateRequest>(
	"CreateRequest",
	getValidateCreateRequest,
);
export const validateUpdateRequest = makeValidator<UpdateRequest>(
	"UpdateRequest",
	getValidateUpdateRequest,
);
export const validateDeleteRequest = makeValidator<DeleteRequest>(
	"DeleteRequest",
	getValidateDeleteRequest,
);
export const validateCreateDataPayload = makeValidator<CreateRequest["data"]>(
	"Create data",
	getValidateCreateDataPayload,
);
export const validateUpdateDataPayload = makeValidator<UpdateRequest["data"]>(
	"Update data",
	getValidateUpdateDataPayload,
);
export const validateGetRequest = makeValidator<GetRequest>(
	"GetRequest",
	getValidateGetRequest,
);

/** Human-oriented label for API errors (matches prior `validation.ts` wrappers). */
export const validateUiFlow = makeValidator<UI_Flow>("Flow", getValidateUiFlow);
export const validateMarketplaceRequest =
	makeValidator<DATA_MARKETPLACE_Request>(
		"Marketplace request",
		getValidateMarketplaceRequest,
	);
export const validateDataEvyFlow = makeValidator<DATA_EVY_Flow>(
	"Flow",
	getValidateDataEvyFlow,
);
export const validateDataEvyPage = makeValidator<DATA_EVY_Page>(
	"Page",
	getValidateDataEvyPage,
);
export const validateDataEvyRow = makeValidator<DATA_EVY_Row>(
	"Row",
	getValidateDataEvyRow,
);
export const validateDataEvyService = makeValidator<DATA_EVY_Service>(
	"Service",
	getValidateDataEvyService,
);
export const validateDataEvyOrganization = makeValidator<DATA_EVY_Organization>(
	"Organization",
	getValidateDataEvyOrganization,
);
export const validateDataEvyServiceProvider =
	makeValidator<DATA_EVY_ServiceProvider>(
		"ServiceProvider",
		getValidateDataEvyServiceProvider,
	);
export const validateDataEvyServiceResource =
	makeValidator<DATA_EVY_ServiceResource>(
		"ServiceResource",
		getValidateDataEvyServiceResource,
	);
export const validateDataEvyFile = makeValidator<DATA_EVY_File>(
	"File",
	getValidateDataEvyFile,
);
export const validateGetResponse = makeValidator<GetResponse>(
	"GetResponse",
	getValidateGetResponse,
);
export const validateCreateResponse = makeValidator<CreateResponse>(
	"CreateResponse",
	getValidateCreateResponse,
);
export const validateUpdateResponse = makeValidator<UpdateResponse>(
	"UpdateResponse",
	getValidateUpdateResponse,
);
export const validateDeleteResponse = makeValidator<DeleteResponse>(
	"DeleteResponse",
	getValidateDeleteResponse,
);
export const validateSync = makeValidator<SyncRequest>(
	"SyncRequest",
	getValidateSyncRequest,
);
export const validateSyncResponse = makeValidator<SyncResponse>(
	"SyncResponse",
	getValidateSyncResponse,
);
export const validatePlaceSearchRequest = makeValidator<PlaceSearchRequest>(
	"PlaceSearchRequest",
	getValidatePlaceSearchRequest,
);
export const validatePlaceSearchResponse = makeValidator<PlaceSearchResponse>(
	"PlaceSearchResponse",
	getValidatePlaceSearchResponse,
);
export const validateFileUploadChunkMetadata =
	makeValidator<FileUploadChunkMetadata>(
		"FileUploadChunkMetadata",
		getValidateFileUploadChunkMetadata,
	);
export const validateFileWithBinary = makeValidator<FileWithBinary>(
	"FileWithBinary",
	getValidateFileWithBinary,
);

function isIsoDateTimeFieldName(key: string): boolean {
	return key === "createdAt" || key === "updatedAt";
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
			if (typeof child !== "string") {
				throwDataIsoValidationError(
					path,
					"date-time field must be an ISO 8601 string",
				);
			}
			if (Number.isNaN(Date.parse(child))) {
				throwDataIsoValidationError(
					path,
					"expected ISO 8601 date-time string",
				);
			}
		}
		assertIsoDateTimeJsonFields(child, path);
	}
}
