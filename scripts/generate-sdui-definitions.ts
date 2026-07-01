import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import {
	assertExactSduiRowTypeCoverage,
	extractSduiRowTypeEnum,
	loadSduiRowDefinitions,
	rowFieldsFromDefinitions,
	type SduiRowDefinition,
} from "./sdui-row-schema-utils.js";
import {
	generatedFileHeader,
	generatedSwiftHeader,
	loadJson,
	OUT_SWIFT,
	OUT_TS,
	runMain,
	SCHEMA_DIR,
	writeGeneratedOutputs,
} from "./types-generation-utils.js";

const DEFINITION_SCHEMA_PATH = join(
	SCHEMA_DIR,
	"sdui",
	"definition.schema.json",
);
const UI_SCHEMA_PATH = join(SCHEMA_DIR, "sdui", "evy.schema.json");
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

export async function validateDefinitionSchemas(
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

export function emitSduiDefinitions(definitions: SduiRowDefinition[]): {
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
	tsLines.push(
		`export type RowFieldSpecKind = "text" | "textList" | "child" | "children" | "binding";`,
	);
	tsLines.push("");
	tsLines.push(`export type RowFieldSpec = {`);
	tsLines.push(`\tname: string;`);
	tsLines.push(`\tkind: RowFieldSpecKind;`);
	tsLines.push(`\trequired: boolean;`);
	tsLines.push(`};`);
	tsLines.push("");
	tsLines.push(
		`export const SDUI_ROW_FIELDS: Record<string, RowFieldSpec[]> = ${JSON.stringify(rowFields, null, "\t")};`,
	);
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

async function main(): Promise<void> {
	const definitions = await loadSduiRowDefinitions();
	await validateDefinitionSchemas(definitions);
	const schema = await loadJson<SchemaObject>(UI_SCHEMA_PATH);
	const rowTypes = extractSduiRowTypeEnum(schema);
	if (rowTypes.length === 0) {
		throw new Error("sdui/evy.schema.json: UI_Row type enum not found");
	}
	assertExactSduiRowTypeCoverage(definitions, rowTypes);
	const { tsContent, swiftContent } = emitSduiDefinitions(definitions);
	await writeGeneratedOutputs({
		tsPath: OUT_TS_PATH,
		tsContent,
		swiftPath: OUT_SWIFT_PATH,
		swiftContent,
	});
}

if (import.meta.main) {
	runMain(main);
}
