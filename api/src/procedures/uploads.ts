export interface UploadChunkMetadata {
	uploadId: string;
	index: number;
	byteOffset: number;
	byteLength: number;
}

export interface UploadSession {
	chunks: Buffer[];
	receivedBytes: number;
	expectedIndex: number;
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const uploadSessions = new Map<string, UploadSession>();

export function parseUploadChunkFrame(frame: Buffer): {
	metadata: UploadChunkMetadata;
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
	validateUploadChunkMetadata(rawMetadata);
	const chunkData = frame.subarray(4 + metadataLength);
	return { metadata: rawMetadata, chunkData };
}

function validateUploadChunkMetadata(
	value: unknown,
): asserts value is UploadChunkMetadata {
	if (typeof value !== "object" || value === null) {
		throw new Error("Chunk metadata must be an object");
	}
	const metadata = value as Record<string, unknown>;
	if (typeof metadata.uploadId !== "string" || metadata.uploadId.length < 1) {
		throw new Error("Chunk metadata uploadId must be a non-empty string");
	}
	if (
		typeof metadata.index !== "number" ||
		!Number.isInteger(metadata.index) ||
		metadata.index < 0
	) {
		throw new Error("Chunk metadata index must be a non-negative integer");
	}
	if (
		typeof metadata.byteOffset !== "number" ||
		!Number.isInteger(metadata.byteOffset) ||
		metadata.byteOffset < 0
	) {
		throw new Error("Chunk metadata byteOffset must be a non-negative integer");
	}
	if (
		typeof metadata.byteLength !== "number" ||
		!Number.isInteger(metadata.byteLength) ||
		metadata.byteLength < 1
	) {
		throw new Error("Chunk metadata byteLength must be a positive integer");
	}
}

export async function handleUploadChunk(frame: Buffer): Promise<void> {
	const { metadata, chunkData } = parseUploadChunkFrame(frame);

	if (chunkData.length !== metadata.byteLength) {
		throw new Error(
			`Chunk byte length mismatch: expected ${metadata.byteLength}, got ${chunkData.length}`,
		);
	}

	const session = uploadSessions.get(metadata.uploadId);

	if (session) {
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
		return;
	}

	if (metadata.index !== 0) {
		throw new Error(`First chunk must have index 0, got ${metadata.index}`);
	}
	if (metadata.byteOffset !== 0) {
		throw new Error(
			`First chunk must have byteOffset 0, got ${metadata.byteOffset}`,
		);
	}
	if (chunkData.length > MAX_UPLOAD_BYTES) {
		throw new Error(`Upload exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes`);
	}
	uploadSessions.set(metadata.uploadId, {
		chunks: [chunkData],
		receivedBytes: chunkData.length,
		expectedIndex: 1,
	});
}

export function getUploadSession(uploadId: string): UploadSession | undefined {
	return uploadSessions.get(uploadId);
}

export function deleteUploadSession(uploadId: string): void {
	uploadSessions.delete(uploadId);
}

export function uploadSessionToBuffer(session: UploadSession): Buffer {
	return Buffer.concat(session.chunks);
}

export async function cancelUpload(params: unknown): Promise<{ ok: true }> {
	validateCancelUploadParams(params);
	uploadSessions.delete(params.uploadId);
	return { ok: true };
}

function validateCancelUploadParams(
	value: unknown,
): asserts value is { uploadId: string } {
	if (typeof value !== "object" || value === null) {
		throw new Error("CancelUploadRequest validation failed");
	}
	const params = value as Record<string, unknown>;
	if (typeof params.uploadId !== "string" || params.uploadId.length < 1) {
		throw new Error("CancelUploadRequest validation failed");
	}
}

export function clearUploadsForTest(): void {
	uploadSessions.clear();
}
