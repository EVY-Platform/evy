import { and, asc, eq, gt } from "drizzle-orm";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";

import type {
	DATA_EVY_Image,
	ImageMimeType,
	ImageWithBinary,
	CreateRequest,
	CreateResponse,
	DeleteRequest,
	DeleteResponse,
	GetRequest,
	GetResponse,
} from "evy-types";
import {
	validateDataEvyImage as validateImagePayload,
	validateGetImageParams,
	validateGetResponse,
} from "evy-types/validators";

import { image } from "../../../types/generated/ts/db/schema.generated";
import {
	deleteUploadSession,
	getUploadSession,
	uploadSessionToBuffer,
} from "../procedures/uploads";
import {
	deleteResourceEntityFromConfig,
	imageResourceConfig,
	insertResourceEntityFromConfig,
} from "./resources";
import { db } from "./db";

// ---------------------------------------------------------------------------
// On-disk image binary I/O (formerly imageFiles.ts)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

let imagesDir = resolve(join(__dirname, "..", "public", "images"));
let uploadTmpDir = resolve(join(__dirname, "..", "public", "uploads"));

const IMAGE_EXTENSIONS: Record<ImageMimeType, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
};

const MAGIC_BYTES: Record<ImageMimeType, number[]> = {
	"image/jpeg": [0xff, 0xd8, 0xff],
	"image/png": [0x89, 0x50, 0x4e, 0x47],
};

export function isSupportedImageType(type: string): type is ImageMimeType {
	return Object.hasOwn(IMAGE_EXTENSIONS, type);
}

export function assertSupportedImageType(
	type: string,
): asserts type is ImageMimeType {
	if (!isSupportedImageType(type)) {
		throw new Error(`Unsupported image type: ${type}`);
	}
}

export function validateImageBytes(buffer: Buffer, type: string): void {
	assertSupportedImageType(type);
	const expected = MAGIC_BYTES[type];
	for (let i = 0; i < expected.length; i++) {
		if (buffer[i] !== expected[i]) {
			throw new Error(`Invalid magic bytes for image type ${type}`);
		}
	}
}

export async function writeImageBinary(params: {
	id: string;
	type: string;
	bytes: Buffer;
}): Promise<void> {
	validateImageBytes(params.bytes, params.type);
	await mkdir(imagesDir, { recursive: true });
	await mkdir(uploadTmpDir, { recursive: true });

	const finalPath = imagePath(params.id, params.type);
	const tmpPath = join(uploadTmpDir, `${sanitizeImageId(params.id)}.tmp`);

	try {
		await writeFile(tmpPath, params.bytes);
		await rename(tmpPath, finalPath);
	} catch (err) {
		await deletePathIfExists(finalPath);
		await deletePathIfExists(tmpPath);
		throw err;
	}
}

export async function readImageBinary(params: {
	id: string;
	type: string;
}): Promise<Buffer> {
	return readFile(imagePath(params.id, params.type));
}

export async function deleteImageBinary(params: {
	id: string;
	type: string;
}): Promise<void> {
	await unlink(imagePath(params.id, params.type));
}

export async function deleteImageBinaryIfExists(params: {
	id: string;
	type: string;
}): Promise<void> {
	await deletePathIfExists(imagePath(params.id, params.type));
}

function imagePath(id: string, type: string): string {
	assertSupportedImageType(type);
	return resolve(
		join(imagesDir, `${sanitizeImageId(id)}.${IMAGE_EXTENSIONS[type]}`),
	);
}

function sanitizeImageId(id: string): string {
	return id.replace(/[^a-zA-Z0-9-]/g, "");
}

async function deletePathIfExists(path: string): Promise<void> {
	try {
		await unlink(path);
	} catch {
		// ignore
	}
}

export function setImageStorageDirsForTest(params: {
	imagesDir: string;
	uploadTmpDir: string;
}): void {
	imagesDir = params.imagesDir;
	uploadTmpDir = params.uploadTmpDir;
}

export function resetImageStorageDirsForTest(): void {
	imagesDir = resolve(join(__dirname, "..", "public", "images"));
	uploadTmpDir = resolve(join(__dirname, "..", "public", "uploads"));
}

// ---------------------------------------------------------------------------
// Image resource CRUD helpers
// ---------------------------------------------------------------------------

type PreparedImageUpload = {
	imageId: string;
	imageType: DATA_EVY_Image["type"];
	dataPayload: DATA_EVY_Image;
};

async function createImageFromUpload(params: {
	filter: CreateRequest["filter"] | undefined;
	dataPayload: unknown;
	nowIso: string;
}): Promise<PreparedImageUpload> {
	const validated = validateImagePayload(params.dataPayload);
	const imageId = params.filter?.id ?? validated.id;
	const uploadSession = getUploadSession(imageId);

	if (!uploadSession) {
		throw new Error(`No upload found for image id: ${imageId}`);
	}
	if (uploadSession.type !== validated.type) {
		throw new Error(
			`Upload type mismatch: upload has ${uploadSession.type}, image data has ${validated.type}`,
		);
	}

	const imageBuffer = uploadSessionToBuffer(uploadSession);
	await writeImageBinary({
		id: imageId,
		type: validated.type,
		bytes: imageBuffer,
	});
	deleteUploadSession(imageId);

	return {
		imageId,
		imageType: validated.type,
		dataPayload: {
			...validated,
			id: imageId,
			createdAt: params.nowIso,
			updatedAt: params.nowIso,
		},
	};
}

async function selectImageRowById(id: string): Promise<DATA_EVY_Image> {
	const rows = await db.select().from(image).where(eq(image.id, id)).limit(1);
	if (rows.length === 0) {
		throw new Error("Image not found");
	}
	return rows[0] as DATA_EVY_Image;
}

// ---------------------------------------------------------------------------
// Public image resource operations
// ---------------------------------------------------------------------------

export async function createImageResource(
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const preparedImage = await createImageFromUpload({
		filter,
		dataPayload,
		nowIso,
	});

	try {
		return await insertResourceEntityFromConfig(
			imageResourceConfig,
			filter,
			preparedImage.dataPayload,
			nowIso,
			notify,
		);
	} catch (err) {
		await deleteImageBinaryIfExists({
			id: preparedImage.imageId,
			type: preparedImage.imageType,
		});
		throw err;
	}
}

export async function deleteImageResource(
	filter: DeleteRequest["filter"],
	notify: (value: unknown) => void,
): Promise<DeleteResponse> {
	const metadata = await selectImageRowById(filter.id);
	try {
		await deleteImageBinary({ id: metadata.id, type: metadata.type });
	} catch {
		// Binary already missing — still clean up metadata to avoid orphan.
	}

	return deleteResourceEntityFromConfig(imageResourceConfig, filter, notify);
}

// ---------------------------------------------------------------------------
// Public image read endpoint (standalone, not part of generic get)
// ---------------------------------------------------------------------------

export type { PreparedImageUpload };

async function imageRowToGetImageResponse(
	metadata: DATA_EVY_Image,
): Promise<ImageWithBinary> {
	let fileData: Buffer;
	try {
		fileData = await readImageBinary({
			id: metadata.id,
			type: metadata.type,
		});
	} catch {
		throw new Error(`Image binary not found for id: ${metadata.id}`);
	}

	return {
		id: metadata.id,
		type: metadata.type,
		createdAt: metadata.createdAt,
		updatedAt: metadata.updatedAt,
		dataBase64: fileData.toString("base64"),
	};
}

export async function listImageRowsWithBinary(
	filter: GetRequest["filter"] | undefined,
): Promise<GetResponse> {
	const base = db.select().from(image);
	const whereClauses: ReturnType<typeof eq>[] = [];

	if (filter?.id) {
		whereClauses.push(eq(image.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(image.updatedAt, filter.updatedAfter));
	}

	const rows = whereClauses.length
		? await base
				.where(and(...whereClauses))
				.orderBy(asc(image.updatedAt), asc(image.id))
		: await base.orderBy(asc(image.updatedAt), asc(image.id));
	const response = await Promise.all(
		rows.map((row) => imageRowToGetImageResponse(row as DATA_EVY_Image)),
	);
	return validateGetResponse(response);
}

export async function getImage(params: unknown): Promise<ImageWithBinary> {
	const validated = validateGetImageParams(params);
	const metadata = await selectImageRowById(validated.id);
	return imageRowToGetImageResponse(metadata);
}
