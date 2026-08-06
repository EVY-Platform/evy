import { and, asc, eq, gt, isNull } from "drizzle-orm";

import type {
	CreateRequest,
	CreateResponse,
	DATA_EVY_File,
	DeleteRequest,
	DeleteResponse,
	FileWithBinary,
	GetRequest,
	GetResponse,
} from "evy-types";
import { nowIso as clockNowIso } from "evy-types/clock";
import { file } from "evy-types/db/schema.generated";
import { hasDatabaseErrorCode, PG_UNIQUE_VIOLATION } from "evy-types/dbErrors";
import {
	validateCreateResponse,
	validateDeleteResponse,
	validateDataEvyFile as validateFilePayload,
	validateGetResponse,
} from "evy-types/validators";
import type { EvyDb } from "../../database/db";
import {
	deleteUploadSession,
	getUploadSession,
	uploadSessionToBuffer,
} from "../../shared/uploadSessions";
import { omitNulls, runListForSync, type SyncScope } from "./coreResource";
import {
	deleteFileBinaryIfExists,
	readFileBinary,
	writeFileBinary,
} from "./fileStorage";

// Types

type PreparedFileUpload = {
	fileId: string;
	metadataPayload: DATA_EVY_File;
};

// Resource operations

export async function listFileRows(
	db: EvyDb,
	filter: GetRequest["filter"] | undefined,
): Promise<GetResponse> {
	const base = db.select().from(file);
	const whereClauses: ReturnType<typeof eq>[] = [];

	if (filter?.id) {
		whereClauses.push(eq(file.id, filter.id));
	}
	if (filter?.updated_after) {
		whereClauses.push(gt(file.updated_at, filter.updated_after));
	} else {
		whereClauses.push(isNull(file.deleted_at));
	}

	const query = whereClauses.length ? base.where(and(...whereClauses)) : base;
	const rows = await query.orderBy(asc(file.updated_at), asc(file.id));

	const isSingleFileRead = Boolean(filter?.id);
	const response = isSingleFileRead
		? await Promise.all(rows.map(fileRowToGetFileResponse))
		: rows.map(omitNulls);

	return validateGetResponse(response);
}

export async function listFilesForSync(
	db: EvyDb,
	scope: SyncScope,
): Promise<GetResponse> {
	return runListForSync(db, file, scope, omitNulls);
}

export async function createFileResource(
	db: EvyDb,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const preparedFile = await createFileFromUpload({
		filter,
		dataPayload,
		nowIso,
	});

	try {
		return await insertFileMetadata(
			db,
			filter,
			preparedFile.metadataPayload,
			nowIso,
			notify,
		);
	} catch (err) {
		await deleteFileBinaryIfExists(preparedFile.fileId);
		throw err;
	}
}

export async function deleteFileResource(
	db: EvyDb,
	filter: DeleteRequest["filter"],
	notify: (value: unknown) => void,
): Promise<DeleteResponse> {
	const metadata = await selectFileRowById(db, filter.id);
	await deleteFileBinaryIfExists(metadata.id);

	return deleteFileMetadata(db, filter, notify);
}

// Metadata operations

async function selectFileRowById(
	db: EvyDb,
	id: string,
): Promise<DATA_EVY_File> {
	const rows = await db.select().from(file).where(eq(file.id, id)).limit(1);
	if (rows.length === 0) {
		throw new Error("File not found");
	}
	return rows[0] as DATA_EVY_File;
}

async function insertFileMetadata(
	db: EvyDb,
	filter: CreateRequest["filter"] | undefined,
	metadataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validated = validateFilePayload(metadataPayload);
	const inserted = await db
		.insert(file)
		.values({
			id: filter?.id ?? validated.id,
			type: validated.type,
			created_at: nowIso,
			updated_at: nowIso,
			visibility: validated.visibility,
		})
		.returning()
		.catch((err: unknown) => {
			if (hasDatabaseErrorCode(err, PG_UNIQUE_VIOLATION)) {
				throw new Error("Resource already exists");
			}
			throw err;
		});
	const response = validateCreateResponse(omitNulls(inserted[0]));

	notify(response);
	return response;
}

/** Metadata is tombstoned; the binary is removed from disk immediately. */
async function deleteFileMetadata(
	db: EvyDb,
	filter: DeleteRequest["filter"],
	notify: (value: unknown) => void,
): Promise<DeleteResponse> {
	const nowIso = clockNowIso();
	const deleted = await db
		.update(file)
		.set({ deleted_at: nowIso, updated_at: nowIso })
		.where(and(eq(file.id, filter.id), isNull(file.deleted_at)))
		.returning();
	if (deleted.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateDeleteResponse(omitNulls(deleted[0]));

	notify(response);
	return response;
}

// Upload preparation

async function createFileFromUpload(params: {
	filter: CreateRequest["filter"] | undefined;
	dataPayload: unknown;
	nowIso: string;
}): Promise<PreparedFileUpload> {
	const record =
		typeof params.dataPayload === "object" && params.dataPayload !== null
			? (params.dataPayload as Record<string, unknown>)
			: {};
	const validated = validateFilePayload(record);
	const fileId = params.filter?.id ?? validated.id;
	const uploadSession = getUploadSession(fileId);

	if (!uploadSession) {
		throw new Error(`No upload found for file id: ${fileId}`);
	}

	const fileBuffer = uploadSessionToBuffer(uploadSession);
	await writeFileBinary({
		id: fileId,
		bytes: fileBuffer,
	});
	deleteUploadSession(fileId);

	return {
		fileId,
		metadataPayload: {
			id: fileId,
			type: validated.type,
			created_at: params.nowIso,
			updated_at: params.nowIso,
			visibility: validated.visibility,
		},
	};
}

// Response mapping

type FileRow = typeof file.$inferSelect;

async function fileRowToGetFileResponse(
	metadata: FileRow,
): Promise<FileWithBinary> {
	let fileData: Buffer;
	try {
		fileData = await readFileBinary(metadata.id);
	} catch {
		throw new Error(`File binary not found for id: ${metadata.id}`);
	}

	return {
		id: metadata.id,
		type: metadata.type,
		created_at: metadata.created_at,
		updated_at: metadata.updated_at,
		visibility: metadata.visibility,
		data_base64: fileData.toString("base64"),
	};
}
