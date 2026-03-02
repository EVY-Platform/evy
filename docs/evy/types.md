# Data types and type generation

## Built-in types used on EVY

```
uuid
string
enum
int
float
boolean
timestamp
```

- Types have strict validation at the database level (e.g. UUID must match UUID v4 format; timestamp must be a valid unix timestamp).
- **number** = int or float (wrapper used in docs/specs).

---

## Schema-first type generation

Types consumed by the API, web app, and iOS are generated from JSON Schema and related config. The source of truth lives under the repo root in `types/schema/`.

### Sources

| Path / pattern | Purpose |
|----------------|--------|
| `types/schema/**/*.schema.json` | JSON Schema for SDUI, RPC, and data models. Used to generate TypeScript and Swift. |
| `types/schema/sdui/row-content.spec.json` | Per–row-type content/view keys for SDUI. Used by the Swift SDUI generator only. |
| `types/schema/data/data.schema.json` | API persistence models (DATA_Flow, DATA_Device, etc.). |
| `types/schema/data/drizzle.config.json` | Drizzle table names, primary keys, enums, relations. Must stay in sync with `data.schema.json`. |

### Command

From the **repo root**:

```bash
bun run types:generate
```

This runs:

1. **`scripts/generate-types.ts`** — Emits TypeScript under `types/generated/ts/` and Swift under `types/generated/swift/` from `*.schema.json`. For SDUI Swift it also runs `scripts/generate-swift-sdui.ts`, which uses `evy.schema.json` and `row-content.spec.json`.
2. **`scripts/generate-drizzle.ts`** — Emits `types/generated/ts/db/schema.generated.ts` from `data.schema.json` and `drizzle.config.json`.

### Outputs (do not edit by hand)

- `types/generated/ts/` — TypeScript types and Drizzle schema. The API and web app import these via the `evy-types` path alias.
- `types/generated/swift/` — Swift types. The iOS app references these (and keeps some Codable models in sync manually where needed).

After changing any schema or `drizzle.config.json` or `row-content.spec.json`, run `bun run types:generate` and commit the updated generated files.
