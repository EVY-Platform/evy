import { describe, it, expect, beforeEach, mock } from "bun:test";
import { writeImageBinary } from "../imageFiles";
import { useImageStorageDirsForTest } from "./imageStorageTestHelpers";

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
	getImageMetadata: mockGetImageMetadata,
	deleteImageMetadata: mockDeleteImageMetadata,
}));

const { getImage, deleteImage } = await import("../images");

useImageStorageDirsForTest("images");

const validJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

beforeEach(() => {
	mockGetImageMetadata.mockClear();
	mockDeleteImageMetadata.mockClear();
});

describe("getImage", () => {
	it("returns metadata with base64 image data", async () => {
		const id = "550e8400-e29b-41d4-a716-446655440001";
		mockGetImageMetadata.mockImplementationOnce(async () => ({
			id,
			type: "image/jpeg" as const,
			createdAt: "2024-01-19T12:00:00.000Z",
			updatedAt: "2024-01-19T12:00:00.000Z",
		}));
		await writeImageBinary({ id, type: "image/jpeg", bytes: validJpegBytes });

		const result = await getImage({ id });
		expect(result).toEqual({
			id,
			type: "image/jpeg",
			createdAt: "2024-01-19T12:00:00.000Z",
			dataBase64: validJpegBytes.toString("base64"),
		});
	});

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
			"GetImageRequest validation failed",
		);
	});

	it("throws on invalid params", async () => {
		await expect(getImage(null)).rejects.toThrow(
			"GetImageRequest validation failed",
		);
	});
});

describe("deleteImage", () => {
	it("throws on invalid params", async () => {
		await expect(deleteImage(null)).rejects.toThrow(
			"DeleteImageRequest validation failed",
		);
	});

	it("throws when id is missing", async () => {
		await expect(deleteImage({})).rejects.toThrow(
			"DeleteImageRequest validation failed",
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
		await writeImageBinary({ id, type: "image/jpeg", bytes: validJpegBytes });

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
