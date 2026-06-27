import { describe, expect, it } from "bun:test";
import { parsePhotoIds } from "./photoGallerySource";

describe("parsePhotoIds", () => {
	it("returns IDs from a JSON array string", () => {
		expect(parsePhotoIds('["id1", "id2"]')).toEqual(["id1", "id2"]);
	});

	it("returns trimmed IDs from a comma-separated string", () => {
		expect(parsePhotoIds("id1, id2 , id3")).toEqual(["id1", "id2", "id3"]);
	});

	it("returns a single ID in an array", () => {
		expect(parsePhotoIds("id1")).toEqual(["id1"]);
	});

	it("returns [] for blank input", () => {
		expect(parsePhotoIds("")).toEqual([]);
		expect(parsePhotoIds("   ")).toEqual([]);
	});

	it("returns [] for an unresolved SDUI binding", () => {
		expect(parsePhotoIds("{item.photo_ids}")).toEqual([]);
	});

	it("filters non-string values from a JSON array", () => {
		expect(parsePhotoIds('[1, "id1", true]')).toEqual(["id1"]);
	});
});
