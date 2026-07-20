import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import {
	assertExactSduiRowTypeCoverage,
	extractSduiRowTypeEnum,
	loadSduiRowDefinitions,
	rowFieldSpecTsSource,
	rowSpecificAttributesTsSource,
	rowFieldsFromDefinitions,
	type SduiRowDefinition,
} from "./sdui-row-schema-utils.js";
import {
	generatedFileHeader,
	generatedSwiftHeader,
	loadJson,
	OUT_SWIFT,
	OUT_TS,
	SCHEMA_DIR,
	writeGeneratedOutputs,
} from "./types-generation-utils.js";

const DEFINITION_SCHEMA_PATH = join(
	SCHEMA_DIR,
	"sdui",
	"definition.schema.json",
);
const UI_SCHEMA_PATH = join(SCHEMA_DIR, "sdui", "evy.schema.json");
const DATA_SCHEMA_PATH = join(SCHEMA_DIR, "data", "data.schema.json");
const OUT_TS_PATH = join(OUT_TS, "sdui", "definitions.generated.ts");
const OUT_SWIFT_PATH = join(OUT_SWIFT, "SduiDefinitions.generated.swift");
const SOURCE_LABEL = "types/schema/sdui/definitions/";

type SchemaObject = Record<string, unknown>;

function formatAjvErrors(errors: Ajv2020["errors"] | null | undefined): string {
	return (errors ?? [])
		.map((error) =>
			`${error.instancePath || "/"} ${error.message ?? ""}`.trim(),
		)
		.join("; ");
}

async function validateDefinitionSchemas(
	definitions: SduiRowDefinition[],
): Promise<void> {
	const definitionSchema = await loadJson<SchemaObject>(
		DEFINITION_SCHEMA_PATH,
	);
	const ajv = new Ajv2020({ allErrors: true, strict: false });
	const validateConvention = ajv.compile(definitionSchema);
	for (const definition of definitions) {
		if (!ajv.validateSchema(definition.schema)) {
			throw new Error(
				`${SOURCE_LABEL}${definition.type}.schema.json failed schema validation: ${formatAjvErrors(ajv.errors)}`,
			);
		}
		if (!validateConvention(definition.schema)) {
			throw new Error(
				`${SOURCE_LABEL}${definition.type}.schema.json failed SDUI definition validation: ${formatAjvErrors(validateConvention.errors)}`,
			);
		}
	}
}

function emitSduiDefinitions(definitions: SduiRowDefinition[]): {
	tsContent: string;
	swiftContent: string;
} {
	const catalog = Object.fromEntries(
		definitions.map((definition) => [definition.type, definition.schema]),
	);
	const rowFields = rowFieldsFromDefinitions(definitions);
	const tsLines: string[] = [];
	tsLines.push(...generatedFileHeader(SOURCE_LABEL));
	tsLines.push(
		`export const SDUI_DEFINITIONS: Record<string, unknown> = ${JSON.stringify(catalog, null, "\t")};`,
	);
	tsLines.push("");
	tsLines.push(...rowFieldSpecTsSource());
	tsLines.push("");
	tsLines.push(
		`export const SDUI_ROW_FIELDS: Record<string, RowFieldSpec[]> = ${JSON.stringify(rowFields, null, "\t")};`,
	);
	tsLines.push("");
	tsLines.push(...rowSpecificAttributesTsSource(definitions));
	tsLines.push("");

	const json = JSON.stringify(catalog, null, 2);
	const swiftLines: string[] = [];
	swiftLines.push(...generatedSwiftHeader(SOURCE_LABEL));
	swiftLines.push("import Foundation");
	swiftLines.push("");
	swiftLines.push("enum SduiDefinitions {");
	swiftLines.push('\tstatic let json = #"""');
	swiftLines.push(json);
	swiftLines.push('"""#');
	swiftLines.push("}");
	swiftLines.push("");

	return {
		tsContent: tsLines.join("\n"),
		swiftContent: swiftLines.join("\n"),
	};
}

/**
 * The row-type list is maintained in three hand-written places; fail
 * generation if any of them drift from the UI_RowBase enum:
 * - sdui/evy.schema.json UI_Row.oneOf (one ref per definition schema)
 * - data/data.schema.json DATA_EVY_Row.properties.type.enum
 */
function assertRowTypeListsMatch(
	uiSchema: SchemaObject,
	dataSchema: SchemaObject,
	rowTypes: string[],
): void {
	const expected = [...rowTypes].sort();

	const uiDefs = uiSchema.$defs as Record<string, SchemaObject>;
	const oneOf = (uiDefs.UI_Row?.oneOf ?? []) as { $ref?: string }[];
	const oneOfTypes = oneOf
		.map((entry) =>
			(entry.$ref ?? "").replace(/^definitions\//, "").replace(
				/\.schema\.json$/,
				"",
			),
		)
		.sort();
	if (JSON.stringify(oneOfTypes) !== JSON.stringify(expected)) {
		throw new Error(
			`sdui/evy.schema.json: UI_Row.oneOf refs do not match the UI_RowBase type enum (oneOf: ${oneOfTypes.join(", ")}; enum: ${expected.join(", ")})`,
		);
	}

	const dataDefs = dataSchema.$defs as Record<string, SchemaObject>;
	const dataRowProps = dataDefs.DATA_EVY_Row?.properties as
		| Record<string, { enum?: string[] }>
		| undefined;
	const dataEnum = [...(dataRowProps?.type?.enum ?? [])].sort();
	if (JSON.stringify(dataEnum) !== JSON.stringify(expected)) {
		throw new Error(
			`data/data.schema.json: DATA_EVY_Row.properties.type.enum does not match the UI_RowBase type enum (data: ${dataEnum.join(", ")}; enum: ${expected.join(", ")})`,
		);
	}
}

export async function generateSduiDefinitions(): Promise<void> {
	const definitions = await loadSduiRowDefinitions();
	await validateDefinitionSchemas(definitions);
	const schema = await loadJson<SchemaObject>(UI_SCHEMA_PATH);
	const rowTypes = extractSduiRowTypeEnum(schema);
	if (rowTypes.length === 0) {
		throw new Error("sdui/evy.schema.json: UI_Row type enum not found");
	}
	assertExactSduiRowTypeCoverage(definitions, rowTypes);
	assertRowTypeListsMatch(
		schema,
		await loadJson<SchemaObject>(DATA_SCHEMA_PATH),
		rowTypes,
	);
	const { tsContent, swiftContent } = emitSduiDefinitions(definitions);
	await writeGeneratedOutputs({
		tsPath: OUT_TS_PATH,
		tsContent,
		swiftPath: OUT_SWIFT_PATH,
		swiftContent,
	});
}
