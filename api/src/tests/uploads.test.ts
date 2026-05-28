import { describe, it, expect, beforeEach } from "bun:test";
import {
	cancelUpload,
	clearUploadsForTest,
	handleUploadChunk,
	parseUploadChunkFrame,
} from "../uploads";

function buildChunkFrame(metadata: object, chunkData: Buffer): Buffer {
	const metadataBytes = Buffer.from(JSON.stringify(metadata), "utf-8");
	const prefix = Buffer.alloc(4);
	prefix.writeUInt32BE(metadataBytes.length, 0);
	return Buffer.concat([prefix, metadataBytes, chunkData]);
}

const uploadId = "550e8400-e29b-41d4-a716-446655440000";
const validBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

beforeEach(() => {
	clearUploadsForTest();
});

describe("parseUploadChunkFrame", () => {
	it("parses a valid upload chunk frame", () => {
		const metadata = {
			type: "image/jpeg",
			uploadId,
			index: 0,
			byteOffset: 0,
			byteLength: validBytes.length,
		};
		const frame = buildChunkFrame(metadata, validBytes);
		const result = parseUploadChunkFrame(frame);
		expect(result.metadata.uploadId).toBe(uploadId);
		expect(result.metadata.type).toBe("image/jpeg");
		expect(result.metadata.index).toBe(0);
		expect(result.chunkData).toEqual(validBytes);
	});

	it("throws when frame is too short for length prefix", () => {
		expect(() => parseUploadChunkFrame(Buffer.from([0x00, 0x00]))).toThrow(
			"Frame too short to contain metadata length prefix",
		);
	});

	it("throws when metadata length exceeds frame size", () => {
		const prefix = Buffer.alloc(4);
		prefix.writeUInt32BE(999, 0);
		expect(() =>
			parseUploadChunkFrame(Buffer.concat([prefix, Buffer.from([0x01])])),
		).toThrow("Frame too short: metadata length exceeds frame size");
	});

	it("throws on invalid metadata JSON", () => {
		const badJson = Buffer.from("{invalid", "utf-8");
		const prefix = Buffer.alloc(4);
		prefix.writeUInt32BE(badJson.length, 0);
		expect(() =>
			parseUploadChunkFrame(Buffer.concat([prefix, badJson])),
		).toThrow("Invalid metadata JSON in upload chunk frame");
	});

	it("throws when type is missing", () => {
		const metadata = {
			uploadId,
			index: 0,
			byteOffset: 0,
			byteLength: 1,
		};
		const frame = buildChunkFrame(metadata, Buffer.from([0x00]));
		expect(() => parseUploadChunkFrame(frame)).toThrow(
			"Chunk metadata type must be a non-empty string",
		);
	});
});

describe("handleUploadChunk", () => {
	it("creates a new upload session for first chunk", async () => {
		const metadata = {
			type: "image/jpeg",
			uploadId,
			index: 0,
			byteOffset: 0,
			byteLength: validBytes.length,
		};
		await handleUploadChunk(buildChunkFrame(metadata, validBytes));
	});

	it("accepts sequential chunks", async () => {
		const chunk1 = Buffer.from([0xff, 0xd8]);
		const chunk2 = Buffer.from([0xff, 0xe0]);

		await handleUploadChunk(
			buildChunkFrame(
				{
					type: "image/jpeg",
					uploadId,
					index: 0,
					byteOffset: 0,
					byteLength: chunk1.length,
				},
				chunk1,
			),
		);
		await handleUploadChunk(
			buildChunkFrame(
				{
					type: "image/jpeg",
					uploadId,
					index: 1,
					byteOffset: chunk1.length,
					byteLength: chunk2.length,
				},
				chunk2,
			),
		);
	});

	it("throws when first chunk index is not 0", async () => {
		const frame = buildChunkFrame(
			{ type: "image/jpeg", uploadId, index: 1, byteOffset: 0, byteLength: 4 },
			Buffer.from([0x01, 0x02, 0x03, 0x04]),
		);
		await expect(handleUploadChunk(frame)).rejects.toThrow(
			"First chunk must have index 0",
		);
	});

	it("throws on chunk index out of order", async () => {
		const chunk1 = Buffer.from([0xff, 0xd8]);
		await handleUploadChunk(
			buildChunkFrame(
				{
					type: "image/jpeg",
					uploadId,
					index: 0,
					byteOffset: 0,
					byteLength: chunk1.length,
				},
				chunk1,
			),
		);
		await expect(
			handleUploadChunk(
				buildChunkFrame(
					{
						type: "image/jpeg",
						uploadId,
						index: 2,
						byteOffset: chunk1.length,
						byteLength: 1,
					},
					Buffer.from([0x00]),
				),
			),
		).rejects.toThrow("Unexpected chunk index");
	});

	it("throws on byteLength mismatch", async () => {
		const frame = buildChunkFrame(
			{
				type: "image/jpeg",
				uploadId,
				index: 0,
				byteOffset: 0,
				byteLength: 100,
			},
			Buffer.from([0xff, 0xd8]),
		);
		await expect(handleUploadChunk(frame)).rejects.toThrow(
			"Chunk byte length mismatch",
		);
	});
});

describe("cancelUpload", () => {
	it("cancels an existing upload session", async () => {
		await handleUploadChunk(
			buildChunkFrame(
				{
					type: "image/jpeg",
					uploadId,
					index: 0,
					byteOffset: 0,
					byteLength: validBytes.length,
				},
				validBytes,
			),
		);
		const result = await cancelUpload({ uploadId });
		expect(result.ok).toBe(true);
	});

	it("returns ok:true when no upload session exists", async () => {
		const result = await cancelUpload({
			uploadId: "00000000-0000-0000-0000-000000000002",
		});
		expect(result.ok).toBe(true);
	});

	it("throws on invalid params", async () => {
		await expect(cancelUpload({})).rejects.toThrow(
			"CancelUploadRequest validation failed",
		);
	});
});
