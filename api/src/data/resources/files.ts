import { and, asc, eq, gt } from "drizzle-orm";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";

import type {
	DATA_EVY_File,
	FileWithBinary,
	CreateRequest,
	CreateResponse,
	DeleteRequest,
	DeleteResponse,
	GetRequest,
	GetResponse,
} from "evy-types";
import {
	validateDataEvyFile as validateFilePayload,
	validateGetResponse,
} from "evy-types/validators";

import { file } from "../../../../types/generated/ts/db/schema.generated";
import {
	deleteUploadSession,
	getUploadSession,
	uploadSessionToBuffer,
} from "../../procedures/uploads";
import type { EvyDb } from "../../database/db";
import {
	deleteResourceEntityFromConfig,
	insertResourceEntityFromConfig,
	type ResourceEntityConfig,
} from "./resourceEntity";

const __dirname = dirname(fileURLToPath(import.meta.url));

let filesDir = resolve(join(__dirname, "..", "public", "files"));
let uploadTmpDir = resolve(join(__dirname, "..", "public", "uploads"));

export async function writeFileBinary(params: {
	id: string;
	bytes: Buffer;
}): Promise<void> {
	await mkdir(filesDir, { recursive: true });
	await mkdir(uploadTmpDir, { recursive: true });

	const finalPath = filePath(params.id);
	const tmpPath = join(uploadTmpDir, `${sanitizeFileId(params.id)}.tmp`);

	try {
		await writeFile(tmpPath, params.bytes);
		await rename(tmpPath, finalPath);
	} catch (err) {
		await deletePathIfExists(finalPath);
		await deletePathIfExists(tmpPath);
		throw err;
	}
}

async function readFileBinary(id: string): Promise<Buffer> {
	return readFile(filePath(id));
}

async function deleteFileBinary(id: string): Promise<void> {
	await unlink(filePath(id));
}

async function deleteFileBinaryIfExists(id: string): Promise<void> {
	await deletePathIfExists(filePath(id));
}

function filePath(id: string): string {
	return resolve(join(filesDir, sanitizeFileId(id)));
}

function sanitizeFileId(id: string): string {
	return id.replace(/[^a-zA-Z0-9-]/g, "");
}

async function deletePathIfExists(path: string): Promise<void> {
	try {
		await unlink(path);
	} catch {
		// ignore missing files
	}
}

export function setFileStorageDirsForTest(params: {
	filesDir: string;
	uploadTmpDir: string;
}): void {
	filesDir = params.filesDir;
	uploadTmpDir = params.uploadTmpDir;
}

export function resetFileStorageDirsForTest(): void {
	filesDir = resolve(join(__dirname, "..", "public", "files"));
	uploadTmpDir = resolve(join(__dirname, "..", "public", "uploads"));
}

const fileResourceConfig: ResourceEntityConfig<DATA_EVY_File> = {
	table: file,
	validate: validateFilePayload,
	toUpdateSet: (_validated, nowIso) => ({
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

type PreparedFileUpload = {
	fileId: string;
	dataPayload: DATA_EVY_File;
};

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
		dataPayload: {
			id: fileId,
			type: validated.type,
			createdAt: params.nowIso,
			updatedAt: params.nowIso,
		},
	};
}

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
		return await insertResourceEntityFromConfig(
			db,
			fileResourceConfig,
			filter,
			preparedFile.dataPayload,
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
	try {
		await deleteFileBinary(metadata.id);
	} catch {
		// Binary already missing — still clean up metadata to avoid orphan.
	}

	return deleteResourceEntityFromConfig(db, fileResourceConfig, filter, notify);
}

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
