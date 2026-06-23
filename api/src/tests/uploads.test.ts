import { beforeEach, describe, expect, it } from "bun:test";
import {
	cancelUpload,
	clearUploadsForTest,
	handleUploadChunk,
	parseUploadChunkFrame,
} from "../procedures/uploads";

function buildChunkFrame(metadata: object, chunkData: Buffer): Buffer {
	const metadataBytes = Buffer.from(JSON.stringify(metadata), "utf-8");
	const prefix = Buffer.alloc(4);
	prefix.writeUInt32BE(metadataBytes.length, 0);
	return Buffer.concat([prefix, metadataBytes, chunkData]);
}

const uploadId = "440dcda6-3a4c-4767-8de0-dffe860fd5ba";
const validBytes = Buffer.from([1, 2, 3, 4, 5]);

beforeEach(() => {
	clearUploadsForTest();
});

describe("parseUploadChunkFrame", () => {
	it("parses a valid upload chunk frame", () => {
		const metadata = {
			uploadId,
			index: 0,
			byteOffset: 0,
			byteLength: validBytes.length,
		};
		const frame = buildChunkFrame(metadata, validBytes);
		const result = parseUploadChunkFrame(frame);
		expect(result.metadata.uploadId).toBe(uploadId);
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

	it("throws when uploadId is missing", () => {
		const metadata = {
			index: 0,
			byteOffset: 0,
			byteLength: 1,
		};
		const frame = buildChunkFrame(metadata, Buffer.from([0x00]));
		expect(() => parseUploadChunkFrame(frame)).toThrow(
			"Chunk metadata uploadId must be a non-empty string",
		);
	});
});

describe("handleUploadChunk", () => {
	it("creates a new upload session for first chunk", async () => {
		const metadata = {
			uploadId,
			index: 0,
			byteOffset: 0,
			byteLength: validBytes.length,
		};
		await handleUploadChunk(buildChunkFrame(metadata, validBytes));
	});

	it("accepts sequential chunks", async () => {
		const chunk1 = Buffer.from([1, 2]);
		const chunk2 = Buffer.from([3, 4]);

		await handleUploadChunk(
			buildChunkFrame(
				{
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
			{ uploadId, index: 1, byteOffset: 0, byteLength: 4 },
			Buffer.from([0x01, 0x02, 0x03, 0x04]),
		);
		await expect(handleUploadChunk(frame)).rejects.toThrow(
			"First chunk must have index 0",
		);
	});

	it("throws on chunk index out of order", async () => {
		const chunk1 = Buffer.from([1, 2]);
		await handleUploadChunk(
			buildChunkFrame(
				{
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
				uploadId,
				index: 0,
				byteOffset: 0,
				byteLength: 100,
			},
			Buffer.from([1, 2]),
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
			uploadId: "6897ad63-495d-46d9-8a5d-3400775f9e5a",
		});
		expect(result.ok).toBe(true);
	});

	it("throws on invalid params", async () => {
		await expect(cancelUpload({})).rejects.toThrow(
			"CancelUploadRequest validation failed",
		);
	});
});
