# Data types

```
uuid
string
enum
integer
number
boolean
date-time (string)
```

- Relational columns generated for Postgres enforce UUID, enums, booleans, and (where defined) `integer` vs `number` column types. **Instants** (`createdAt`, `updatedAt`, etc.) use JSON Schema `string` + `format: "date-time"` and are stored in Postgres as **`text`** containing an **ISO 8601 / RFC 3339** value (e.g. `2024-01-19T12:00:00.000Z`), not as Unix timestamps and not as SQL `timestamp` columns. JSON stored in `jsonb` is validated at the API layer, not by Postgres row types.
- **`integer`**: whole numbers only (no fractional part). On the API, values must satisfy `Number.isInteger` after JSON parse.
- **`number`**: decimal-capable numeric values; integer literals (e.g. `3`) are allowed. On the API, values must be finite (`number` JSON values; rejects `NaN` / `Infinity`).
- **TypeScript generated from JSON Schema** often maps both `integer` and `number` to TS `number`. Runtime rules above (API / DB) are the source of truth when the distinction matters.

---

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

After changing any schema or `drizzle.config.json` or `row-content.spec.json`, run `bun run types:generate` and commit the updated generated files under `types/generated/`.