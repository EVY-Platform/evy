import { describe, it, expect, beforeEach, mock, afterEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const mockCreateImageMetadata = mock(
	async (_params: { id: string; type: string }) => ({
		id: _params.id,
		type: _params.type,
		createdAt: "2024-01-19T12:00:00.000Z",
		updatedAt: "2024-01-19T12:00:00.000Z",
	}),
);

const mockGetImageMetadata = mock(async (id: string) => ({
	id,
	type: "image/jpeg" as const,
	createdAt: "2024-01-19T12:00:00.000Z",
	updatedAt: "2024-01-19T12:00:00.000Z",
}));

const mockDeleteImageMetadata = mock(async (id: string) => ({
	id,
	type: "image/jpeg" as const,
	createdAt: "2024-01-19T12:00:00.000Z",
	updatedAt: "2024-01-19T12:00:00.000Z",
}));

mock.module("../data", () => ({
	createImageMetadata: mockCreateImageMetadata,
	getImageMetadata: mockGetImageMetadata,
	deleteImageMetadata: mockDeleteImageMetadata,
}));

const {
	parseImageUploadChunkFrame,
	handleImageUploadChunk,
	completeImageUpload,
	cancelImageUpload,
	getImage,
	deleteImage,
	clearUploadSessionsForTest,
} = await import("../images");

function buildChunkFrame(metadata: object, chunkData: Buffer): Buffer {
	const metadataBytes = Buffer.from(JSON.stringify(metadata), "utf-8");
	const prefix = Buffer.alloc(4);
	prefix.writeUInt32BE(metadataBytes.length, 0);
	return Buffer.concat([prefix, metadataBytes, chunkData]);
}

const uploadId = "550e8400-e29b-41d4-a716-446655440000";
const validJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const _validPngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

let testImagesDir: string;
let testTmpDir: string;

beforeEach(async () => {
	clearUploadSessionsForTest();
	mockCreateImageMetadata.mockClear();
	mockGetImageMetadata.mockClear();
	mockDeleteImageMetadata.mockClear();

	testImagesDir = join(tmpdir(), `evy-images-test-${Date.now()}`);
	testTmpDir = join(tmpdir(), `evy-uploads-test-${Date.now()}`);
	await mkdir(testImagesDir, { recursive: true });
	await mkdir(testTmpDir, { recursive: true });
});

afterEach(async () => {
	await rm(testImagesDir, { recursive: true, force: true });
	await rm(testTmpDir, { recursive: true, force: true });
});

describe("parseImageUploadChunkFrame", () => {
	it("parses a valid JPEG chunk frame", () => {
		const metadata = {
			type: "image/jpeg",
			uploadId,
			index: 0,
			byteOffset: 0,
			byteLength: validJpegBytes.length,
		};
		const frame = buildChunkFrame(metadata, validJpegBytes);
		const result = parseImageUploadChunkFrame(frame);
		expect(result.metadata.uploadId).toBe(uploadId);
		expect(result.metadata.type).toBe("image/jpeg");
		expect(result.metadata.index).toBe(0);
		expect(result.chunkData).toEqual(validJpegBytes);
	});

	it("throws when frame is too short for length prefix", () => {
		expect(() => parseImageUploadChunkFrame(Buffer.from([0x00, 0x00]))).toThrow(
			"Frame too short to contain metadata length prefix",
		);
	});

	it("throws when metadata length exceeds frame size", () => {
		const prefix = Buffer.alloc(4);
		prefix.writeUInt32BE(999, 0);
		expect(() =>
			parseImageUploadChunkFrame(Buffer.concat([prefix, Buffer.from([0x01])])),
		).toThrow("Frame too short: metadata length exceeds frame size");
	});

	it("throws on invalid metadata JSON", () => {
		const badJson = Buffer.from("{invalid", "utf-8");
		const prefix = Buffer.alloc(4);
		prefix.writeUInt32BE(badJson.length, 0);
		expect(() =>
			parseImageUploadChunkFrame(Buffer.concat([prefix, badJson])),
		).toThrow("Invalid metadata JSON in upload chunk frame");
	});

	it("throws on unsupported image type", () => {
		const metadata = {
			type: "image/gif",
			uploadId,
			index: 0,
			byteOffset: 0,
			byteLength: 1,
		};
		const frame = buildChunkFrame(metadata, Buffer.from([0x00]));
		expect(() => parseImageUploadChunkFrame(frame)).toThrow(
			"Unsupported image type: image/gif",
		);
	});
});

describe("handleImageUploadChunk", () => {
	it("creates a new upload session for first chunk", async () => {
		const metadata = {
			type: "image/jpeg",
			uploadId,
			index: 0,
			byteOffset: 0,
			byteLength: validJpegBytes.length,
		};
		const frame = buildChunkFrame(metadata, validJpegBytes);
		await handleImageUploadChunk(frame);
	});

	it("accepts sequential chunks", async () => {
		const chunk1 = Buffer.from([0xff, 0xd8]);
		const chunk2 = Buffer.from([0xff, 0xe0]);

		const frame1 = buildChunkFrame(
			{
				type: "image/jpeg",
				uploadId,
				index: 0,
				byteOffset: 0,
				byteLength: chunk1.length,
			},
			chunk1,
		);
		const frame2 = buildChunkFrame(
			{
				type: "image/jpeg",
				uploadId,
				index: 1,
				byteOffset: chunk1.length,
				byteLength: chunk2.length,
			},
			chunk2,
		);
		await handleImageUploadChunk(frame1);
		await handleImageUploadChunk(frame2);
	});

	it("throws when first chunk index is not 0", async () => {
		const frame = buildChunkFrame(
			{ type: "image/jpeg", uploadId, index: 1, byteOffset: 0, byteLength: 4 },
			Buffer.from([0x01, 0x02, 0x03, 0x04]),
		);
		await expect(handleImageUploadChunk(frame)).rejects.toThrow(
			"First chunk must have index 0",
		);
	});

	it("throws on chunk index out of order", async () => {
		const chunk1 = Buffer.from([0xff, 0xd8]);
		await handleImageUploadChunk(
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
			handleImageUploadChunk(
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
		await expect(handleImageUploadChunk(frame)).rejects.toThrow(
			"Chunk byte length mismatch",
		);
	});
});

describe("completeImageUpload", () => {
	it("throws when no session found", async () => {
		await expect(
			completeImageUpload({
				uploadId: "00000000-0000-0000-0000-000000000001",
				type: "image/jpeg",
				totalBytes: 6,
				chunkCount: 1,
			}),
		).rejects.toThrow("No upload session found");
	});

	it("throws on total bytes mismatch", async () => {
		const chunk = validJpegBytes;
		await handleImageUploadChunk(
			buildChunkFrame(
				{
					type: "image/jpeg",
					uploadId,
					index: 0,
					byteOffset: 0,
					byteLength: chunk.length,
				},
				chunk,
			),
		);
		await expect(
			completeImageUpload({
				uploadId,
				type: "image/jpeg",
				totalBytes: 999,
				chunkCount: 1,
			}),
		).rejects.toThrow("Total bytes mismatch");
	});

	it("throws on invalid magic bytes", async () => {
		const badChunk = Buffer.from([0x00, 0x00, 0x00, 0x00]);
		await handleImageUploadChunk(
			buildChunkFrame(
				{
					type: "image/jpeg",
					uploadId,
					index: 0,
					byteOffset: 0,
					byteLength: badChunk.length,
				},
				badChunk,
			),
		);
		await expect(
			completeImageUpload({
				uploadId,
				type: "image/jpeg",
				totalBytes: badChunk.length,
				chunkCount: 1,
			}),
		).rejects.toThrow("Invalid magic bytes");
	});

	it("throws on invalid params", async () => {
		await expect(completeImageUpload(null)).rejects.toThrow(
			"completeImageUpload params must be an object",
		);
	});
});

describe("cancelImageUpload", () => {
	it("cancels an existing session", async () => {
		await handleImageUploadChunk(
			buildChunkFrame(
				{
					type: "image/jpeg",
					uploadId,
					index: 0,
					byteOffset: 0,
					byteLength: validJpegBytes.length,
				},
				validJpegBytes,
			),
		);
		const result = await cancelImageUpload({ uploadId });
		expect(result.ok).toBe(true);
	});

	it("returns ok:true even when no session exists", async () => {
		const result = await cancelImageUpload({
			uploadId: "00000000-0000-0000-0000-000000000002",
		});
		expect(result.ok).toBe(true);
	});

	it("throws on invalid params", async () => {
		await expect(cancelImageUpload({})).rejects.toThrow(
			"cancelImageUpload: uploadId must be a non-empty string",
		);
	});
});

describe("getImage", () => {
	it("throws when image binary not found", async () => {
		mockGetImageMetadata.mockImplementationOnce(async (id: string) => ({
			id,
			type: "image/jpeg" as const,
			createdAt: "2024-01-19T12:00:00.000Z",
			updatedAt: "2024-01-19T12:00:00.000Z",
		}));
		await expect(
			getImage({ id: "00000000-0000-0000-0000-000000000003" }),
		).rejects.toThrow("Image binary not found");
	});

	it("throws when id is missing", async () => {
		await expect(getImage({})).rejects.toThrow(
			"getImage: id must be a non-empty string",
		);
	});

	it("throws on invalid params", async () => {
		await expect(getImage(null)).rejects.toThrow(
			"getImage params must be an object",
		);
	});
});

describe("deleteImage", () => {
	it("throws on invalid params", async () => {
		await expect(deleteImage(null)).rejects.toThrow(
			"deleteImage params must be an object",
		);
	});

	it("throws when id is missing", async () => {
		await expect(deleteImage({})).rejects.toThrow(
			"deleteImage: id must be a non-empty string",
		);
	});

	it("propagates Image not found when metadata lookup fails", async () => {
		mockGetImageMetadata.mockImplementationOnce(async () => {
			throw new Error("Image not found");
		});
		await expect(
			deleteImage({ id: "00000000-0000-0000-0000-000000000099" }),
		).rejects.toThrow("Image not found");
		expect(mockDeleteImageMetadata).not.toHaveBeenCalled();
	});

	it("deletes metadata and returns ok:true for a valid id", async () => {
		const id = "550e8400-e29b-41d4-a716-446655440001";
		mockGetImageMetadata.mockImplementationOnce(async () => ({
			id,
			type: "image/jpeg" as const,
			createdAt: "2024-01-19T12:00:00.000Z",
			updatedAt: "2024-01-19T12:00:00.000Z",
		}));
		const result = await deleteImage({ id });
		expect(result.ok).toBe(true);
		expect(mockDeleteImageMetadata).toHaveBeenCalledWith(id);
	});

	it("deletes metadata even when binary is already missing", async () => {
		const id = "550e8400-e29b-41d4-a716-446655440002";
		mockGetImageMetadata.mockImplementationOnce(async () => ({
			id,
			type: "image/jpeg" as const,
			createdAt: "2024-01-19T12:00:00.000Z",
			updatedAt: "2024-01-19T12:00:00.000Z",
		}));
		const result = await deleteImage({ id });
		expect(result.ok).toBe(true);
		expect(mockDeleteImageMetadata).toHaveBeenCalledWith(id);
	});
});
