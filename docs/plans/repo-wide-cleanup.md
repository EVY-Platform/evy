# Repo-wide cleanup: less code, same functionality

A full audit of every project (api, services/marketplace, web, ios, types, scripts, CI/compose)
found roughly **−1,400 hand-written LOC** and **−8,000 generated LOC** removable with identical
functionality, plus layering fixes (17 circular import chains in web, upward Data→Core reads in
iOS, one procedures↔data cycle in api) and a handful of drift risks where the same list/constant
is maintained in 2–3 places.

Every task below is behavior-preserving unless it sits in the **Decisions needed** section.
Tasks are grouped into phases ordered by risk (dead-code deletion first, structural moves last).
Phases are independent unless a dependency is called out; within a phase, tasks are independent.

## How to verify (used by every task)

Run the subset relevant to the code you touched, from the repo root unless noted:

| Scope | Commands |
|---|---|
| Regenerate types | `bun run types:generate` (wipes and rebuilds `types/generated/`) |
| api | `cd api && bun run build && bun run lint && bun run test:unit` |
| marketplace | `cd services/marketplace && bun run lint && bun run test:unit` |
| web | `cd web && bun run build && bun run lint && bun run test:unit && bun run test:integration` |
| e2e (TS) | `./run-e2e.sh --skip-ios` from root |
| iOS | Build with Xcode targeting iPhone 17 / iOS 26.5; keep services running and run iOS tests separately (see AGENTS.md) |
| Before finishing any PR | `bun run format` from root |

Note (from `api/README.md` / repo memory): api unit tests fire real RPCs at `localhost:8000` —
have `docker compose up postgres` + seeded DB running, and reseed (`bun run db:seed`) after test
runs that create junk rows.

PR naming per AGENTS.md: prefix `[REFACTOR]`.

---

## Decisions needed before the corresponding task (everything else can proceed)

These were found during the audit but change observable behavior or need product intent —
**do not fold them silently into a refactor PR**:

1. **`DATA_EVY_Message` has zero consumers** (`types/schema/data/message.schema.json` →
   `types/generated/ts/data/message.ts`, `DataMessage.swift` not in the Xcode target). It landed
   in commit `99200d4d` and a rename plan exists (`docs/plans/rename-request-to-message.md`), so
   it is almost certainly staged for upcoming work. **Default: keep.** Only delete if that work is
   abandoned.
2. **Upload metadata validation tightening** — replacing api's hand-rolled
   `validateUploadChunkMetadata` (`api/src/procedures/uploads.ts:42-75`) with the schema-driven
   `validateFileUploadChunkMetadata` from evy-types tightens `uploadId` from "any non-empty
   string" to uuid-format. Verify all clients (iOS `EVYAPIManager`, web) send UUIDs first.
   Task 3.6 below includes this check.
3. **Error-string changes** — `api/src/procedures/rpc.ts:43` says
   `Unknown service API method: ${params.method}` when the *service* is what's unsupported, and
   `api/src/data/data.ts:261-270` double-validates resources with two different messages. Fixing
   either changes error text; confirm no client matches on these strings (grep web + ios for the
   literals) before Task 3.7.
4. **Prod/dev compose drift** — `docker-compose.prod.yml:55-67` does not mount
   `scripts/postgres-init-marketplace.sh` (dev compose does at `docker-compose.yml:13`), so the
   marketplace DB is never auto-created in prod. Possibly intentional (pre-existing prod DB).
   Review separately; not a cleanup task.
5. **Seed singular mismatch** — `scripts/seed.ts:346-370` uses `"service_resource"` where
   `types/schema/resources/core.resources.json` says `"serviceResource"`. Either a latent bug or
   an undocumented snake_case convention. Investigate before Task 2.8 touches seed mappings.

---

# Phase 1 — Dead code, unused exports, redundant logs (zero risk)

Everything here was verified unused by repo-wide grep (including tests, codegen, Swift, and
dynamic registries). Each task: make the edits, run the verify commands for that project, commit.

## Task 1.1 — Delete dead TypeScript code

| File | Change | LOC |
|---|---|---|
| `services/marketplace/src/events.ts:28-30` | Delete `offServiceEvent` (zero references) | −3 |
| `web/app/rows/edit/photoGallerySource.ts` + `photoGallerySource.test.ts` | Delete both files — `parsePhotoIds` is only imported by its own test; `PhotoGalleryRow.tsx` renders a static placeholder | −49 |
| `web/app/components/ContainerChildren.tsx:16,23,43-49` | Remove `showPlaceholder` prop — no caller passes it, the `: null` branch is dead | −6 |
| `web/app/rows/design-system/RowLayout.tsx:7,12` | Remove `titleClassName` prop — never passed by any of the 21 row components | −3 |
| `web/app/components/BuilderAssist.tsx:338-343` | Delete `commitCandidate` wrapper (pure forward to `commitCandidateInInterpolatedEditable`) | −6 |
| `web/app/utils/dropHandler.ts:39-53,217` | Inline `getDefaultAppendIndexForPageDrop`, `buildInitialDropDispatchOptions`, and the `resolvedPageId` no-op alias | −15 |
| `web/app/rows/container/ListContainerRow.tsx:14` | Delete `child: undefined` (skipped by every consumer via `value === undefined` guards) | −1 |
| `services/marketplace/src/readiness.ts:12-18` | Delete `MarketplaceReadableDeps` type + `deps` param — injection scaffolding nothing overrides | −7 |

Steps:
1. Apply the edits above.
2. `cd web && bun run build && bun run lint && bun run test:unit && bun run test:integration`.
3. `cd services/marketplace && bun run lint && bun run test:unit` (Postgres up).
4. `bun run format` at root; commit.

## Task 1.2 — Un-export symbols only used inside their own file (TS)

Drop only the `export` keyword (code stays):

- `web/app/hooks/useDraggable.ts:32` — `draggingState` (`idleState` stays exported)
- `web/app/rows/rowFields.ts:26` — `RowFieldKind` (type)
- `web/app/rows/rowFields.ts:70` — `ROW_FIELD_PANEL_ORDER`
- `web/app/utils/idCandidates.ts:12` — `IdCandidateCategory` (type)
- `web/app/utils/childPageHelpers.ts:3` — `ActiveChildPage` (type)
- `web/app/state/contexts/FlowsContext.tsx:10` — `FlowsContextValue` (type)
- `web/app/utils/datetime.ts:28` — `splitFunctionArguments` (superseded by Task 5.3; if doing both, do 5.3 instead)
- `web/integration/flowFixtures.ts:95,111,137,146` — `createTestFlows`, `initTestFlows`, `initServiceResources`, `initResourceAttributeMetadata` (the `.pw.ts` specs import only `openAppWithTestFlows`/`openAppWithFullFlows`/`initFullFlows`)

Symbols exported *only for tests* — keep exported but add a `// exported for tests` comment so
they don't get re-flagged: `api/src/data/resources/files.ts:229` `writeFileBinary`,
`api/src/procedures/uploads.ts:17` `parseUploadChunkFrame`, `api/src/readiness.ts:10`
`assertApiReadable`, `services/marketplace/src/db.ts:15` `schema`,
`web/app/utils/urlUtils.ts:24`, `web/app/utils/decodeFlow.ts:62`,
`web/app/utils/canvasCentering.ts:2,5`, `web/app/utils/idCandidates.ts:212`,
`web/app/rows/rowFields.ts:28`.

Steps: edit → web + api + marketplace lint/build/test → format → commit.

## Task 1.3 — Delete dead Swift code

| File | Change | LOC |
|---|---|---|
| `ios/evy/UI/Views/EVYZoomableContainer.swift` | Delete file — entirely unreferenced (incl. `ZoomableScrollView` + Coordinator) | −124 |
| `ios/evy/Utils/interpreter.swift:307-319,380-395` | Delete `_rawDataFromSource` + `sourceFormatFunctions` and their only caller, the test at `ios/evyTests/interpreterTests.swift:915` | −35 |
| `ios/evy/Core/EVY+TextParsing.swift:44-46` + `ios/evy/Utils/interpreter.swift:397-403` | Delete single-arg `EVY.displayText(fromSource:)` (production-dead; only `interpreterTests.swift:923`). Delete that test | −12 |
| `ios/evy/ContentView.swift:28-54` | Delete hand-written `Hashable` extension on `ActionOperation` — all associated values are `Hashable`, synthesis is identical | −27 |
| `ios/evy/ContentView.swift:202-212` | Collapse the two byte-identical catch arms into one `catch { showError(error); loading = false }` | −10 |
| `ios/evy/Utils/functions.swift:179-199` | Delete unreachable branches in `evyFormatDimension` (integer division makes `meters == Decimal(truncatedMeters)` always true) | −12 |
| `ios/evy/Data/EVYError.swift:13,24-25` | Delete never-constructed `regexCompilationFailed` case | −4 |
| `ios/evy/Data/API/EVYWebsocket.swift:11,19-20` | Delete never-constructed `EVYRPCError.loginError` case | −4 |
| `ios/evy/Data/EVYStores.swift` | Move `EVYDataError` into `EVYDataStore.swift`, delete the stub file | −14 |

Steps:
1. Apply edits; remove `EVYZoomableContainer.swift` and `EVYStores.swift` from the Xcode project.
2. Build with Xcode (iPhone 17 / iOS 26.5); fix any stale project references.
3. Run iOS unit tests (services running per memory note; reseed dev DB afterwards).
4. Commit.

## Task 1.4 — Remove redundant logs

The repo is already lean on logs; only these merely restate an error that is surfaced elsewhere
on the same path:

- `ios/evy/UI/Views/EVYInlinePicker.swift:56` — delete `print` (same error posted to `.evyErrorOccurred` on the previous line)
- `ios/evy/UI/Views/EVYSelectPhoto.swift:288` — delete `print` (`.evyErrorOccurred` posted immediately after at `:290`)
- `ios/evy/Data/API/EVYWebsocket.swift:211` — delete `print` inside `postError` (posts the same error to the UI)
- `services/marketplace/src/index.ts:7-9` — optional: drop the `Received ${signal}, stopping…` shutdown log (restates the handler)

Keep everything else — the remaining 5 iOS `#if DEBUG` prints are the only failure signal on
their paths, and all backend/web `console.*` calls are startup/ops/error output (full inventories
are in the per-project audit sections; web has zero `console.log` in `app/`).

Steps: edit → iOS build + marketplace lint → commit (can ride along with 1.3).

## Task 1.5 — Dead CI/config entries

- `.github/workflows/web.yml:36-42` — delete the "Upload lint report" step; nothing produces `lint-report/` (`bun run lint` is plain `bunx biome check .`).
- `web/tsconfig.json` — remove `"tests/**/*"` from `include` (no `web/tests/` exists). Optionally add `integration/**/*` and `e2e/**/*`, which are currently not type-checked — verify `cd web && bunx tsc --noEmit` still passes before committing that part; if it surfaces pre-existing errors, do it as its own follow-up.
- Root `package.json:12` — the `dev` script runs both `dev:setup` (`docker compose up --wait postgres`) and `dev:postgres` (`docker compose up postgres`): a double `up` of the same service. If the second is intentional for log streaming, add a comment; otherwise remove `dev:postgres` from the `dev` line.
- `services/marketplace/package.json` — add `@types/ws` to devDependencies (`src/rpc.ts:8` type-imports from `ws`, currently resolving via a transitive dep); remove `ajv` from dependencies **only after** verifying the marketplace Docker image still builds and runs (`docker compose up --build marketplace`), since evy-types declares its own ajv dep.
- `types/package.json` — add a comment noting that its runtime deps (ajv, ajv-formats) are satisfied by root devDependencies because `types/` is never bun-installed directly (prevents someone "fixing" it).

Steps: edit → `bun install` → e2e sanity (`./run-e2e.sh --skip-ios`) → commit.

---

# Phase 2 — Codegen shrink (biggest LOC win; touches only generators + gitignored output)

All `types/generated/**` is gitignored and rebuilt by `bun run types:generate`. Verification for
every task here: regenerate, then diff the output tree against a pre-change snapshot, then build
all consumers. Take the snapshot once before starting the phase:

```bash
bun run types:generate && cp -r types/generated /tmp/generated-baseline
```

## Task 2.1 — Stop generating the 18 Swift files nothing compiles (−4,103 generated LOC)

The Xcode target (`ios/evy.xcodeproj/project.pbxproj:559-572`, Sources phase) compiles only
`DataOs`, `FilesFile`, `UIEnums`, `UIShapes`, `UIRowPayloads`, `SduiDefinitions.generated`,
`CoreResources.generated`, `MarketplaceResources.generated`. The other quicktype outputs
(`CommonJson`, `CommonRpc`, `DataData`, `DataMessage`, `DataPrimitive`, all 13 `Rpc*.swift`) are
dead, each embedding its own copy of the `JSONAny` helper, and are why Swift generation is slow
(sequential `bunx quicktype` per schema at `scripts/generate-types.ts:252-296`).

Steps:
1. In `scripts/generate-types.ts:244-250`, replace the Swift exclusion filter with an allowlist: `["data/os", "files/file"]` (the SDUI Swift files come from `generate-swift-sdui.ts`, not quicktype). Add a comment noting the `Rpc*.swift` outputs can be re-enabled if iOS ever adopts them.
2. `bun run types:generate`.
3. Diff: `diff -r /tmp/generated-baseline types/generated` — the only differences must be the 18 deleted Swift files.
4. Xcode build (nothing should reference the deleted files — verified during audit).
5. Commit.

## Task 2.2 — Stop generating the 21 dead per-definition TS files (−3,666 generated LOC)

No consumer imports `Button_Row` etc. from `types/generated/ts/sdui/definitions/*.ts`; consumers
use `UI_Row` from `sdui/evy.ts`, which already inlines all row types.

Steps:
1. In `scripts/generate-types.ts`, skip `sdui/definitions/*` in `generateTypeScript` (lines 156-207) and drop their barrel entries (lines 214-219).
2. Also exclude `sdui/definition` (the meta-schema, already Swift-excluded) from TS emission — its `SDUI_RowDefinitionSchema` output has zero consumers.
3. Regenerate; diff shows only deletions; `cd api && bun run build`, `cd web && bun run build`.
4. Commit.

## Task 2.3 — Delete the `COMMON_SCHEMA_ROOT_REF` machinery (−~110 script LOC)

`scripts/generate-types.ts:20-23, 60-110, 168-183, 263-273` exist solely to give `common/json`
and `common/rpc` standalone root types — `CommonJSON`/`CommonRPC` (TS) and
`CommonJson.swift`/`CommonRpc.swift` have **zero consumers** on any platform. Other schemas
`$ref` the common files on disk, which both compilers resolve regardless.

Steps:
1. Exclude `common/*` from TS and Swift emission; delete `buildSchemaWithRootRef`, `getRootDefinition`, `inlineDefsRefs`, and the quicktype temp-file dance.
2. Also delete the redundant barrel special-case at `generate-types.ts:220-222` (`rpc/get.request` — the generic branch emits the identical line).
3. Regenerate; diff shows only the four `common/*` outputs (+ definition.ts from 2.2) gone, everything else byte-identical; build api + web.
4. Commit.

## Task 2.4 — Generator emits synthesized Codable + a title-copy helper (−~450 generated LOC, removes a runtime round-trip)

`types/generated/swift/UIRowPayloads.swift` (1,043 lines) hand-emits `CodingKeys` +
`init(from:)` + `encode(to:)` for every payload struct even when fully synthesizable; and
`UI_Row` being an all-`let` class forces `ios/evy/UI/EVYRow.swift:150-159`
(`uiRowWithHiddenTitle`) to do a full JSON encode/decode round-trip just to blank a title.

Steps:
1. In `scripts/generate-swift-sdui.ts`, emit plain `Codable` structs when no field needs leniency; keep explicit decoding only for the lenient Int-from-String fields (`:354`).
2. Emit a generated `func with(title: String) -> UI_Row` copy helper on `UI_Row`.
3. Replace the round-trip in `ios/evy/UI/EVYRow.swift:150-159` with the new helper.
4. Regenerate; Xcode build; run iOS unit tests + e2e flows that render rows with hidden titles.
5. Commit.

## Task 2.5 — Kill enum/list drift risks in the schema pipeline

1. **Row-type enum (3 copies, 1 checked):** extend `assertExactSduiRowTypeCoverage` (`scripts/generate-sdui-definitions.ts:118`) to also assert against `types/schema/data/data.schema.json` `DATA_EVY_Row.properties.type.enum` (~lines 330-357) and the `UI_Row.oneOf` ref filenames in `types/schema/sdui/evy.schema.json` (~lines 105-170). (+~15 LOC, byte-identical output.)
2. **OS enum (3 copies):** have `scripts/generate-drizzle.ts` read enum values from `data.schema.json` `$defs.OS` instead of `drizzle.config.json` `enums.OS.values`, and assert `$defs.OS` matches `os.schema.json`.
3. **`tableOrder` hard-coding:** `scripts/generate-drizzle.ts:448-458` — derive from `Object.keys(config.tables)` (JSON key order preserved; byte-identical given current order).
4. **`RowFieldSpec` emitted as literal text:** keep one source string next to the types in `scripts/sdui-row-schema-utils.ts:289-302` and have `generate-sdui-definitions.ts:77-85` emit it, so the two can't diverge.
5. **Dead `"integer"` spec-type path:** delete from `scripts/sdui-row-schema-utils.ts:10` and the unreachable branches in `scripts/generate-swift-sdui.ts:23-24,172-173,354,373,392` (−~15 LOC).

Steps per item: edit → regenerate → diff byte-identical → run `scripts/sdui-row-schema-utils.test.ts` (`bun test scripts/`) → commit (one commit per item is fine).

## Task 2.6 — Generated Drizzle schema stops importing its own package

`scripts/generate-drizzle.ts:594-604` emits `import type { … } from "evy-types"` *inside*
`types/generated/ts/db/schema.generated.ts` — a file inside evy-types. It only works because the
imports are type-only.

Steps:
1. Emit relative imports instead: `"../data/data"`, `"../sdui/evy"`, `"../data/primitive"`.
2. Regenerate; `cd api && bun run build && bun run test:unit`; commit.

## Task 2.7 — Generate `RowSpecificAttributes` for web (removes a hand-maintained union)

`web/app/types/row.ts:18-42` hand-maintains the union of every row-specific field that already
exists in the definition schemas. `generate-sdui-definitions.ts` already has name/kind/required
per field — emit this type alongside `SDUI_ROW_FIELDS` and import it in web.

Steps: extend generator (+~20 LOC) → regenerate → replace hand-written type (−25 LOC) → `cd web && bun run build && bun run test:unit` → commit.

## Task 2.8 — Derive seed mappings instead of duplicating them

- `scripts/seed.ts:121-128` `MARKETPLACE_SEED_RESOURCE_KEY_TO_ID` is mechanically `key → MARKETPLACE_RESOURCE[resourceKey(key)]` — derive it (−8 LOC).
- `scripts/seed.ts:75-81` `marketplaceDataTable` near-copies `services/marketplace/src/db.ts:7-13`; extract the pgTable into a client-free `services/marketplace/src/schema.ts` imported by both (−7 LOC, removes a schema-drift risk).
- ⚠️ Resolve **Decision 5** (the `service_resource` singular mismatch) before touching `SERVICE_RESOURCE_SPECS`.

Steps: edit → `bun run db:seed` against a fresh dev DB → `./run-e2e.sh --skip-ios` → commit.

---

# Phase 3 — Shared backend module (api ↔ marketplace dedup, −~230 LOC)

**Design decision locked in here:** the shared home is the existing `evy-types` package (it
already ships runtime code: `env.ts`, `validators.ts`), as three new hand-written modules:

| New file | Contents | Consumers |
|---|---|---|
| `types/ws.ts` | `DATA_CHANGED_EVENT` constant; `DataChangedNotification` type (`{service, resource, operation, value}`) | api, marketplace, web (type only) |
| `types/wsServer.ts` | `emitJsonRpc(server, event, params)` (the rpc-websockets non-standard-notification workaround), `getListenPort(envVar)`, `startWsServer({host, port})`, `PG_UNIQUE_VIOLATION`, `hasDatabaseErrorCode(err, code)` (api's cause-chain-walking version), `runReadinessCli({get, label, requireSeededCheck, extraChecks?})` | api, marketplace |
| `types/wsTestHelpers.ts` | `getFreePort()`, `waitForClientOpen(client, timeoutMs)`, `createPgliteTestDatabase(schema, extensions?)` | api tests, marketplace tests/e2e |

Add matching entries to `types/package.json` `exports`. Add `rpc-websockets` to
`types/package.json` dependencies **and** root devDependencies (same convention as ajv — types'
deps resolve via root; see the comment added in Task 1.5). `@electric-sql/pglite` goes in root
devDependencies if not already resolvable.

### Task 3.1 — Create `types/ws.ts` and adopt it
1. Create the module with the constant + type.
2. Replace declarations at `api/src/shared/ws.ts:7` and `services/marketplace/src/events.ts:4`; annotate the payload builders `api/src/data/data.ts:272-284` and `services/marketplace/src/events.ts:11-22` with `DataChangedNotification`.
3. This also fixes the layering smell of `api/src/data/data.ts:22` and `api/src/procedures/services.ts:20` importing a constant from the transport file.
4. api + marketplace lint/build/test → commit.

### Task 3.2 — Create `types/wsServer.ts`, dedupe server plumbing
1. Move `emitJsonRpc` (byte-identical copies at `api/src/shared/ws.ts:19-39` and `services/marketplace/src/rpc.ts:22-42`), `getListenPort` (`ws.ts:9-15` / `rpc.ts:14-20`), and the listen-promise bootstrap (`ws.ts:45-49` / `rpc.ts:57-61` — use marketplace's flat `async` style, not api's `new Promise().then()` chain).
2. Move `PG_UNIQUE_VIOLATION` + `hasDatabaseErrorCode` from `api/src/database/db.ts:9,17-27`; collapse marketplace's inline extraction (`services/marketplace/src/data.ts:26,84-96`) to `hasDatabaseErrorCode(err, PG_UNIQUE_VIOLATION)` (this also gains the cause-chain walk marketplace was missing — strictly more correct, same happy path).
3. While editing `api/src/shared/ws.ts`, fix the wrong-shaped types at `:4-5`: `type WSServer = InstanceType<typeof Server>`, `type WSParams = IRPCMethodParams` (ripples to `api/src/index.ts:17` and `tests/notifications.test.ts`).
4. api + marketplace lint/build/test → `./run-e2e.sh --skip-ios` → commit.

### Task 3.3 — Shared readiness CLI
1. Add `runReadinessCli` to `types/wsServer.ts` (identical `--require-seeded` parsing, array-shape check, OK/exit logging from `api/src/readiness.ts:40-55` and `services/marketplace/src/readiness.ts:42-60`).
2. Each project keeps a ~10-line config call (api passes its `requireServiceWsEndpoint` loop as `extraChecks`).
3. Docker healthchecks invoke these files — verify `docker compose up --build` reports both services healthy. Commit.

### Task 3.4 — Shared test helpers
1. Create `types/wsTestHelpers.ts` from the byte-identical `getFreePort` copies (`api/src/tests/wsTestHelpers.ts:22-37`, `services/marketplace/src/tests/wsTestHelpers.ts:3-18`), `waitForClientOpen` (`api/src/tests/wsTestHelpers.ts:39-62`, duplicated inline at `services/marketplace/e2e/e2e.test.ts:27-50`), and `createPgliteTestDatabase` (`api/src/tests/wsTestHelpers.ts:95-102` vs `services/marketplace/src/tests/dbTestHelpers.ts:11-18` — parameterize the fuzzystrmatch extension marketplace adds).
2. api + marketplace unit tests + marketplace e2e → commit.

### Task 3.5 — Delete api's duplicate env helper
1. Delete `api/src/data/connection.ts` (byte-level duplicate of `types/env.ts:10-28`).
2. In `api/src/database/db.ts:5,12` and `api/drizzle.config.ts:2`, use `getPostgresConnectionUrl("DB_EVY_DATABASE")` from `evy-types/env` (marketplace already does this).
3. api build/test + `bunx drizzle-kit --config api/drizzle.config.ts check` (or equivalent) → commit.

### Task 3.6 — Replace hand-rolled upload metadata validation (⚠️ Decision 2 first)
1. Grep iOS (`EVYAPIManager`, upload call sites) and web for how `uploadId` is produced; confirm UUIDs.
2. Delete `UploadChunkMetadata` + `validateUploadChunkMetadata` (`api/src/procedures/uploads.ts:1-6,42-75`); use `validateFileUploadChunkMetadata` + the `FileUploadChunkMetadata` type from evy-types.
3. api test:unit (uploads + files suites) + an end-to-end photo upload via iOS or e2e → commit.

### Task 3.7 — Error-message polish (⚠️ Decision 3 first)
Reword `api/src/procedures/rpc.ts:43`; collapse the double resource check in
`api/src/data/data.ts:261-270` vs `:209-213`, keeping one message. api tests (they may assert
these strings — update assertions in the same commit).

---

# Phase 4 — Import hygiene & package boundaries

### Task 4.1 — api stops deep-relative-importing into types/ (17 files, mechanical)

`evy-types/db/schema.generated` already resolves via the `"./*": "./generated/ts/*.ts"` wildcard
export. Replace every `../../../../types/generated/ts/db/schema.generated` (and the `../../../`
variants) with `evy-types/db/schema.generated` in: `api/drizzle.config.ts`,
`api/src/database/db.ts:4`, `api/src/data/data.ts:20`, all 9 files in `api/src/data/resources/`,
and `api/src/tests/{wsTestHelpers,services.test,data.test,files.test,rpcApi.test}.ts`.

Steps: `grep -rn "types/generated" api --include="*.ts" | grep -v node_modules` → replace → build/test → commit.

### Task 4.2 — Make the evy-types export surface intentional

`types/package.json` mixes an exact export list with a catch-all wildcard, plus redundant
`main`/`types` fields duplicating the `"."` export.

1. Enumerate the real surface: `.`, `./validators`, `./rpcRequestHelpers`, `./env`, `./apiDataSources`, `./coreResources`, `./marketplaceResources`, `./db/schema.generated`, plus the barrel-reachable generated modules consumers actually import (grep `from "evy-types/` across api/web/services/scripts first and include exactly that set — the audit found `evy-types/data/primitive` and `evy-types/sdui/evy` used by generated code until Task 2.6 lands, so do 2.6 first).
2. Drop the wildcard and the redundant `main`/`types` fields.
3. Since exact entries now exist, delete the two 9-line wrapper re-export files `types/coreResources.ts` and `types/marketplaceResources.ts` and point their export entries at the generated files directly (move the doc comments into the generator headers).
4. Build api, web, marketplace; run `./run-e2e.sh --skip-ios`; commit.

Dependency-direction verdict from the audit, for the record: **no project imports another
sibling's internals** (web ↛ api, api ↛ marketplace, types imports nothing). The wildcard export
and api's relative paths were the only boundary leaks.

### Task 4.3 — Fix api's one internal layering violation (data → procedures)

`api/src/data/resources/files.ts:29-33` imports upload-session functions from
`../../procedures/uploads` — the only place the procedures→data direction is reversed.

1. Create `api/src/shared/uploadSessions.ts`; move the session `Map`, `getUploadSession`, `deleteUploadSession`, `uploadSessionToBuffer`, `handleUploadChunk`, and frame parsing into it (pure file move).
2. `procedures/uploads.ts` stays as the thin RPC-facing facade (`cancelUpload` + re-exports for its tests).
3. While there, split the binary-storage half of `files.ts` (lines ~44-62, 229-309: dirs, `writeFileBinary`, `readFileBinary`, delete helpers, `filePath`, `sanitizeFileId`, `hasNodeErrorCode`) into `api/src/data/resources/fileStorage.ts` — `files.ts` is the one oversized backend file (310 lines, five concerns).
4. api build + test:unit (files + uploads suites) → commit.

### Task 4.4 — Flatten the api resource registry (−~60 LOC, kills the naming zoo)

Eight files (`api/src/data/resources/{flows,pages,rows,service,serviceProvider,serviceResource,organisation}.ts`)
destructure `makeCoreResource(...)` into renamed constants (`listFlowRows`, `createFlowResource`,
…) that `api/src/data/data.ts:24-141` re-imports one by one and reassembles into the exact shape
`makeCoreResource` already returned.

1. Each resource file exports the object: `export const flowResource = makeCoreResource<…>({...})`.
2. Registry entries become `[EVY_CORE_RESOURCE.FLOWS]: flowResource`; for resources that must not expose all ops (services/organisations/serviceResources/providers omit `remove`; files omits `update`), pick fields explicitly so dispatch behavior is identical.
3. Replace the `validateAuth` pass-through (`data.ts:149-155`) with `export { validateAuth } from "./resources/devices"`.
4. Update test imports; api build/test → `./run-e2e.sh --skip-ios` → commit.

### Task 4.5 — Simplify api service-adapter init (removes hidden temporal coupling)

`api/src/procedures/services.ts:127-129,213-218` + `api/src/data/data.ts:143-147`:
`wireServiceEvents` must run after `initServiceAdapters` (enforced only by convention in
`index.ts:22-30`).

1. Change to `initServiceAdapters(db, broadcast)`; store the broadcast alongside `serviceAdapterDb`; delete `wireServiceEvents` + the `serviceEventListener` global (adapters created later in `getServiceAdapter` reuse the stored broadcast).
2. Update `index.ts` wiring; api tests (`services.test.ts`, `notifications.test.ts`) → commit.

### Task 4.6 — Break web's 17 circular import chains (four knots, zero behavior change)

Verify before/after with `bunx madge --circular --extensions ts,tsx web/app`.

1. **Barrel knot:** components must import contexts directly (`state/contexts/FlowsContext`, `state/contexts/DragContext`) instead of the `state/index.ts` barrel that also re-exports `AppProvider` (half the codebase already does: `useRowById.ts:8`, `useParseText.ts:2`, `useDraggable.ts:17`). Fix `ContainerChildren.tsx:2` and any other `"../state"` barrel imports, then delete the barrel or reduce it to contexts-only.
2. **state → api types:** move `ServiceResource`/`ResourceAttributeMetadata` from `app/api/sync.ts` to `app/types/resources.ts`; import them in `sync.ts` too (`FlowsContext.tsx:3-6` currently drags the whole wsClient chain into every context consumer). Also replace sync.ts's local `ServiceResource {id, fkServiceId, name}` with a `Pick<DATA_EVY_ServiceResource, …>` while there.
3. **functions ↔ datetime:** move `EVYFunctionContext`/`EVYFunctionOutput` types into `datetime.ts` (or a types file); re-export from `functions.ts`.
4. **utils → rows:** move element construction (the `createElement` parts of `storedRowToRow`/`decodeRow`/`buildRowForNewPageFromBase` in `app/utils/decodeFlow.ts:10-12`, `app/utils/rowCodec.ts:2-4`) into `app/rows/rowElementFactory.ts`; keep pure record↔config transforms in utils. Move `containerDropindicatorId` from `app/rows/EVYRow.tsx:4` to `app/utils/rowConstants.ts`. This also removes the circular-import dodge commented at `app/hooks/useRowById.ts:36-38`.
5. After the cycles are gone, optionally relocate `ContainerChildren` (+ `DropPlaceholderShell`, `PlaceholderDropIndicator`) under `rows/` — only row components use them, and `rows/container/*` importing from `components/` inverts the intended direction.
6. web build + test:unit + test:integration after each knot; commit per knot.

---

# Phase 5 — Web dedup & simplification (−~450 LOC)

### Task 5.1 — Reducer adopts `flatGraph.removePage` (−45 LOC) ⚠️ one behavior check

`app/state/reducers/pageReducer.ts:365-415` (REMOVE_PAGE) + `:444-464` (`collectSubtreeIds`)
duplicate the currently-unused `app/utils/flatGraph.ts:589-611` (`removePage`) and
`app/utils/flowEntities.ts:61-85` (`collectSubtreeRowIds`). **Difference:** the inline version
cleans rows using only the active flow's remaining pages; the shared helper walks all flows. The
shared behavior is almost certainly the intended one (the inline version can purge other flows'
rows from local state) — confirm with a quick test before switching.

1. Write a unit test: two flows sharing state, remove a page in flow A, assert flow B's rows survive. Run it — expect it to document the current (buggy or not) behavior.
2. Replace the inline block with `removePage(state, state.activeFlowId, action.pageId)` + existing selection bookkeeping; delete `collectSubtreeIds`.
3. Run the test + full web suite + the page-deletion integration spec. Commit.

### Task 5.2 — e2e harness imports `decomposeServerFlow` instead of its copy (−70 LOC)

`web/e2e/e2e.pw.ts:195-267` is a near-verbatim copy of `app/utils/decodeFlow.ts:176-251`
(differs only in name fallbacks and skip-key set — reconcile: pass the skip-keys/fallbacks as
options if genuinely needed, otherwise adopt the app version). Run `cd web && bunx playwright
test e2e` via `./run-e2e.sh --skip-ios`. Commit.

### Task 5.3 — One `splitFunctionArguments` (−45 LOC)

`app/utils/datetime.ts:28-73` (quote-aware) vs `app/utils/actionBranch.ts:54-109` (quote- **and**
bracket-depth-aware — a strict superset). Keep the actionBranch version as
`app/utils/functionArgs.ts`; use it from both; delete the other. Note: datetime inputs containing
brackets would now split differently — add/keep unit tests covering datetime's current call sites
(`:221`) to prove no visible change. Commit. (The intentional Swift mirror in
`ios/evy/Utils/interpreter.swift:67` stays — TS↔Swift interpreter mirroring is by design.)

### Task 5.4 — Consolidate popover/dropdown machinery (−~90 LOC)

`app/components/PopoverSelect.tsx` and `app/components/BuilderAssist.tsx` duplicate: the
`injectStyle()` pattern (~250 combined lines of CSS-in-string), fixed-position math
(`PopoverSelect.tsx:208-219` vs `BuilderAssist.tsx:262-270`), outside-click-close effects
(`:272-286` vs `:350-360`), and ArrowUp/Down/Enter/Escape list navigation (`:337-359` vs
`:382-426`).

1. Move both CSS strings into `app/globals.css` (which already hosts `evy-modal-*`, `evy-condition-*`); delete both `injectStyle` blocks.
2. Extract `useAnchoredDropdownPosition()` and `useOutsideClick()` into `app/hooks/`.
3. web build + unit + integration (BuilderAssist and PopoverSelect specs) → commit.

### Task 5.5 — Small dedups (mechanical, one commit)

- `flatGraph.ts`: implement `findPageIdContainingRow` (`:181-196`) as `findPageContainingRow(...)?.id` (`:693-708` is literally the same function); extract a generic `walkRows(rootIds, visit)` for `findRowContainer` (`:70-96`) vs `findContainerById` (`:103-130`); export `insertIntoLocation` under the public name and drop the `insertRowIntoPage` pass-through (`:403-417`). (−~50 LOC)
- `app/utils/decodeFlow.ts:70-92`: merge `normalizeKnownServerRow`/`normalizeUnknownServerRow` into one function with a `defaultTitle` argument. (−15)
- `app/state/reducers/pageReducer.ts:147-172` vs `:218-243`: extract `applyChildContainerDrop(...)`. (−18)
- `app/components/buildRowElements.tsx:17-20` + `app/components/ContainerChildren.tsx:55-58`: extract `resolveRowElement(rowId, rowsById, paletteRows)`. (−8)
- `app/components/ConfigurationPanel.tsx:37-59,303-322` + `app/components/ActionPopup.tsx:65-74`: one `getAttributeCandidatesForQualifier` factory in `utils/idCandidates.ts` with optional `rowSource`. (−25)
- `app/rows/edit/CalendarRow.tsx:10-23` + `TimeslotPickerRow.tsx:18-44`: extract shared mock-date helpers to `rows/edit/mockDates.ts`. (−15)
- `integration/pw.config.js` + `e2e/pw.config.js`: shared base config (differ only in `fullyParallel`/`workers`). (−30)
- `app/state/AppProvider.tsx:48-52`: hoist the palette `rows` array to module scope (or `useMemo([])`) — currently rebuilt every render, defeating the `flowsContextValue` memo at `:198`.
- `app/components/AppPage.tsx:113-169`: render the shared frame/title/rowElements interior once; only the footer / `FooterPlaceholderDropIndicator` differ. (−25)

Steps: apply → full web suite → format → commit.

---

# Phase 6 — iOS dedup & layering (−~250 LOC hand-written)

### Task 6.1 — `titledRow` modifier (−~70 LOC across 9 row views)

Every Edit/View row repeats "optional title header + horizontal padding"
(`VStack(alignment: .leading) { if let title, !title.isEmpty { EVYTextView(title)… } }.padding(.horizontal, Constants.majorPadding)`).
A near-identical modifier already exists: `containerTitleHeader` in
`ios/evy/UI/Rows/Container/EVYContainerTitleHeader.swift` (lacks only the horizontal padding).

1. Add a `titledRow(_ title: String?)` variant there.
2. Adopt in: `EVYCalendarRow.swift:17-25`, `EVYDropdownRow.swift:19-33`, `EVYInlinePickerRow.swift:19-32`, `EVYInputRow.swift:56-71`, `EVYSearchRow.swift:23-38`, `EVYTextSelectRow.swift:47-63`, `EVYTimeslotPickerRow.swift:22-35`, `EVYInputListRow.swift:19-31`, `EVYMapRow.swift:27-39`.
3. Xcode build + visual spot-check of each row in the simulator (previews exist for most) + iOS tests. Commit.

### Task 6.2 — Small view dedups (one commit each or batched)

- Field chrome (padding + rounded stroke border) copy-pasted at `EVYTextField.swift:105-116`, `EVYTextInput.swift:28-40`, `EVYDropdown.swift:79-91` → extract `evyFieldChrome()` modifier. (−25)
- `EVYDropdown.swift:21-64` vs `EVYInlinePicker.swift:19-61` init clones → shared `loadOptions(from:valueTemplate:)`. (−20)
- `EVYSelectItem.swift:82-117` multi-branch toggle triplication (+ the same pattern in `EVYInlinePicker.performAction:63-79`) → one helper parameterized by key extractor. (−20)
- `EVYRow.swift:17-41`: delegate `init(rowId:)` and `init(row:)` to `init(ref:)`. (−12)
- `EVYCalendarAxisView.swift:46-86`: parameterize the near-identical x/y branches. (−20)
- `functions.swift:151-253`: one generic `scaledUnitOutput(value:thresholds:)` for `evyFormatDimension`/`evyFormatWeight`; make `evyLength` delegate to `evyCount` (it's fully subsumed). (−60)
- `EVYAPIManager.swift:63-67` vs `EVY.swift:91-93`: single `EVY.nowISO8601(fractional:)` — note the two currently differ (fractional seconds vs not); keep both formats available, callers keep their current format. (−6)

### Task 6.3 — Default-store parameter collapse (−~65 LOC)

`EVYFlowStore.swift` (`:93-95,110-112,133-135,144-146,153-155,168-170,193-195,212-214,232-234`),
`Utils/forEachRow.swift:11-16`, `Core/EVY+Mutations.swift:101-111`: every no-arg overload just
forwards `EVY.publicStore`. Collapse each pair into one function with
`from store: EVYDataStore = EVY.publicStore` (all callers are `@MainActor`, so the default
expression is safe). Xcode build + full iOS unit tests. Commit.

### Task 6.4 — iOS layering fixes (each ~±0 LOC)

1. **Data reads Core scope (upward):** `EVYDataStore.swift:200` and `EVYDraftStore.swift:51` default to `EVY.activeCacheScopeId`. Require callers (Core facade) to pass the resolved scope.
2. **Transport writes the facade:** `EVYWebsocket.swift:194-207` writes into `EVY.publicStore` and posts notifications. Inject an `onDataChanged` handler from `EVYAPIManager`/`EVY` instead.
3. **SwiftUI extension in Data:** move `onEVYRecordChange` (`Data/EVYChange.swift:57-72`) to `UI/`.
4. **Storage in UI:** move `UI/Views/EVYFileCache.swift` (disk I/O + JPEG normalization) to `Data/`.
5. **Routing types in the root view file:** move `Route`, `ActionOperation`, environment keys (`ContentView.swift:10-74`) to `Core/EVYRouting.swift` — Core/UI files currently depend back on a View file.
6. **Previews in leaf layers:** move the `#Preview` structs out of `Utils/interpreter.swift:930-984` and `Utils/functions.swift:878-904` into a UI previews file; drop those files' SwiftUI imports.
7. **UI bypassing the facade:** `EVYRow.swift:85`, `EVYActionParser.swift:26,48,80`, `EVYActionRunner.swift:123,155,235` call interpreter free functions directly — add `parseFunctionCall`/`splitFunctionArguments`/`stripOptionalSurroundingQuotes` wrappers to `Core/EVY+TextParsing.swift` (that file exists precisely for this).

Steps per item: move/edit → Xcode build → iOS unit tests → commit.

### Task 6.5 — Access-level tightening (0 behavior change)

- Drop ~20 meaningless `public` keywords (app target, no framework consumers): `interpreter.swift:17,26,58,72`, `EVYData.swift:70,79,121,142,200,210,250`, `EVYAPIManager.swift:19,28,69,86`, `EVYRadioButton.swift:12`, `EVYRectangle.swift:10`, `EVYTextView.swift:12`, `EVYSelectItem.swift:10`.
- Make single-file globals `private`/`fileprivate`: `radioSize` (`EVYRadioButton.swift:10`), `timeslotWidth` + `EVYTimeslotColumn` (`EVYTimeslotPicker.swift:10,32`), `spaceForFirstLabel` + `EVYAxisLabel` (`EVYCalendarAxisView.swift:8,17`), `ViewOffsetKey`/`EVYCalendarTimeslots`/`EVYCalendarViewState`/`calculateIndex` (`EVYCalendar.swift:30,74,82,270`). **Keep internal:** `columnWidth`/`rowHeight` (shared across the two calendar files).
- Mark test-only members with a `// used by tests` comment (keep them): `EVYSyncState.reset()` (`EVY.swift:39-42`), `EVYDataStore.delete(namespace:resource:id:)` (`EVYDataStore.swift:117-122`), `EVYNamespace.marketplace` (`EVYData.swift:35`), `EVYRowRef.templateRow(from:)` (`EVYFlowStore.swift:98-103`).
- `EVYTextField.swift:30-31`: `@Bindable` never used as bindings → plain `let`.
- `EVYRectangle.swift:19,56`: replace `any View` + `AnyView` with `EVYRectangle<Content: View>` (all call sites pass concrete views).
- Inline the 1-line pass-throughs: `EVYSearchField.swift` (used once, at `EVYSearch.swift:80`) and the `EVYTextResolver` wrappers (`EVYTextField.swift:10-21,176-187`).

Xcode build + iOS tests → commit.

---

# Phase 7 — Opportunistic readability (do when touching these files anyway)

No dedicated PRs; fold into adjacent work. Zero-risk moves are fine standalone.

- **types/validators.ts (628 lines):** split into `schemaRegistry.ts` / `validators.ts` / `isoDateTime.ts`; table-drive the 26 `lazyValidator`+`makeValidator` pairs (−~150 LOC); rename `validateSync` → `validateSyncRequest` (its ajv label is already `"SyncRequest"`). Consider absorbing `types/rpcRequestHelpers.ts:27-136`'s hand-rolled checks into an ajv-error→message translator (−~90 LOC) — its header says the strings exist for test stability, so update the message-asserting tests in the same commit.
- **scripts:** rename `schemaPathToSwiftTypeName` → `schemaPathToTypeName` (`types-generation-utils.ts:41` — it derives TS names too); replace `assertDrizzleConfig`'s ~100 lines of hand-rolled shape checks (`generate-drizzle.ts:78-178`, pattern repeated in `generate-core-resources.ts:43-74`, `generate-marketplace-resources.ts:41-69`) with a small ajv schema; extract `seed.ts`'s Docker file-copy helpers (`:381-466`) into `seed-files.ts`; give `emitRowContentDecodeLine`'s two booleans a `mode: "optional" | "strict" | "lenient"` param (`generate-swift-sdui.ts:337-398`).
- **web:** rename/split `decodeFlow.ts` (383 lines; contains encoding too — fold into `rowCodec.ts` + `rowNormalize.ts`, pairs with Task 4.6.4); extract `<RowConfigFields>` from `ConfigurationPanel.renderConfiguration` (190-line useCallback returning JSX, `:289-479`); split `handleDrop` (`dropHandler.ts:152-361`) into resolve + dispatch; unify `pageReducer`'s mixed `if`/`switch` (`:97-131`) and consider renaming it `flowGraphReducer`; extract `AppContent` from `App.tsx` (434 lines, five components); split `BuilderAssist.tsx` (604 lines) after Task 5.4; split `integration/configuration.pw.ts` (1,230 lines) by feature.
- **ios:** split `e2e/e2e.swift` (3,087 lines, 6 test classes) into one file per class + `WSEmitter.swift`; split `interpreter.swift` (984 lines) into scanner / watch-targets / (previews moved by 6.4.6); extract `EVYAddressParsing.swift` from `functions.swift:704-845`; rename lowercase util files to the `EVY*` convention; rename `at:` → `destination:` in `EVY+Mutations.swift:266,293`; name the opaque placeholder heuristic in `EVYTextView.makeState` (`:46-49`); doc-comment the load-bearing "first failure aborts the chain" semantics in `EVYActionRunner.run` (`:22-42`); disambiguate the two `EVY.writeRawValue` overloads (`EVY+Mutations.swift:249-264` — the String one silently wraps in quotes).
- **api:** flatten `shared/ws.ts:45-57`'s `new Promise().then(async…)` (absorbed by Task 3.2); top-level `import type { OS }` instead of inline `import("evy-types").OS` (absorbed by 4.4); unify `sync.ts`'s half-applied DI (`:24-27,48-52,76-87`) — inject everything through one deps object or nothing.
- **CI:** the three workflow files (`api.yml`, `marketplace_tests.yml`, `web.yml`) repeat identical trigger + checkout/setup-bun/path-filter scaffolds — a reusable `workflow_call` workflow with a matrix would collapse ~150 YAML lines.

### Phase 6.5 / 7 status (branch `refactor/repo-wide-cleanup`)

**Done (6.5):** access-level tightening; `EVYRectangle<Content>`; `EVYTextField` / `EVYTextResolver` cleanup; `writeRawStringValue` vs `writeRawValue(EVYJson)`; `at:` → `destination:` on mutations + tests; `EVYActionRunner` abort doc; `EVYTextView` placeholder helper; InlinePicker empty-`initial` bootstrap → `[]`.

**Done (6.4 tail):** `EVY+TextParsing` wrappers for `parseFunctionCall` / `splitFunctionArguments` / `stripOptionalSurroundingQuotes`; UI + mutations call `EVY.*`.

**Done (7):** `types/isoDateTime.ts`; `validateSync` → `validateSyncRequest`; `schemaPathToTypeName`; `scripts/seed-files.ts`; reusable `.github/workflows/reusable-bun-lint.yml`; iOS `EVYAddressParsing.swift` + preview extraction; interpreter previews out of utils.

**Deferred (7):** full `schemaRegistry.ts` split + table-driven lazy validators; `rpcRequestHelpers` → ajv translator; `assertDrizzleConfig` ajv; `emitRowContentDecodeLine` mode param; web `decodeFlow` / `AppContent` / `flowGraphReducer` / integration splits; iOS `e2e.swift` + `interpreter.swift` file splits + util renames; `api/sync.ts` DI unification.

---

# Suggested PR sequence

Each PR: `[REFACTOR]` prefix, `bun run format` before pushing, description lists tasks + tests run.

| PR | Contents | Risk |
|---|---|---|
| 1 | Phase 1 (dead code, un-exports, logs, CI/config) | none |
| 2 | Tasks 2.1–2.3 (dead generated output + generator machinery) | none — diff-verified against baseline |
| 3 | Tasks 2.5–2.8 (drift guards, drizzle imports, seed derivation) | low |
| 4 | Task 2.4 (Swift codegen Codable synthesis + `with(title:)`) | low-medium — needs iOS e2e |
| 5 | Phase 3 (shared backend module, one task per commit) | low-medium — needs `./run-e2e.sh --skip-ios` + Docker healthcheck check |
| 6 | Tasks 4.1–4.5 (api import hygiene + registry flattening) | low |
| 7 | Task 4.6 (web cycle-breaking, commit per knot) | low — madge-verified |
| 8 | Phase 5 (web dedup) | medium — 5.1 needs the cross-flow behavior test first |
| 9 | Phase 6 (iOS, split across 2–3 PRs: 6.1–6.3 dedup, 6.4 layering, 6.5 access levels) | medium — simulator + iOS test runs |
| 10+ | Phase 7 opportunistically | — |

Rough total when complete: **≈ −1,400 hand-written LOC, ≈ −8,000 generated LOC**, no circular
imports in web, unidirectional layers in api and iOS, one implementation each for env parsing,
WS server plumbing, readiness CLIs, pg error handling, and test helpers.
