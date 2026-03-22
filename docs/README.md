# EVY Docs

## Schema and type generation workflow

Cross-platform types and the API database schema are generated from JSON Schema and config under the repo root. **Do not edit generated files by hand.**

- `bun run types:generate` will run `scripts/generate-types.ts` then `scripts/generate-drizzle.ts`
- `generate-types.ts` reads `types/schema/**/*.schema.json` and outputs TypeScript types in `types/generated/ts/` and Swift classes in `types/generated/swift/`
- `generate-drizzle.ts` reads `types/schema/data/data.schema.json` + `drizzle.config.json`  and outputs `types/generated/ts/db/schema.generated.ts`

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
