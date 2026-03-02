# EVY Docs

## Schema and type generation workflow

Cross-platform types and the API database schema are generated from JSON Schema and config under the repo root. **Do not edit generated files by hand.**

| Step | Command / input | Output |
|------|-----------------|--------|
| 1 | From repo root: `bun run types:generate` | Runs `scripts/generate-types.ts` then `scripts/generate-drizzle.ts` |
| 2 | `generate-types.ts` reads `types/schema/**/*.schema.json` | TypeScript in `types/generated/ts/`, Swift in `types/generated/swift/` |
| 3 | SDUI Swift | `evy.schema.json` + `types/schema/sdui/row-content.spec.json` → `generate-swift-sdui.ts` → Swift SDUI enums and structs |
| 4 | `generate-drizzle.ts` reads `types/schema/data/data.schema.json` + `drizzle.config.json` | `types/generated/ts/db/schema.generated.ts` (Drizzle table/enum definitions) |

**File conventions:**

- **`*.schema.json`** — JSON Schema files. Discovered by `generate-types.ts` for TypeScript and Swift (except `sdui/evy.schema.json`, which is handled by `generate-swift-sdui.ts` with the row spec).
- **`types/schema/data/drizzle.config.json`** — Drizzle table names, primary keys, enums, relations. Must reference only defs and properties that exist in `data.schema.json`.
- **`types/schema/sdui/row-content.spec.json`** — Per–row-type content and view keys for SDUI. Used by `generate-swift-sdui.ts` to emit Swift row payloads.

After changing any schema or config under `types/schema/`, run `bun run types:generate` from the repo root and commit changes under `types/generated/`.

---

### Docs

Documentation is available at the global EVY level as well as per services provided on the platform

-   EVY
    -   [Types Docs](./evy/types.md)
    -   [Data models Docs](./evy/sddata/data.md)
    -   [Functions Docs](./evy/sddata/functions.md)
    -   [Server Driven UI Docs](./evy/sdui/readme.md)
-   Marketplace
    -   [Data models Docs](./services/marketplace/data.md)
    -   [Example data](./services/service_data.json)
    -   [Example SDUI for view & create item pages](./services/service_sdui.json)

### iOS

-   [iOS docs](../ios/README.md)

### Web

-   [Web docs](../web/README.md)
