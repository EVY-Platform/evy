/**
 * Derives bindable attribute names from a resource's JSON schema.
 *
 * The builder needs to know what `{item.price.currency}` can resolve to. It
 * used to guess by walking whatever rows happened to have synced, which meant
 * an empty resource offered nothing and a sparse row hid its own fields.
 * Deriving the list from the schema instead keeps the manifest honest: the
 * attributes a service advertises are exactly the ones it validates.
 */

/** Matches the builder's own nesting limit for interpolation paths. */
const MAX_DEPTH = 5;

type Schema = Record<string, unknown>;

function isSchema(value: unknown): value is Schema {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolves a local `#/$defs/Name` pointer against the root schema. Only local
 * refs are supported: a service schema that reaches outside its own file would
 * reintroduce the cross-package coupling this whole arrangement removes.
 */
function resolveRef(root: Schema, ref: string): Schema | undefined {
	if (!ref.startsWith("#/")) return undefined;
	let node: unknown = root;
	for (const rawSegment of ref.slice(2).split("/")) {
		const segment = rawSegment.replace(/~1/g, "/").replace(/~0/g, "~");
		if (!isSchema(node)) return undefined;
		node = node[segment];
	}
	return isSchema(node) ? node : undefined;
}

function deref(root: Schema, schema: Schema, seen: Set<string>): Schema {
	const ref = schema.$ref;
	if (typeof ref !== "string" || seen.has(ref)) return schema;
	const resolved = resolveRef(root, ref);
	if (!resolved) return schema;
	// Track the ref on this branch only, so a self-referential $def terminates
	// while a type used twice in different places still expands in both.
	return deref(root, resolved, new Set([...seen, ref]));
}

function collect(
	root: Schema,
	schema: Schema,
	prefix: string,
	depth: number,
	seenRefs: Set<string>,
	out: Set<string>,
): void {
	if (depth > MAX_DEPTH) return;

	const properties = schema.properties;
	if (!isSchema(properties)) return;

	for (const [key, rawChild] of Object.entries(properties)) {
		if (!key.trim() || !isSchema(rawChild)) continue;

		const path = prefix ? `${prefix}.${key}` : key;
		out.add(path);

		const child = deref(root, rawChild, seenRefs);
		// Arrays are leaves: their items are addressed by index at runtime, not
		// by a static attribute path.
		if (isSchema(child.properties)) {
			const childRef =
				typeof rawChild.$ref === "string" ? rawChild.$ref : null;
			collect(
				root,
				child,
				path,
				depth + 1,
				childRef ? new Set([...seenRefs, childRef]) : seenRefs,
				out,
			);
		}
	}
}

/**
 * Dotted attribute paths for every field the schema knows about, sorted for a
 * stable manifest.
 */
export function attributesFromSchema(schema: object): string[] {
	if (!isSchema(schema)) return [];
	const out = new Set<string>();
	collect(schema, schema, "", 1, new Set(), out);
	return [...out].toSorted((a, b) => a.localeCompare(b));
}
