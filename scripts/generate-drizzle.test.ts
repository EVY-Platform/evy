import { describe, expect, test } from "bun:test";
import {
	assertDrizzleConfig,
	type DrizzleConfig,
	type JsonSchema,
	resolveJsonbTypeAnnotation,
	validateEveryDataDefHasATable,
} from "./generate-drizzle";
import { snakeToCamel, snakeToPascal } from "./types-generation-utils";

function tableConfig(tableName: string) {
	return {
		tableName,
		primaryKey: "id",
		defaultRandom: [],
		uniqueIndexes: [],
	};
}

const schemaWithFoo: JsonSchema = {
	$defs: {
		DATA_EVY_Foo: {
			type: "object",
			properties: { id: { type: "string" } },
		},
	},
};

describe("naming helpers", () => {
	test("snakeToPascal converts snake_case and is idempotent on PascalCase", () => {
		expect(snakeToPascal("horizontal_container")).toBe(
			"HorizontalContainer",
		);
		expect(snakeToPascal("HorizontalContainer")).toBe(
			"HorizontalContainer",
		);
	});

	test("snakeToCamel converts snake_case resource names", () => {
		expect(snakeToCamel("selling_reasons")).toBe("sellingReasons");
	});
});

describe("resolveJsonbTypeAnnotation", () => {
	test("throws on an unknown object $ref", () => {
		expect(() =>
			resolveJsonbTypeAnnotation("../unknown/schema.json"),
		).toThrow(/unrecognised object \$ref/);
	});
});

describe("validateEveryDataDefHasATable", () => {
	test("throws when a DATA_EVY_ def has no table entry", () => {
		const config: DrizzleConfig = { tables: {} };

		expect(() =>
			validateEveryDataDefHasATable(schemaWithFoo, config),
		).toThrow(/DATA_EVY_Foo/);
	});

	test("names every missing def in one error", () => {
		const schema: JsonSchema = {
			$defs: {
				DATA_EVY_Foo: { type: "object" },
				DATA_EVY_Bar: { type: "object" },
			},
		};

		expect(() =>
			validateEveryDataDefHasATable(schema, { tables: {} }),
		).toThrow(/DATA_EVY_Foo.*DATA_EVY_Bar|DATA_EVY_Bar.*DATA_EVY_Foo/);
	});

	test("passes when the def has a table", () => {
		const config: DrizzleConfig = {
			tables: { DATA_EVY_Foo: tableConfig("Foo") },
		};

		expect(() =>
			validateEveryDataDefHasATable(schemaWithFoo, config),
		).not.toThrow();
	});

	test("passes when the def is explicitly exempt", () => {
		const config: DrizzleConfig = {
			tables: {},
			nonTableDefs: ["DATA_EVY_Foo"],
		};

		expect(() =>
			validateEveryDataDefHasATable(schemaWithFoo, config),
		).not.toThrow();
	});

	test("ignores defs outside the DATA_EVY_ namespace", () => {
		const schema: JsonSchema = {
			$defs: { Visibility: { enum: ["public"] } },
		};

		expect(() =>
			validateEveryDataDefHasATable(schema, { tables: {} }),
		).not.toThrow();
	});

	test("treats an enum-backed def as covered", () => {
		const schema: JsonSchema = {
			$defs: { DATA_EVY_Kind: { enum: ["a"] } },
		};
		const config: DrizzleConfig = {
			tables: {},
			enums: { DATA_EVY_Kind: { name: "kind" } },
		};

		expect(() =>
			validateEveryDataDefHasATable(schema, config),
		).not.toThrow();
	});

	test("rejects an exemption for a def that does not exist", () => {
		const config: DrizzleConfig = {
			tables: { DATA_EVY_Foo: tableConfig("Foo") },
			nonTableDefs: ["DATA_EVY_Ghost"],
		};

		expect(() =>
			validateEveryDataDefHasATable(schemaWithFoo, config),
		).toThrow(/DATA_EVY_Ghost.*not \$defs/);
	});
});

describe("assertDrizzleConfig", () => {
	test("rejects a non-array nonTableDefs", () => {
		expect(() =>
			assertDrizzleConfig({ nonTableDefs: "DATA_EVY_RowData" }),
		).toThrow(/nonTableDefs must be an array of strings/);
	});

	test("rejects non-string entries in nonTableDefs", () => {
		expect(() => assertDrizzleConfig({ nonTableDefs: [42] })).toThrow(
			/nonTableDefs must be an array of strings/,
		);
	});

	test("accepts a valid nonTableDefs", () => {
		expect(() =>
			assertDrizzleConfig({ nonTableDefs: ["DATA_EVY_RowData"] }),
		).not.toThrow();
	});
});

describe("the checked-in schema and config", () => {
	test("agree with each other", async () => {
		const schema = (await Bun.file(
			new URL("../types/schema/data/data.schema.json", import.meta.url),
		).json()) as JsonSchema;
		const config = await Bun.file(
			new URL(
				"../types/schema/data/drizzle.config.json",
				import.meta.url,
			),
		).json();

		assertDrizzleConfig(config);
		expect(() =>
			validateEveryDataDefHasATable(schema, config),
		).not.toThrow();
	});
});
