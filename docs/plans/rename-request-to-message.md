# Rename the `Request` data type to `Message`

Rename the core data entity `DATA_EVY_Request` (and its `requests` marketplace resource) to `DATA_EVY_Message` / `messages`. This is the generic record type introduced in commit `6f7a02d9` ("Generic DATA_EVY_Request core type") — an envelope (`id`, `fk`, `service`, `resource`, `archivedAt`, `createdAt`, free-form `data`) persisted by the marketplace service in the generic `Data` table.

## Scope boundaries — read before touching anything

**In scope** — the data entity and its resource:

- Schema title `DATA_EVY_Request`, schema file `types/schema/data/request.schema.json` (`$id: "request"`)
- Marketplace resource key `"requests"` in `types/schema/resources/marketplace.resources.json` (UUID `000c2d05-851e-4456-8f22-bb1e54f17c8c` — **keep the UUID unchanged**, it is the stable identifier; only the human-readable key changes)
- Generated constants derived from the above (`MARKETPLACE_RESOURCE.REQUESTS`, Swift `MarketplaceResource.requests`, `DATA_EVY_Request` TS interface, `DataRequest` Swift struct)
- Seed/fixture keys (`"requests"` array in fixtures, seed resource name `"request"`)
- Test identifiers and docs that refer to the entity/resource

**Out of scope — do NOT rename:**

1. **RPC-level request types.** `ApiRequest`, `CreateRequest`, `UpdateRequest`, `DeleteRequest`, `GetRequest`, `SyncRequest`, `PlaceSearchRequest`, everything under `types/schema/rpc/*.request.schema.json`, and all the `validate*Request` / `requestAjv` plumbing in [validators.ts](types/validators.ts). These are HTTP/RPC requests, unrelated to the data entity.
2. **HTTP-level Swift code.** `URLRequest` usage, `EVYWebsocket.swift`, `EVYSearchRequesting.swift`, `EVYSearchModel.swift` — network requests, not the entity.
3. **User-facing copy.** Labels/subtitles like `"Cancel request"`, `"Request {formatDatetime(...)}"`, `"pickup request"`, `"You are about to request to pickup …"` in `scripts/fixtures/services/service_sdui.json`, `ios/e2e/e2e.swift` (SDUI payload builders + assertions), `ios/evyTests/interpreterTests.swift:109`, and the doc-comment example in `ios/evy/UI/Views/EVYButton.swift:48`. This is product wording about pickup/delivery requests and stays as-is. (If the product wording should also change, that is a separate decision — this plan does not assume it.)
4. **Incidental English.** e.g. "rejects requests without an API method" in `api/src/tests/rpcApi.test.ts`, "requested path" doc comments in `EVY+Mutations.swift` / `EVYData.swift`.

**Name collision check:** no existing `Message` type exists in `types/schema` or the marketplace service (only `rpc.ts` mentions "message" in the JSON-RPC sense), so the new names are free.

## How generation works (context)

- `bun run types:generate` (root [package.json](package.json)) runs [generate-types.ts](scripts/generate-types.ts) then the resources generators. It **wipes** `types/generated/ts` and `types/generated/swift` before regenerating (`rm recursive` at generate-types.ts:321-323), so stale `request.ts` / `DataRequest.swift` disappear automatically once the schema file is renamed.
- TS interface name comes from the schema `title`; file/module names come from the schema file path (`data/request.schema.json` → `ts/data/request.ts`, Swift `DataRequest.swift`).
- [generate-marketplace-resources.ts](scripts/generate-marketplace-resources.ts) turns `marketplace.resources.json` keys into `MARKETPLACE_RESOURCE.<UPPER_KEY>` (TS) and `MarketplaceResource.<camelKey>` (Swift enum cases).
- The generated `DataRequest.swift` is **not** referenced in `ios/evy.xcodeproj/project.pbxproj` (only `SduiDefinitions`, `CoreResources`, `MarketplaceResources` generated files are compiled), so **no Xcode project changes are needed** — `MarketplaceResources.generated.swift` keeps its filename, only its enum case changes.
- `types/validators.ts` does **not** import `data/request.schema.json` (no validator exists for this entity) — no validator changes needed.

## File map

| File | Change |
|---|---|
| `types/schema/data/request.schema.json` | `git mv` → `message.schema.json`; `title` → `DATA_EVY_Message`; `$id` → `"message"` |
| `types/schema/resources/marketplace.resources.json` | key `"requests"` → `"messages"` (UUID unchanged) |
| `types/generated/**` | regenerated, not hand-edited (`ts/data/message.ts`, `ts/index.ts`, `ts/marketplaceResources.ts`, `swift/DataMessage.swift`, `swift/MarketplaceResources.generated.swift`) |
| `scripts/seed.ts` | line 127 `requests: MARKETPLACE_RESOURCE.REQUESTS` → `messages: MARKETPLACE_RESOURCE.MESSAGES`; line 369 resource spec `"request"` → `"message"` |
| `scripts/fixtures/services/service_data.json` | top-level `"requests"` array key (line 232) → `"messages"` |
| `services/marketplace/src/tests/data.test.ts` | `MARKETPLACE_RESOURCE.REQUESTS` → `.MESSAGES`; rename local `requests`/`request*` variables and test descriptions that refer to the entity |
| `services/marketplace/e2e/e2e.test.ts` | `MARKETPLACE_REQUESTS_RESOURCE_ID` → `MARKETPLACE_MESSAGES_RESOURCE_ID`; `.REQUESTS` → `.MESSAGES`; local `request`/`requestId` vars; "creates generic marketplace requests" test name |
| `api/src/tests/sync.test.ts` | lines 45, 139: `MARKETPLACE_RESOURCE.REQUESTS` → `.MESSAGES` |
| `ios/evy/UI/EVYActionRunner.swift` | line 103 error-message example `update(marketplace,requests,…)` → `update(marketplace,messages,…)` |
| `ios/evyTests/ContentViewTests.swift` | line 12 `MarketplaceTestFixture.requestsResourceId` → `messagesResourceId`, `.requests` → `.messages` |
| `ios/evyTests/EVYActionRunnerTests.swift` | fixture references, `requestsResourceId`/`activeRequestId`-style locals, `requests` JSON arrays, entity-referring test names (e.g. `testUpdateActionArchivesOnlyMatchingActiveRequest`) |
| `ios/evyTests/interpreterTests.swift` | `uniqueKey("requests")` keys + `requestsKey` locals + entity-referring test names (lines ~768-820). Keep line 109 (`"Request {formatDatetime…"` is UI copy) |
| `ios/evyTests/EVYDataPatcherTests.swift` | `request` local + "expected synced request dictionary" message (lines ~55-62) |
| `ios/e2e/e2e.swift` | `MarketplaceResource.requests` → `.messages`; `requestsResourceId`/`requestEnvelope`-style locals; SDUI-builder function names like `cancelRequestVisibilityExpressions`/`viewItemCancelRequestFlowData` only where they refer to the entity. Keep UI-copy strings and label assertions (`"Cancel request"`, `"Request "` button predicate, `tapConfirmationSheetRequestButton`) unchanged. Keep JSON-RPC `requestId` (line ~272) — that's RPC |
| `docs/evy/data.md` | `#### DATA_EVY_Request` section (lines 182-196): heading, prose, schema link → `message.schema.json`, resource name `requests` → `messages` |
| `docs/evy/functions.md` | `findFirst(requests, …)` example + surrounding prose (lines ~68-74) |
| `docs/services/marketplace/data.md` | `## Requests` section (~line 28-40): heading → `## Messages`, resource name, `DATA_EVY_Request` link + anchor `#data_evy_request` → `#data_evy_message` |
| `docs/evy/sdui.md` | no `request` matches remain — verify with grep, no edit expected |

Note on seeded data: the marketplace stores rows in the generic `Data` table ([db.ts](services/marketplace/src/db.ts)), so there is **no SQL migration**. The only data-level change is the `ServiceResource` row name `"request"` → `"message"` seeded by `scripts/seed.ts` — re-running `bun run db:seed` applies it to the dev DB.

## Steps

Work happens on the current branch `feat/generic-request-type` (or a new branch off it — engineer's choice).

### Phase 1 — schema + generation

1. `git mv types/schema/data/request.schema.json types/schema/data/message.schema.json`.
2. Edit `types/schema/data/message.schema.json`: `"$id": "message"`, `"title": "DATA_EVY_Message"`.
3. In `types/schema/resources/marketplace.resources.json`, rename the `"requests"` key to `"messages"` (leave the UUID value untouched).
4. Run `bun run types:generate`.
5. Verify the generated output: `types/generated/ts/data/message.ts` exports `DATA_EVY_Message`; `types/generated/ts/data/request.ts` is gone; `types/generated/ts/index.ts` exports `./data/message`; `types/generated/ts/marketplaceResources.ts` has `MESSAGES:`; `types/generated/swift/DataMessage.swift` exists and `DataRequest.swift` is gone; `MarketplaceResources.generated.swift` has `case messages = "000c2d05-…"`. `git status` should show only expected renames/changes under `types/generated`.

### Phase 2 — TypeScript consumers

6. Update `scripts/seed.ts` (two sites: the `MARKETPLACE_SEED_RESOURCE_KEY_TO_ID` map and the `SERVICE_RESOURCE_SPECS` entry).
7. Update `scripts/fixtures/services/service_data.json`: rename the top-level `"requests"` array key to `"messages"`. Do not touch the row contents (UUIDs stay).
8. Update `services/marketplace/src/tests/data.test.ts`, `services/marketplace/e2e/e2e.test.ts`, `api/src/tests/sync.test.ts` per the file map.
9. Sweep for stragglers: `grep -rn "MARKETPLACE_RESOURCE.REQUESTS\|DATA_EVY_Request\|\"requests\"" --include="*.ts" --include="*.json" api web services scripts types | grep -v node_modules | grep -v generated` — should return nothing.
10. Lint/typecheck: `bunx biome check .` at root, plus `bun run --cwd services/marketplace lint`.
11. Run TS tests. Postgres must be up and seeded first: `bun run dev:setup` (starts `docker compose up --wait postgres` + `bun run db:seed` — the reseed also fixes the renamed ServiceResource row). Then `bun run --cwd services/marketplace test:unit` and, with the stack running (`bun run dev` or at least api + marketplace), `bun run --cwd services/marketplace test:e2e`. All must pass.

### Phase 3 — iOS

12. Update `ios/evy/UI/EVYActionRunner.swift:103` (error-message example only).
13. Update `ios/evyTests/ContentViewTests.swift`, `EVYActionRunnerTests.swift`, `interpreterTests.swift`, `EVYDataPatcherTests.swift` per the file map. Rule of thumb per hit: entity/resource identifier → rename; UI-copy string or HTTP concept → keep.
14. Update `ios/e2e/e2e.swift` per the file map (same rule of thumb; ~140 hits, most are UI copy and stay).
15. Sweep: `grep -rn -i "MarketplaceResource.requests\|requestsResourceId\|DataRequest" ios --include="*.swift"` — should return nothing.
16. Build + run iOS unit tests from `ios/` with `xcodebuild` (see `docs`/existing CI for the exact scheme). **Caveats from prior sessions:** the evyTests suite fires real create RPCs at `localhost:8000`, so the docker stack must be up and seeded first, and the dev DB should be reseeded (`bun run db:seed`) after the run to clear junk rows. Async XCUITests have crashed the Xcode 26 runner before — run the e2e suite the same way it's run in `run-e2e.sh`.

### Phase 4 — docs + finish

17. Update `docs/evy/data.md`, `docs/evy/functions.md`, `docs/services/marketplace/data.md` per the file map; grep `docs/` for `DATA_EVY_Request`, `#data_evy_request`, and `` `requests` `` to confirm nothing is left.
18. Final repo-wide sweep: `grep -rn "DATA_EVY_Request" . --include="*.ts" --include="*.swift" --include="*.json" --include="*.md" | grep -v node_modules` — must be empty.
19. `bun run format` (runs biome across workspaces + `swift-format` on `ios/`).
20. Commit. Suggested message: `Rename DATA_EVY_Request core type to DATA_EVY_Message`. Keep the fixture/seed rename in the same commit as the resource-key rename — they break each other if split.

## Risks / gotchas

- **Order matters within Phase 1-2:** regenerating types (step 4) removes `MARKETPLACE_RESOURCE.REQUESTS`, breaking TS compilation until steps 6-8 land. Do not run tests between steps 4 and 8.
- **The resource UUID is the wire/DB identifier.** Fixtures, SDUI actions, and existing dev-DB rows reference `000c2d05-…` directly, which is why it must not change. Only human-readable keys change.
- **`service_sdui.json` needs no edit**: it references the resource by UUID, and its other "request" hits are user-facing copy.
- **`grep -i request` is a trap** — the repo has hundreds of legitimate RPC/HTTP/copy hits. Use the specific patterns given in steps 9, 15, and 18 rather than a blanket rename.
