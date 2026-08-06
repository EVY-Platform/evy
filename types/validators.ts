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
import { parseActionExpression } from "./actionAst";
import { forEachActionBranch, submitCreateTargetFromAst } from "./flowSubmits";
import type {
	DATA_EVY_Address,
	DATA_EVY_File,
	DATA_EVY_Flow,
	DATA_EVY_Formatter,
	DATA_EVY_Message,
	DATA_EVY_Organization,
	DATA_EVY_Page,
	DATA_EVY_Row,
	DATA_EVY_Service,
	DATA_EVY_ServiceProvider,
	DATA_EVY_Transaction,
} from "./generated/ts/data/data";
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
import type { HookRequest } from "./generated/ts/rpc/hook.request";
import type { HookResponse } from "./generated/ts/rpc/hook.response";
import type { PaymentCancelRequest } from "./generated/ts/rpc/payment_cancel.request";
import type { PaymentCancelResponse } from "./generated/ts/rpc/payment_cancel.response";
import type { PaymentCaptureRequest } from "./generated/ts/rpc/payment_capture.request";
import type { PaymentCaptureResponse } from "./generated/ts/rpc/payment_capture.response";
import type { PaymentIntentRequest } from "./generated/ts/rpc/payment_intent.request";
import type { PaymentIntentResponse } from "./generated/ts/rpc/payment_intent.response";
import type { PaymentTransferRequest } from "./generated/ts/rpc/payment_transfer.request";
import type { PaymentTransferResponse } from "./generated/ts/rpc/payment_transfer.response";
import type { PaymentWebhookRequest } from "./generated/ts/rpc/payment_webhook.request";
import type { PaymentWebhookResponse } from "./generated/ts/rpc/payment_webhook.response";
import type { PlaceSearchRequest } from "./generated/ts/rpc/place_search.request";
import type { PlaceSearchResponse } from "./generated/ts/rpc/place_search.response";
import type { ResourcesResponse } from "./generated/ts/rpc/resources.response";
import type { SyncRequest } from "./generated/ts/rpc/sync.request";
import type { SyncResponse } from "./generated/ts/rpc/sync.response";
import type { UpdateRequest } from "./generated/ts/rpc/update.request";
import type { UpdateResponse } from "./generated/ts/rpc/update.response";
import {
	type RowTriggerName,
	SDUI_DEFINITIONS,
	SDUI_ROW_TRIGGERS,
} from "./generated/ts/sdui/definitions.generated";
import type { UI_Flow, UI_Row } from "./generated/ts/sdui/evy";

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
import hookRequestRaw from "./schema/rpc/hook.request.schema.json" with {
	type: "json",
};
import hookResponseRaw from "./schema/rpc/hook.response.schema.json" with {
	type: "json",
};
import paymentCancelRequestRaw from "./schema/rpc/payment_cancel.request.schema.json" with {
	type: "json",
};
import paymentCancelResponseRaw from "./schema/rpc/payment_cancel.response.schema.json" with {
	type: "json",
};
import paymentCaptureRequestRaw from "./schema/rpc/payment_capture.request.schema.json" with {
	type: "json",
};
import paymentCaptureResponseRaw from "./schema/rpc/payment_capture.response.schema.json" with {
	type: "json",
};
import paymentIntentRequestRaw from "./schema/rpc/payment_intent.request.schema.json" with {
	type: "json",
};
import paymentIntentResponseRaw from "./schema/rpc/payment_intent.response.schema.json" with {
	type: "json",
};
import paymentTransferRequestRaw from "./schema/rpc/payment_transfer.request.schema.json" with {
	type: "json",
};
import paymentTransferResponseRaw from "./schema/rpc/payment_transfer.response.schema.json" with {
	type: "json",
};
import paymentWebhookRequestRaw from "./schema/rpc/payment_webhook.request.schema.json" with {
	type: "json",
};
import paymentWebhookResponseRaw from "./schema/rpc/payment_webhook.response.schema.json" with {
	type: "json",
};
import placeSearchRequestRaw from "./schema/rpc/place_search.request.schema.json" with {
	type: "json",
};
import placeSearchResponseRaw from "./schema/rpc/place_search.response.schema.json" with {
	type: "json",
};
import resourcesResponseRaw from "./schema/rpc/resources.response.schema.json" with {
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
	"sdui/action.schema.json": sduiActionRaw as Record<string, unknown>,
	...SDUI_DEFINITION_SCHEMAS,
	"sdui/evy.schema.json": evySduiRaw as Record<string, unknown>,
	"files/file.schema.json": fileSchemaRaw as Record<string, unknown>,
	"rpc/payment_intent.request.schema.json": paymentIntentRequestRaw as Record<
		string,
		unknown
	>,
	"rpc/payment_intent.response.schema.json":
		paymentIntentResponseRaw as Record<string, unknown>,
	"rpc/payment_capture.request.schema.json":
		paymentCaptureRequestRaw as Record<string, unknown>,
	"rpc/payment_capture.response.schema.json":
		paymentCaptureResponseRaw as Record<string, unknown>,
	"rpc/payment_cancel.request.schema.json": paymentCancelRequestRaw as Record<
		string,
		unknown
	>,
	"rpc/payment_cancel.response.schema.json":
		paymentCancelResponseRaw as Record<string, unknown>,
	"rpc/payment_transfer.request.schema.json":
		paymentTransferRequestRaw as Record<string, unknown>,
	"rpc/payment_transfer.response.schema.json":
		paymentTransferResponseRaw as Record<string, unknown>,
	"rpc/payment_webhook.request.schema.json":
		paymentWebhookRequestRaw as Record<string, unknown>,
	"rpc/payment_webhook.response.schema.json":
		paymentWebhookResponseRaw as Record<string, unknown>,
	"rpc/place_search.request.schema.json": placeSearchRequestRaw as Record<
		string,
		unknown
	>,
	"rpc/place_search.response.schema.json": placeSearchResponseRaw as Record<
		string,
		unknown
	>,
	"rpc/api.request.schema.json": apiRequestRaw as Record<string, unknown>,
	"rpc/get.request.schema.json": getRequestRaw as Record<string, unknown>,
	"rpc/hook.request.schema.json": hookRequestRaw as Record<string, unknown>,
	"rpc/hook.response.schema.json": hookResponseRaw as Record<string, unknown>,
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
	"rpc/resources.response.schema.json": resourcesResponseRaw as Record<
		string,
		unknown
	>,
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

	// A oneOf union reports one failure per branch, so the same complaint
	// repeats many times. Dedupe and cap so the real cause stays readable.
	const seen = new Set<string>();
	for (const e of errors) {
		const path = e.instancePath === "" ? "(root)" : e.instancePath;
		seen.add(`${path}: ${e.message ?? "invalid"}`);
	}

	const MAX_REPORTED = 6;
	const parts = [...seen];
	const shown = parts.slice(0, MAX_REPORTED);
	const remaining = parts.length - shown.length;
	const suffix = remaining > 0 ? `; (+${remaining} more)` : "";
	return `${label} validation failed: ${shown.join("; ")}${suffix}`;
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

function schemaValidator<T>(
	label: string,
	ajvGetter: () => InstanceType<typeof Ajv2020>,
	uri: string,
): (data: unknown) => T {
	return makeValidator(label, lazyValidator<T>(ajvGetter, uri));
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
	"rpc/payment_intent.request.schema.json",
	"rpc/payment_capture.request.schema.json",
	"rpc/payment_cancel.request.schema.json",
	"rpc/payment_transfer.request.schema.json",
	"rpc/payment_webhook.request.schema.json",
	"rpc/place_search.request.schema.json",
	"rpc/hook.request.schema.json",
] as const;

/** data.schema references SDUI for DATA_EVY_Flow; register both in one instance */
const ENTITY_SCHEMA_FILES = [
	"common/json.schema.json",
	"common/rpc.schema.json",
	"data/data.schema.json",
	"data/primitive.schema.json",
	"sdui/action.schema.json",
	...Object.keys(SDUI_DEFINITION_SCHEMAS).sort(),
	"sdui/evy.schema.json",
	"files/file.schema.json",
	"rpc/get.response.schema.json",
	"rpc/create.response.schema.json",
	"rpc/update.response.schema.json",
	"rpc/delete.response.schema.json",
	"rpc/sync.response.schema.json",
	"rpc/resources.response.schema.json",
	"rpc/payment_intent.response.schema.json",
	"rpc/payment_capture.response.schema.json",
	"rpc/payment_cancel.response.schema.json",
	"rpc/payment_transfer.response.schema.json",
	"rpc/payment_webhook.response.schema.json",
	"rpc/place_search.response.schema.json",
	"rpc/hook.response.schema.json",
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

const getValidateUiFlow = lazyValidator<UI_Flow>(
	getEntityAjv,
	fileId("sdui/evy.schema.json"),
);
const getValidateDataEvyRow = lazyValidator<DATA_EVY_Row>(
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Row`,
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

export const validateApiRequest = schemaValidator<ApiRequest>(
	"ApiRequest",
	getRequestAjv,
	fileId("rpc/api.request.schema.json"),
);
export const validateCreateRequest = schemaValidator<CreateRequest>(
	"CreateRequest",
	getRequestAjv,
	fileId("rpc/create.request.schema.json"),
);
export const validateUpdateRequest = schemaValidator<UpdateRequest>(
	"UpdateRequest",
	getRequestAjv,
	fileId("rpc/update.request.schema.json"),
);
export const validateDeleteRequest = schemaValidator<DeleteRequest>(
	"DeleteRequest",
	getRequestAjv,
	fileId("rpc/delete.request.schema.json"),
);
export const validateCreateDataPayload = schemaValidator<CreateRequest["data"]>(
	"Create data",
	getRequestAjv,
	`${fileId("rpc/create.request.schema.json")}#/$defs/CreateDataPayload`,
);
export const validateUpdateDataPayload = schemaValidator<UpdateRequest["data"]>(
	"Update data",
	getRequestAjv,
	`${fileId("rpc/update.request.schema.json")}#/$defs/UpdateDataPayload`,
);
export const validateGetRequest = schemaValidator<GetRequest>(
	"GetRequest",
	getRequestAjv,
	fileId("rpc/get.request.schema.json"),
);
export const validateHookRequest = schemaValidator<HookRequest>(
	"HookRequest",
	getRequestAjv,
	fileId("rpc/hook.request.schema.json"),
);
export const validateHookResponse = schemaValidator<HookResponse>(
	"HookResponse",
	getEntityAjv,
	fileId("rpc/hook.response.schema.json"),
);

function assertUiFlowRowTriggerConstraints(row: UI_Row, path: string): void {
	const triggerSpecs = SDUI_ROW_TRIGGERS[row.type];
	if (!triggerSpecs) {
		throw new Error(
			`Flow validation failed: ${path}: unknown row type "${row.type}"`,
		);
	}
	const declaredTriggers = new Set(triggerSpecs.map((spec) => spec.trigger));
	const actionsRecord = row.actions ?? {};
	for (const triggerKey of Object.keys(actionsRecord)) {
		if (!declaredTriggers.has(triggerKey as RowTriggerName)) {
			throw new Error(
				`Flow validation failed: ${path}.actions: trigger "${triggerKey}" is not declared for row type ${row.type}`,
			);
		}
	}
	for (const spec of triggerSpecs) {
		if (!spec.required) {
			continue;
		}
		const actionList = actionsRecord[spec.trigger];
		if (!Array.isArray(actionList) || actionList.length === 0) {
			throw new Error(
				`Flow validation failed: ${path}.actions.${spec.trigger}: required trigger must have at least one action`,
			);
		}
	}
}

/**
 * Visits every row in a flow, including nested sheet/child/children rows.
 *
 * The one place that knows how a flow's row tree is shaped and how to name a
 * position in it, so the checks below stay flat.
 */
function forEachFlowRow(
	flow: UI_Flow,
	visit: (row: UI_Row, path: string) => void,
): void {
	function walk(row: UI_Row, path: string): void {
		visit(row, path);
		const record = row as Record<string, unknown>;
		if (record.sheet && typeof record.sheet === "object") {
			walk(record.sheet as UI_Row, `${path}.sheet`);
		}
		if (record.child && typeof record.child === "object") {
			walk(record.child as UI_Row, `${path}.child`);
		}
		if (Array.isArray(record.children)) {
			for (let index = 0; index < record.children.length; index++) {
				const child = record.children[index];
				if (child && typeof child === "object") {
					walk(child as UI_Row, `${path}.children[${index}]`);
				}
			}
		}
	}

	for (let pageIndex = 0; pageIndex < flow.pages.length; pageIndex++) {
		const page = flow.pages[pageIndex];
		if (!page) continue;
		for (let rowIndex = 0; rowIndex < page.rows.length; rowIndex++) {
			const row = page.rows[rowIndex];
			if (row) walk(row, `pages[${pageIndex}].rows[${rowIndex}]`);
		}
		if (page.footer) walk(page.footer, `pages[${pageIndex}].footer`);
	}
}

function assertActionBranchAtPath(
	branch: unknown,
	path: string,
	submitTargets?: Set<string>,
): void {
	if (branch === "" || branch === undefined) return;
	if (typeof branch === "string") {
		const trimmed = branch.trim();
		if (!trimmed) return;
		const parsed = parseActionExpression(trimmed);
		if (!parsed.ok) {
			throw new Error(`Row validation failed: ${path}: ${parsed.reason}`);
		}
		if (submitTargets) {
			const target = submitCreateTargetFromAst(parsed.ast);
			if (target) submitTargets.add(target);
		}
		return;
	}
	if (typeof branch === "object" && branch !== null) {
		throw new Error(
			`Row validation failed: ${path}: structured action invocations are no longer accepted`,
		);
	}
	throw new Error(
		`Row validation failed: ${path}: action branch must be a string`,
	);
}

function assertActionBranchesInActions(
	actions: unknown,
	pathPrefix: string,
	submitTargets?: Set<string>,
): void {
	forEachActionBranch(actions, (branch, branchPath) => {
		assertActionBranchAtPath(
			branch,
			`${pathPrefix}/${branchPath}`,
			submitTargets,
		);
	});
}

/**
 * A flow that submits must say so. Both clients previously derived this by
 * re-parsing every action string in the flow - independently, in two languages.
 * The declaration is now the source of truth and the actions are checked
 * against it.
 *
 * A declaration with no matching action is allowed: flows are authored
 * incrementally, and the declaration alone is harmless.
 */
function assertUiFlowSubmitsDeclaration(
	flow: UI_Flow,
	targets: Set<string>,
): void {
	if (targets.size === 0) return;

	if (targets.size > 1) {
		throw new Error(
			`Flow validation failed: flow submits more than one entity (${[
				...targets,
			]
				.sort()
				.join(", ")}); a flow may submit at most one`,
		);
	}

	const [target] = [...targets];
	if (!flow.submits) {
		throw new Error(
			`Flow validation failed: flow has a create(...,submit) targeting ${target} but declares no "submits"`,
		);
	}

	const declared = flow.submits.resource;
	if (declared !== target) {
		throw new Error(
			`Flow validation failed: flow declares submits ${declared} but its create(...,submit) targets ${target}`,
		);
	}
}

/** Human-oriented label for API errors (matches prior `validation.ts` wrappers). */
export function validateUiFlow(data: unknown): UI_Flow {
	assertValid("Flow", getValidateUiFlow(), data);
	const flow = data as UI_Flow;
	const submitTargets = new Set<string>();
	forEachFlowRow(flow, (row, path) => {
		assertUiFlowRowTriggerConstraints(row, path);
		assertActionBranchesInActions(
			row.actions,
			`${path}/actions`,
			submitTargets,
		);
	});
	assertUiFlowSubmitsDeclaration(flow, submitTargets);
	return flow;
}
export const validateDataEvyAddress = schemaValidator<DATA_EVY_Address>(
	"Address",
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Address`,
);
export const validateDataEvyMessage = schemaValidator<DATA_EVY_Message>(
	"Message",
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Message`,
);
export const validateDataEvyTransaction = schemaValidator<DATA_EVY_Transaction>(
	"Transaction",
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Transaction`,
);
export const validateDataEvyFormatter = schemaValidator<DATA_EVY_Formatter>(
	"Formatter",
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Formatter`,
);
export const validateDataEvyFlow = schemaValidator<DATA_EVY_Flow>(
	"Flow",
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Flow`,
);
export const validateDataEvyPage = schemaValidator<DATA_EVY_Page>(
	"Page",
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Page`,
);
export function validateDataEvyRow(data: unknown): DATA_EVY_Row {
	assertValid("Row", getValidateDataEvyRow(), data);
	const row = data as DATA_EVY_Row;
	assertActionBranchesInActions(
		(row.data as Record<string, unknown>).actions,
		"data/actions",
	);
	return row;
}
export const validateDataEvyService = schemaValidator<DATA_EVY_Service>(
	"Service",
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Service`,
);
export const validateDataEvyOrganization =
	schemaValidator<DATA_EVY_Organization>(
		"Organization",
		getEntityAjv,
		`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_Organization`,
	);
export const validateDataEvyServiceProvider =
	schemaValidator<DATA_EVY_ServiceProvider>(
		"ServiceProvider",
		getEntityAjv,
		`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_ServiceProvider`,
	);
export const validateDataEvyFile = schemaValidator<DATA_EVY_File>(
	"File",
	getEntityAjv,
	`${fileId("data/data.schema.json")}#/$defs/DATA_EVY_File`,
);
export const validateGetResponse = schemaValidator<GetResponse>(
	"GetResponse",
	getEntityAjv,
	fileId("rpc/get.response.schema.json"),
);
export const validateCreateResponse = schemaValidator<CreateResponse>(
	"CreateResponse",
	getEntityAjv,
	fileId("rpc/create.response.schema.json"),
);
export const validateUpdateResponse = schemaValidator<UpdateResponse>(
	"UpdateResponse",
	getEntityAjv,
	fileId("rpc/update.response.schema.json"),
);
export const validateDeleteResponse = schemaValidator<DeleteResponse>(
	"DeleteResponse",
	getEntityAjv,
	fileId("rpc/delete.response.schema.json"),
);
export const validateSyncRequest = schemaValidator<SyncRequest>(
	"SyncRequest",
	getRequestAjv,
	fileId("rpc/sync.request.schema.json"),
);
export const validateSyncResponse = schemaValidator<SyncResponse>(
	"SyncResponse",
	getEntityAjv,
	fileId("rpc/sync.response.schema.json"),
);
export const validateResourcesResponse = schemaValidator<ResourcesResponse>(
	"ResourcesResponse",
	getEntityAjv,
	fileId("rpc/resources.response.schema.json"),
);
export const validatePaymentIntentRequest =
	schemaValidator<PaymentIntentRequest>(
		"PaymentIntentRequest",
		getRequestAjv,
		fileId("rpc/payment_intent.request.schema.json"),
	);
export const validatePaymentIntentResponse =
	schemaValidator<PaymentIntentResponse>(
		"PaymentIntentResponse",
		getEntityAjv,
		fileId("rpc/payment_intent.response.schema.json"),
	);
export const validatePaymentCaptureRequest =
	schemaValidator<PaymentCaptureRequest>(
		"PaymentCaptureRequest",
		getRequestAjv,
		fileId("rpc/payment_capture.request.schema.json"),
	);
export const validatePaymentCaptureResponse =
	schemaValidator<PaymentCaptureResponse>(
		"PaymentCaptureResponse",
		getEntityAjv,
		fileId("rpc/payment_capture.response.schema.json"),
	);
export const validatePaymentCancelRequest =
	schemaValidator<PaymentCancelRequest>(
		"PaymentCancelRequest",
		getRequestAjv,
		fileId("rpc/payment_cancel.request.schema.json"),
	);
export const validatePaymentCancelResponse =
	schemaValidator<PaymentCancelResponse>(
		"PaymentCancelResponse",
		getEntityAjv,
		fileId("rpc/payment_cancel.response.schema.json"),
	);
export const validatePaymentTransferRequest =
	schemaValidator<PaymentTransferRequest>(
		"PaymentTransferRequest",
		getRequestAjv,
		fileId("rpc/payment_transfer.request.schema.json"),
	);
export const validatePaymentTransferResponse =
	schemaValidator<PaymentTransferResponse>(
		"PaymentTransferResponse",
		getEntityAjv,
		fileId("rpc/payment_transfer.response.schema.json"),
	);
export const validatePaymentWebhookRequest =
	schemaValidator<PaymentWebhookRequest>(
		"PaymentWebhookRequest",
		getRequestAjv,
		fileId("rpc/payment_webhook.request.schema.json"),
	);
export const validatePaymentWebhookResponse =
	schemaValidator<PaymentWebhookResponse>(
		"PaymentWebhookResponse",
		getEntityAjv,
		fileId("rpc/payment_webhook.response.schema.json"),
	);
export const validatePlaceSearchRequest = schemaValidator<PlaceSearchRequest>(
	"PlaceSearchRequest",
	getRequestAjv,
	fileId("rpc/place_search.request.schema.json"),
);
export const validatePlaceSearchResponse = schemaValidator<PlaceSearchResponse>(
	"PlaceSearchResponse",
	getEntityAjv,
	fileId("rpc/place_search.response.schema.json"),
);
export const validateFileUploadChunkMetadata =
	schemaValidator<FileUploadChunkMetadata>(
		"FileUploadChunkMetadata",
		getRequestAjv,
		`${fileId("files/file.schema.json")}#/$defs/FileUploadChunkMetadata`,
	);
export const validateFileWithBinary = schemaValidator<FileWithBinary>(
	"FileWithBinary",
	getEntityAjv,
	`${fileId("files/file.schema.json")}#/$defs/FileWithBinary`,
);
// ISO date-time field validation for data payloads (post-schema).

function isIsoDateTimeFieldName(key: string): boolean {
	return key === "created_at" || key === "updated_at";
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
