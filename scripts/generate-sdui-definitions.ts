import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import {
	assertExactSduiRowTypeCoverage,
	extractSduiRowTypeEnum,
	loadSduiRowDefinitions,
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

async function getRowTypeEnum(): Promise<string[]> {
	const schema = await loadJson<SchemaObject>(UI_SCHEMA_PATH);
	const values = extractSduiRowTypeEnum(schema);
	if (values.length === 0) {
		throw new Error("sdui/evy.schema.json: UI_Row type enum not found");
	}
	return values;
}

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

function generateTypeScript(definitions: SduiRowDefinition[]): string {
	const catalog = Object.fromEntries(
		definitions.map((definition) => [definition.type, definition.schema]),
	);
	const lines: string[] = [];
	lines.push(...generatedFileHeader(SOURCE_LABEL));
	lines.push(
		`export const SDUI_DEFINITIONS: Record<string, unknown> = ${JSON.stringify(catalog, null, "\t")};`,
	);
	lines.push("");
	return lines.join("\n");
}

function generateSwift(definitions: SduiRowDefinition[]): string {
	const catalog = Object.fromEntries(
		definitions.map((definition) => [definition.type, definition.schema]),
	);
	const json = JSON.stringify(catalog, null, 2);
	const lines: string[] = [];
	lines.push(...generatedSwiftHeader(SOURCE_LABEL));
	lines.push("import Foundation");
	lines.push("");
	lines.push("enum SduiDefinitions {");
	lines.push('\tstatic let json = #"""');
	lines.push(json);
	lines.push('"""#');
	lines.push("}");
	lines.push("");
	return lines.join("\n");
}

async function main(): Promise<void> {
	const definitions = await loadSduiRowDefinitions();
	await validateDefinitionSchemas(definitions);
	assertExactSduiRowTypeCoverage(definitions, await getRowTypeEnum());
	await writeGeneratedOutputs({
		tsPath: OUT_TS_PATH,
		tsContent: generateTypeScript(definitions),
		swiftPath: OUT_SWIFT_PATH,
		swiftContent: generateSwift(definitions),
	});
}

runMain(main);
