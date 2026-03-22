import { describe, it, expect } from "bun:test";
import {
	JsonValueSchema,
	validateDataPayload,
	zIntegerSchema,
	zNumberSchema,
} from "../validation";

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
});
