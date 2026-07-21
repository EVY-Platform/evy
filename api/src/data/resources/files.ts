import { and, asc, eq, gt } from "drizzle-orm";

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

export async function listFileRowsWithBinary(
	db: EvyDb,
	filter: GetRequest["filter"] | undefined,
): Promise<GetResponse> {
	const base = db.select().from(file);
	const whereClauses: ReturnType<typeof eq>[] = [];

	if (filter?.id) {
		whereClauses.push(eq(file.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(file.updatedAt, filter.updatedAfter));
	}

	const query = whereClauses.length ? base.where(and(...whereClauses)) : base;
	const rows = await query.orderBy(asc(file.updatedAt), asc(file.id));
	const response = await Promise.all(
		rows.map((row) => fileRowToGetFileResponse(row as DATA_EVY_File)),
	);
	return validateGetResponse(response);
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
			createdAt: nowIso,
			updatedAt: nowIso,
		})
		.returning()
		.catch((err: unknown) => {
			if (hasDatabaseErrorCode(err, PG_UNIQUE_VIOLATION)) {
				throw new Error("Resource already exists");
			}
			throw err;
		});
	const response = validateCreateResponse(inserted[0]);

	notify(response);
	return response;
}

async function deleteFileMetadata(
	db: EvyDb,
	filter: DeleteRequest["filter"],
	notify: (value: unknown) => void,
): Promise<DeleteResponse> {
	const deleted = await db
		.delete(file)
		.where(eq(file.id, filter.id))
		.returning();
	if (deleted.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateDeleteResponse(deleted[0]);

	notify(response);
	return response;
}

// Upload preparation

async function createFileFromUpload(params: {
	filter: CreateRequest["filter"] | undefined;
	dataPayload: unknown;
	nowIso: string;
}): Promise<PreparedFileUpload> {
	const validated = validateFilePayload(params.dataPayload);
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
			createdAt: params.nowIso,
			updatedAt: params.nowIso,
		},
	};
}

// Response mapping

async function fileRowToGetFileResponse(
	metadata: DATA_EVY_File,
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
		createdAt: metadata.createdAt,
		updatedAt: metadata.updatedAt,
		dataBase64: fileData.toString("base64"),
	};
}
