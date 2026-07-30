/**
 * In-memory chunked-upload session store. Lives in shared/ because both
 * the RPC layer (procedures/uploads) and the files resource (data layer)
 * consume it; neither may import the other.
 */
import type { FileUploadChunkMetadata } from "evy-types";
import { validateFileUploadChunkMetadata } from "evy-types/validators";

export interface UploadSession {
	chunks: Buffer[];
	receivedBytes: number;
	expectedIndex: number;
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const uploadSessions = new Map<string, UploadSession>();

// exported for tests
export function parseUploadChunkFrame(frame: Buffer): {
	metadata: FileUploadChunkMetadata;
	chunkData: Buffer;
} {
	if (frame.length < 4) {
		throw new Error("Frame too short to contain metadata length prefix");
	}
	const metadataLength = frame.readUInt32BE(0);
	if (frame.length < 4 + metadataLength) {
		throw new Error("Frame too short: metadata length exceeds frame size");
	}
	const metadataJson = frame
		.subarray(4, 4 + metadataLength)
		.toString("utf-8");
	let rawMetadata: unknown;
	try {
		rawMetadata = JSON.parse(metadataJson);
	} catch {
		throw new Error("Invalid metadata JSON in upload chunk frame");
	}
	const metadata = validateFileUploadChunkMetadata(rawMetadata);
	const chunkData = frame.subarray(4 + metadataLength);
	return { metadata, chunkData };
}

export async function handleUploadChunk(frame: Buffer): Promise<void> {
	const { metadata, chunkData } = parseUploadChunkFrame(frame);

	if (chunkData.length !== metadata.byte_length) {
		throw new Error(
			`Chunk byte length mismatch: expected ${metadata.byte_length}, got ${chunkData.length}`,
		);
	}

	const session = uploadSessions.get(metadata.upload_id);

	if (session) {
		if (metadata.index !== session.expectedIndex) {
			throw new Error(
				`Unexpected chunk index: expected ${session.expectedIndex}, got ${metadata.index}`,
			);
		}
		if (metadata.byte_offset !== session.receivedBytes) {
			throw new Error(
				`Unexpected byte offset: expected ${session.receivedBytes}, got ${metadata.byte_offset}`,
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
	if (metadata.byte_offset !== 0) {
		throw new Error(
			`First chunk must have byte_offset 0, got ${metadata.byte_offset}`,
		);
	}
	if (chunkData.length > MAX_UPLOAD_BYTES) {
		throw new Error(
			`Upload exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes`,
		);
	}
	uploadSessions.set(metadata.upload_id, {
		chunks: [chunkData],
		receivedBytes: chunkData.length,
		expectedIndex: 1,
	});
}

export function getUploadSession(upload_id: string): UploadSession | undefined {
	return uploadSessions.get(upload_id);
}

export function deleteUploadSession(upload_id: string): void {
	uploadSessions.delete(upload_id);
}

export function uploadSessionToBuffer(session: UploadSession): Buffer {
	return Buffer.concat(session.chunks);
}

export function clearUploadsForTest(): void {
	uploadSessions.clear();
}
