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

const upload_id = "440dcda6-3a4c-4767-8de0-dffe860fd5ba";
const validBytes = Buffer.from([1, 2, 3, 4, 5]);

beforeEach(() => {
	clearUploadsForTest();
});

describe("parseUploadChunkFrame", () => {
	it("parses a valid upload chunk frame", () => {
		const metadata = {
			upload_id,
			index: 0,
			byte_offset: 0,
			byte_length: validBytes.length,
		};
		const frame = buildChunkFrame(metadata, validBytes);
		const result = parseUploadChunkFrame(frame);
		expect(result.metadata.upload_id).toBe(upload_id);
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

	it("throws when upload_id is missing", () => {
		const metadata = {
			index: 0,
			byte_offset: 0,
			byte_length: 1,
		};
		const frame = buildChunkFrame(metadata, Buffer.from([0x00]));
		expect(() => parseUploadChunkFrame(frame)).toThrow(
			"FileUploadChunkMetadata validation failed",
		);
	});
});

describe("handleUploadChunk", () => {
	it("accepts sequential chunks", async () => {
		const chunk1 = Buffer.from([1, 2]);
		const chunk2 = Buffer.from([3, 4]);

		await handleUploadChunk(
			buildChunkFrame(
				{
					upload_id,
					index: 0,
					byte_offset: 0,
					byte_length: chunk1.length,
				},
				chunk1,
			),
		);
		await handleUploadChunk(
			buildChunkFrame(
				{
					upload_id,
					index: 1,
					byte_offset: chunk1.length,
					byte_length: chunk2.length,
				},
				chunk2,
			),
		);
	});

	it("throws when first chunk index is not 0", async () => {
		const frame = buildChunkFrame(
			{ upload_id, index: 1, byte_offset: 0, byte_length: 4 },
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
					upload_id,
					index: 0,
					byte_offset: 0,
					byte_length: chunk1.length,
				},
				chunk1,
			),
		);
		await expect(
			handleUploadChunk(
				buildChunkFrame(
					{
						upload_id,
						index: 2,
						byte_offset: chunk1.length,
						byte_length: 1,
					},
					Buffer.from([0x00]),
				),
			),
		).rejects.toThrow("Unexpected chunk index");
	});

	it("throws on byte_length mismatch", async () => {
		const frame = buildChunkFrame(
			{
				upload_id,
				index: 0,
				byte_offset: 0,
				byte_length: 100,
			},
			Buffer.from([1, 2]),
		);
		await expect(handleUploadChunk(frame)).rejects.toThrow(
			"Chunk byte length mismatch",
		);
	});
});

describe("cancel_upload", () => {
	it("cancels an existing upload session", async () => {
		await handleUploadChunk(
			buildChunkFrame(
				{
					upload_id,
					index: 0,
					byte_offset: 0,
					byte_length: validBytes.length,
				},
				validBytes,
			),
		);
		const result = await cancelUpload({ upload_id });
		expect(result.ok).toBe(true);
	});

	it("returns ok:true when no upload session exists", async () => {
		const result = await cancelUpload({
			upload_id: "6897ad63-495d-46d9-8a5d-3400775f9e5a",
		});
		expect(result.ok).toBe(true);
	});

	it("throws on invalid params", async () => {
		await expect(cancelUpload({})).rejects.toThrow(
			"CancelUploadRequest validation failed",
		);
	});
});
