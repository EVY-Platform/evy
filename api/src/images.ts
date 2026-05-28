import { writeFile, mkdir, rename, readFile, unlink } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createImageMetadata,
	deleteImageMetadata,
	getImageMetadata,
} from "./data";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
const IMAGES_DIR = resolve(join(__dirname, "..", "public", "images"));
const UPLOAD_TMP_DIR = resolve(join(__dirname, "..", "public", "uploads"));

const IMAGE_EXTENSIONS: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
};

const MAGIC_BYTES: Record<string, number[]> = {
	"image/jpeg": [0xff, 0xd8, 0xff],
	"image/png": [0x89, 0x50, 0x4e, 0x47],
};

interface ImageUploadChunkMetadata {
	type: string;
	uploadId: string;
	index: number;
	byteOffset: number;
	byteLength: number;
}

interface UploadSession {
	type: string;
	chunks: Buffer[];
	receivedBytes: number;
	expectedIndex: number;
}

const uploadSessions = new Map<string, UploadSession>();

export function parseImageUploadChunkFrame(frame: Buffer): {
	metadata: ImageUploadChunkMetadata;
	chunkData: Buffer;
} {
	if (frame.length < 4) {
		throw new Error("Frame too short to contain metadata length prefix");
	}
	const metadataLength = frame.readUInt32BE(0);
	if (frame.length < 4 + metadataLength) {
		throw new Error("Frame too short: metadata length exceeds frame size");
	}
	const metadataJson = frame.subarray(4, 4 + metadataLength).toString("utf-8");
	let rawMetadata: unknown;
	try {
		rawMetadata = JSON.parse(metadataJson);
	} catch {
		throw new Error("Invalid metadata JSON in upload chunk frame");
	}
	validateChunkMetadata(rawMetadata);
	const chunkData = frame.subarray(4 + metadataLength);
	return { metadata: rawMetadata, chunkData };
}

function validateChunkMetadata(
	value: unknown,
): asserts value is ImageUploadChunkMetadata {
	if (typeof value !== "object" || value === null) {
		throw new Error("Chunk metadata must be an object");
	}
	const m = value as Record<string, unknown>;
	if (!SUPPORTED_IMAGE_TYPES.has(m.type as string)) {
		throw new Error(`Unsupported image type: ${m.type}`);
	}
	if (typeof m.uploadId !== "string" || m.uploadId.length < 1) {
		throw new Error("Chunk metadata uploadId must be a non-empty string");
	}
	if (
		typeof m.index !== "number" ||
		!Number.isInteger(m.index) ||
		m.index < 0
	) {
		throw new Error("Chunk metadata index must be a non-negative integer");
	}
	if (
		typeof m.byteOffset !== "number" ||
		!Number.isInteger(m.byteOffset) ||
		m.byteOffset < 0
	) {
		throw new Error("Chunk metadata byteOffset must be a non-negative integer");
	}
	if (
		typeof m.byteLength !== "number" ||
		!Number.isInteger(m.byteLength) ||
		m.byteLength < 1
	) {
		throw new Error("Chunk metadata byteLength must be a positive integer");
	}
}

export async function handleImageUploadChunk(frame: Buffer): Promise<void> {
	const { metadata, chunkData } = parseImageUploadChunkFrame(frame);

	if (chunkData.length !== metadata.byteLength) {
		throw new Error(
			`Chunk byte length mismatch: expected ${metadata.byteLength}, got ${chunkData.length}`,
		);
	}

	const session = uploadSessions.get(metadata.uploadId);

	if (session) {
		if (session.type !== metadata.type) {
			throw new Error(
				`Upload type mismatch: session has ${session.type}, chunk has ${metadata.type}`,
			);
		}
		if (metadata.index !== session.expectedIndex) {
			throw new Error(
				`Unexpected chunk index: expected ${session.expectedIndex}, got ${metadata.index}`,
			);
		}
		if (metadata.byteOffset !== session.receivedBytes) {
			throw new Error(
				`Unexpected byte offset: expected ${session.receivedBytes}, got ${metadata.byteOffset}`,
			);
		}
		if (session.receivedBytes + chunkData.length > MAX_UPLOAD_BYTES) {
			throw new Error(
				`Upload exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes`,
			);
		}
		session.chunks.push(chunkData);
		session.receivedBytes += chunkData.length;
		session.expectedIndex++;
	} else {
		if (metadata.index !== 0) {
			throw new Error(`First chunk must have index 0, got ${metadata.index}`);
		}
		if (metadata.byteOffset !== 0) {
			throw new Error(
				`First chunk must have byteOffset 0, got ${metadata.byteOffset}`,
			);
		}
		if (chunkData.length > MAX_UPLOAD_BYTES) {
			throw new Error(
				`Upload exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes`,
			);
		}
		uploadSessions.set(metadata.uploadId, {
			type: metadata.type,
			chunks: [chunkData],
			receivedBytes: chunkData.length,
			expectedIndex: 1,
		});
	}
}

export interface CompleteImageUploadResponse {
	id: string;
	type: string;
	createdAt: string;
}

function validateCompleteImageUploadParams(params: unknown): asserts params is {
	uploadId: string;
	type: string;
	totalBytes: number;
	chunkCount: number;
} {
	if (typeof params !== "object" || params === null) {
		throw new Error("completeImageUpload params must be an object");
	}
	const p = params as Record<string, unknown>;
	if (typeof p.uploadId !== "string" || p.uploadId.length < 1) {
		throw new Error("completeImageUpload: uploadId must be a non-empty string");
	}
	if (!SUPPORTED_IMAGE_TYPES.has(p.type as string)) {
		throw new Error(`completeImageUpload: unsupported type: ${p.type}`);
	}
	if (
		typeof p.totalBytes !== "number" ||
		!Number.isInteger(p.totalBytes) ||
		p.totalBytes < 1
	) {
		throw new Error(
			"completeImageUpload: totalBytes must be a positive integer",
		);
	}
	if (
		typeof p.chunkCount !== "number" ||
		!Number.isInteger(p.chunkCount) ||
		p.chunkCount < 1
	) {
		throw new Error(
			"completeImageUpload: chunkCount must be a positive integer",
		);
	}
}

function validateMagicBytes(buffer: Buffer, type: string): void {
	const expected = MAGIC_BYTES[type];
	if (!expected) {
		throw new Error(`No magic bytes defined for type: ${type}`);
	}
	for (let i = 0; i < expected.length; i++) {
		if (buffer[i] !== expected[i]) {
			throw new Error(`Invalid magic bytes for image type ${type}`);
		}
	}
}

function safeImagePath(id: string, ext: string): string {
	const sanitizedId = id.replace(/[^a-zA-Z0-9-]/g, "");
	return resolve(join(IMAGES_DIR, `${sanitizedId}.${ext}`));
}

export async function completeImageUpload(
	params: unknown,
): Promise<CompleteImageUploadResponse> {
	validateCompleteImageUploadParams(params);

	const session = uploadSessions.get(params.uploadId);
	if (!session) {
		throw new Error(`No upload session found for uploadId: ${params.uploadId}`);
	}

	if (session.receivedBytes !== params.totalBytes) {
		throw new Error(
			`Total bytes mismatch: expected ${params.totalBytes}, got ${session.receivedBytes}`,
		);
	}
	if (session.chunks.length !== params.chunkCount) {
		throw new Error(
			`Chunk count mismatch: expected ${params.chunkCount}, got ${session.chunks.length}`,
		);
	}

	const imageBuffer = Buffer.concat(session.chunks);
	validateMagicBytes(imageBuffer, params.type);

	await mkdir(IMAGES_DIR, { recursive: true });
	await mkdir(UPLOAD_TMP_DIR, { recursive: true });

	const ext = IMAGE_EXTENSIONS[params.type];
	const finalPath = safeImagePath(params.uploadId, ext);
	const tmpPath = join(UPLOAD_TMP_DIR, `${params.uploadId}.tmp`);

	try {
		await writeFile(tmpPath, imageBuffer);
		await rename(tmpPath, finalPath);
		uploadSessions.delete(params.uploadId);

		const metadata = await createImageMetadata({
			id: params.uploadId,
			type: params.type,
		});
		return {
			id: metadata.id,
			type: metadata.type,
			createdAt: metadata.createdAt,
		};
	} catch (err) {
		try {
			await unlink(finalPath);
		} catch {
			// ignore
		}
		try {
			await unlink(tmpPath);
		} catch {
			// ignore
		}
		throw err;
	}
}

function validateCancelImageUploadParams(
	params: unknown,
): asserts params is { uploadId: string } {
	if (typeof params !== "object" || params === null) {
		throw new Error("cancelImageUpload params must be an object");
	}
	const p = params as Record<string, unknown>;
	if (typeof p.uploadId !== "string" || p.uploadId.length < 1) {
		throw new Error("cancelImageUpload: uploadId must be a non-empty string");
	}
}

export async function cancelImageUpload(
	params: unknown,
): Promise<{ ok: true }> {
	validateCancelImageUploadParams(params);

	const session = uploadSessions.get(params.uploadId);
	if (session) {
		uploadSessions.delete(params.uploadId);
	}

	const ext = session ? IMAGE_EXTENSIONS[session.type] : undefined;
	if (ext) {
		const tmpPath = join(UPLOAD_TMP_DIR, `${params.uploadId}.tmp`);
		try {
			await unlink(tmpPath);
		} catch {
			// ignore
		}
	}

	return { ok: true };
}

export interface GetImageResponse {
	id: string;
	type: string;
	createdAt: string;
	dataBase64: string;
}

function validateGetImageParams(
	params: unknown,
): asserts params is { id: string } {
	if (typeof params !== "object" || params === null) {
		throw new Error("getImage params must be an object");
	}
	const p = params as Record<string, unknown>;
	if (typeof p.id !== "string" || p.id.length < 1) {
		throw new Error("getImage: id must be a non-empty string");
	}
}

export async function getImage(params: unknown): Promise<GetImageResponse> {
	validateGetImageParams(params);

	const metadata = await getImageMetadata(params.id);
	const ext = IMAGE_EXTENSIONS[metadata.type];
	const filePath = safeImagePath(metadata.id, ext);

	let fileData: Buffer;
	try {
		fileData = await readFile(filePath);
	} catch {
		throw new Error(`Image binary not found for id: ${params.id}`);
	}

	return {
		id: metadata.id,
		type: metadata.type,
		createdAt: metadata.createdAt,
		dataBase64: fileData.toString("base64"),
	};
}

export function clearUploadSessionsForTest(): void {
	uploadSessions.clear();
}

function validateDeleteImageParams(
	params: unknown,
): asserts params is { id: string } {
	if (typeof params !== "object" || params === null) {
		throw new Error("deleteImage params must be an object");
	}
	const p = params as Record<string, unknown>;
	if (typeof p.id !== "string" || p.id.length < 1) {
		throw new Error("deleteImage: id must be a non-empty string");
	}
}

export async function deleteImage(params: unknown): Promise<{ ok: true }> {
	validateDeleteImageParams(params);

	const metadata = await getImageMetadata(params.id);
	const ext = IMAGE_EXTENSIONS[metadata.type];
	const filePath = safeImagePath(metadata.id, ext);

	try {
		await unlink(filePath);
	} catch {
		// Binary already missing — still clean up metadata to avoid orphan.
	}

	await deleteImageMetadata(metadata.id);
	return { ok: true };
}
