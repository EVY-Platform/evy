import { writeFile, mkdir, rename, readFile, unlink } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createImageMetadata,
	deleteImageMetadata,
	getImageMetadata,
} from "./data";
import {
	validateCompleteImageUploadParams,
	validateCancelImageUploadParams,
	validateGetImageParams,
	validateDeleteImageParams,
} from "evy-types/validators";

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

export interface CompleteImageUploadResponse {
	id: string;
	type: string;
	createdAt: string;
	updatedAt: string;
}

export interface GetImageResponse {
	id: string;
	type: string;
	createdAt: string;
	dataBase64: string;
}

export function createImageHandlers(
	sessions = new Map<string, UploadSession>(),
) {
	async function handleImageUploadChunk(frame: Buffer): Promise<void> {
		const { metadata, chunkData } = parseImageUploadChunkFrame(frame);

		if (chunkData.length !== metadata.byteLength) {
			throw new Error(
				`Chunk byte length mismatch: expected ${metadata.byteLength}, got ${chunkData.length}`,
			);
		}

		const session = sessions.get(metadata.uploadId);

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
			sessions.set(metadata.uploadId, {
				type: metadata.type,
				chunks: [chunkData],
				receivedBytes: chunkData.length,
				expectedIndex: 1,
			});
		}
	}

	async function completeImageUpload(
		params: unknown,
	): Promise<CompleteImageUploadResponse> {
		const validated = validateCompleteImageUploadParams(params);

		const session = sessions.get(validated.uploadId);
		if (!session) {
			throw new Error(
				`No upload session found for uploadId: ${validated.uploadId}`,
			);
		}

		if (session.receivedBytes !== validated.totalBytes) {
			throw new Error(
				`Total bytes mismatch: expected ${validated.totalBytes}, got ${session.receivedBytes}`,
			);
		}

		const imageBuffer = Buffer.concat(session.chunks);
		validateMagicBytes(imageBuffer, validated.type);

		await mkdir(IMAGES_DIR, { recursive: true });
		await mkdir(UPLOAD_TMP_DIR, { recursive: true });

		const ext = IMAGE_EXTENSIONS[validated.type];
		const finalPath = safeImagePath(validated.uploadId, ext);
		const tmpPath = join(UPLOAD_TMP_DIR, `${validated.uploadId}.tmp`);

		try {
			await writeFile(tmpPath, imageBuffer);
			await rename(tmpPath, finalPath);
			sessions.delete(validated.uploadId);

			const metadata = await createImageMetadata({
				id: validated.uploadId,
				type: validated.type,
			});
			return {
				id: metadata.id,
				type: metadata.type,
				createdAt: metadata.createdAt,
				updatedAt: metadata.updatedAt,
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

	async function cancelImageUpload(params: unknown): Promise<{ ok: true }> {
		const validated = validateCancelImageUploadParams(params);

		const session = sessions.get(validated.uploadId);
		if (session) {
			sessions.delete(validated.uploadId);
		}

		const ext = session ? IMAGE_EXTENSIONS[session.type] : undefined;
		if (ext) {
			const tmpPath = join(UPLOAD_TMP_DIR, `${validated.uploadId}.tmp`);
			try {
				await unlink(tmpPath);
			} catch {
				// ignore
			}
		}

		return { ok: true };
	}

	async function getImage(params: unknown): Promise<GetImageResponse> {
		const validated = validateGetImageParams(params);

		const metadata = await getImageMetadata(validated.id);
		const ext = IMAGE_EXTENSIONS[metadata.type];
		const filePath = safeImagePath(metadata.id, ext);

		let fileData: Buffer;
		try {
			fileData = await readFile(filePath);
		} catch {
			throw new Error(`Image binary not found for id: ${validated.id}`);
		}

		return {
			id: metadata.id,
			type: metadata.type,
			createdAt: metadata.createdAt,
			dataBase64: fileData.toString("base64"),
		};
	}

	async function deleteImage(params: unknown): Promise<{ ok: true }> {
		const validated = validateDeleteImageParams(params);

		const metadata = await getImageMetadata(validated.id);
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

	return {
		handleImageUploadChunk,
		completeImageUpload,
		cancelImageUpload,
		getImage,
		deleteImage,
	};
}
