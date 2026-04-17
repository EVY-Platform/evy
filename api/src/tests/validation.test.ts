import { describe, it, expect } from "bun:test";
import { z } from "zod";
import {
	isIsoDateTimeFieldName,
	JsonValueSchema,
	validateDataPayload,
	zNumberSchema,
} from "../validation";

const zIntegerSchema = z.number().int();

describe("zIntegerSchema", () => {
	it("accepts whole numbers", () => {
		expect(zIntegerSchema.safeParse(0).success).toBe(true);
		expect(zIntegerSchema.safeParse(-42).success).toBe(true);
	});

	it("rejects fractional numbers", () => {
		expect(zIntegerSchema.safeParse(1.5).success).toBe(false);
		expect(zIntegerSchema.safeParse(2.0000001).success).toBe(false);
	});

	it("rejects non-finite numbers", () => {
		expect(zIntegerSchema.safeParse(Number.NaN).success).toBe(false);
		expect(zIntegerSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(
			false,
		);
	});
});

describe("zNumberSchema", () => {
	it("accepts integers and decimals", () => {
		expect(zNumberSchema.safeParse(3).success).toBe(true);
		expect(zNumberSchema.safeParse(3.14).success).toBe(true);
	});

	it("rejects non-finite numbers", () => {
		expect(zNumberSchema.safeParse(Number.NaN).success).toBe(false);
		expect(zNumberSchema.safeParse(Number.NEGATIVE_INFINITY).success).toBe(
			false,
		);
	});
});

describe("JsonValueSchema", () => {
	it("accepts nested objects with finite numbers", () => {
		const result = JsonValueSchema.safeParse({
			a: 1,
			b: { c: 2.5 },
			d: [null, true, "x"],
		});
		expect(result.success).toBe(true);
	});

	it("rejects NaN in nested values", () => {
		const result = JsonValueSchema.safeParse({ x: Number.NaN });
		expect(result.success).toBe(false);
	});
});

describe("isIsoDateTimeFieldName", () => {
	it("matches camelCase *At instants", () => {
		expect(isIsoDateTimeFieldName("createdAt")).toBe(true);
		expect(isIsoDateTimeFieldName("updatedAt")).toBe(true);
		expect(isIsoDateTimeFieldName("startAt")).toBe(true);
		expect(isIsoDateTimeFieldName("endAt")).toBe(true);
	});

	it("matches legacy *_timestamp keys", () => {
		expect(isIsoDateTimeFieldName("start_timestamp")).toBe(true);
		expect(isIsoDateTimeFieldName("end_timestamp")).toBe(true);
		expect(isIsoDateTimeFieldName("created_timestamp")).toBe(true);
	});

	it("does not match unrelated keys", () => {
		expect(isIsoDateTimeFieldName("id")).toBe(false);
		expect(isIsoDateTimeFieldName("count")).toBe(false);
		expect(isIsoDateTimeFieldName("timestamp")).toBe(false);
		expect(isIsoDateTimeFieldName("at")).toBe(false);
	});
});

describe("validateDataPayload", () => {
	it("accepts plain objects with JSON-serializable values", () => {
		const out = validateDataPayload({ id: "1", value: "ok", n: 1.25 });
		expect(out).toEqual({ id: "1", value: "ok", n: 1.25 });
	});

	it("rejects non-object root", () => {
		expect(() => validateDataPayload([])).toThrow("Data validation failed");
		expect(() => validateDataPayload("x")).toThrow("Data validation failed");
	});

	it("rejects NaN values", () => {
		expect(() => validateDataPayload({ bad: Number.NaN })).toThrow(
			"Data validation failed",
		);
	});

	it("rejects numeric timestamps for createdAt", () => {
		expect(() =>
			validateDataPayload({ id: "1", createdAt: 1_705_651_372 }),
		).toThrow("numeric timestamps");
	});

	it("accepts ISO strings for createdAt and updatedAt", () => {
		const out = validateDataPayload({
			id: "1",
			createdAt: "2024-01-19T12:00:00.000Z",
			updatedAt: "2024-01-19T12:00:00.000Z",
		});
		expect(out).toEqual({
			id: "1",
			createdAt: "2024-01-19T12:00:00.000Z",
			updatedAt: "2024-01-19T12:00:00.000Z",
		});
	});

	it("rejects epoch digit strings for created_timestamp", () => {
		expect(() =>
			validateDataPayload({
				id: "1",
				created_timestamp: "1701471377",
			}),
		).toThrow("Data validation failed");
	});

	it("validates date-time fields in nested objects", () => {
		expect(() =>
			validateDataPayload({
				item: { createdAt: 1_234_567_890 },
			}),
		).toThrow("numeric timestamps");
		expect(
			validateDataPayload({
				item: { createdAt: "2024-01-19T12:00:00.000Z" },
			}),
		).toEqual({
			item: { createdAt: "2024-01-19T12:00:00.000Z" },
		});
	});
});
