# Architecture Audit — Implementation Plan

**Source:** platform architecture audit performed 2026-07-24 on `feat/dynamic-resources` (HEAD `9a1c865b`).
**Scope guard:** auth, devices, and addresses are intentional record-only placeholders. **No phase in this plan touches auth enforcement, the devices resource, or address behavior.** Identity-dependent improvements are explicitly out of scope.

This plan is executed **one phase at a time**. Each phase is independently shippable as one or more PRs, ends with the full verification block, and does not require any later phase. Line numbers cited below are from the audit date — verify them when you open each file; the surrounding code is the anchor, not the number.

---

## How to use this plan

1. Pick the next unstarted phase (they are ordered by dependency; Phase 0 workstreams are order-free).
2. Read the phase's **Context** section and the listed files *before* writing code.
3. Follow the task list step by step. Steps are intentionally bite-sized: write the failing test, watch it fail, implement, watch it pass, format, commit.
4. Finish with the phase's **Exit criteria** and the global verification block below.

### Global conventions (from `AGENTS.md` / root `README.md`)

- Use `bun` for everything. After schema or SDUI-definition changes, run `bun run types:generate` (generated output is gitignored — never hand-edit `types/generated/`).
- Before finishing any change set: `bun run format` from repo root.
- For api or web changes: `bun run build`, `bun run lint`, `bun run test:unit` in that package (web also `bun run test:integration`).
- For iOS changes: build with Xcode targeting iPhone 17 / iOS 26.5; run `evyTests` — **install the hermetic sync stub** in any new suite (see `ios/evyTests/XCTestCase+UniqueKey.swift`) or you will fire real RPCs at `localhost:8000` and pollute the dev DB (reseed with `bun run db:seed` if that happens).
- End-to-end: `./run-e2e.sh --skip-ios` from root; run iOS e2e separately with services kept running (async XCUITests crash the Xcode 26 runner — keep tests synchronous).
- PR titles prefixed `[FEAT|BUG|REFACTOR]`; description includes summary, major changes, tests run, risks.
- SDUI authoring rule that trips everyone: `{x == "y"}` (quoted literal inside a comparison block) silently never matches on iOS until Phase 1/6 work lands. Use unquoted literals in comparisons.

### Phase overview

| Phase | Name | Depends on | Size |
| --- | --- | --- | --- |
| 0 | Quick wins (7 independent workstreams) | — | S–M each |
| 1 | Grammar conformance corpus | — | M |
| 2 | Explicit flow `submits` declaration | — | M |
| 3 | `UI_RowActions` write-path validation | — (easier after 2) | S |
| 4 | Marketplace payload schema | — | M |
| 5 | Service registration formalization | — | M |
| 6 | Action AST migration | 1, 2, 3 | XL (6 stages) |
| 7 | First-class sync: cursor + tombstones | 0B | L (5 stages) |
| 8 | Scope-as-value on iOS | 1 recommended | L (4 stages) |
| 9 | Procedures registry | 5 recommended | M |

---

## Phase 0 — Quick wins

Seven independent workstreams. Each is its own PR. Order between them does not matter.

### 0A — iOS: fix the reconnect bug

**Problem.** On WebSocket disconnect, `EVYWebsocket.handleDisconnect` nils the receive task (`ios/evy/Data/API/EVYWebsocket.swift`, ~lines 158–167) but `EVYAPIManager.authed` is never reset (`ios/evy/Data/EVYAPIManager.swift`, ~lines 15, 98–110). `validateAuth()` short-circuits on `authed == true` while `fetch` throws "Not connected" — so one dropped socket leaves every subsequent RPC failing until app relaunch.

**Files.**
- Modify: `ios/evy/Data/EVYAPIManager.swift` (auth state lifecycle, reconnect trigger)
- Modify: `ios/evy/Data/API/EVYWebsocket.swift` (disconnect callback to manager, backoff reconnect loop)
- Add: `ios/evyTests/EVYAPIManagerReconnectTests.swift`

**Design.** Keep it minimal: (1) on disconnect, reset `authed = false` and notify the manager; (2) the next `fetch`/`validateAuth` re-opens the socket and re-runs the rpc-websockets `rpc.login` handshake; (3) add a capped exponential backoff (1s → 30s, mirroring the server-side adapter pattern in `api/src/procedures/services.ts`) for a background reconnect task so `dataChanged` subscription resumes without user action; (4) on successful reconnect, re-issue the `rpc.on ["dataChanged"]` subscription. Do **not** attempt missed-event replay here — recovering missed changes is Phase 7's job (until then, restart-time sync remains the recovery path; note this in a code comment only if the subscription logic would otherwise look incomplete).

**Steps.**
1. Read both files fully; map the current connect/login/subscribe sequence (`EVYAPIManager.validateAuth`, `EVYWebsocket.connect`, `handleDisconnect`).
2. Write `EVYAPIManagerReconnectTests` against a fake transport: simulate connect → login → disconnect; assert `authed` is false after disconnect and that a subsequent request triggers reconnect + re-login + re-subscribe. Use the existing injection seams (`EVY.syncTransport`, and add a socket-factory seam if none exists — prefer a small `protocol EVYWebsocketConnecting` over subclassing).
3. Run the test; confirm it fails for the right reason (authed still true / no reconnect).
4. Implement the state reset + reconnect + re-subscribe + backoff.
5. Run `evyTests`; all green.
6. Manual check: run the stack (`bun dev`), launch the app, kill and restart the api process, confirm the app recovers (search or a create action works without relaunch).
7. `bun run format`; commit `[BUG] iOS: reset auth state and reconnect after WebSocket drop`.

### 0B — iOS: honor `operation: "delete"` in `dataChanged`

**Problem.** `EVYWebsocket` decodes the push notification's `operation` field but ignores it — `EVY.applySyncedValue` upserts unconditionally (`ios/evy/Data/API/EVYWebsocket.swift`, ~lines 180–204), so a delete notification re-inserts the deleted row.

**Files.**
- Modify: `ios/evy/Data/API/EVYWebsocket.swift` (branch on operation)
- Modify: `ios/evy/Core/EVY+Stores.swift` (add/verify a delete-by-id path that removes from both public and private stores and posts `.evyRecordChanged`)
- Modify: `ios/evyTests/EVYStoreRoutingTests.swift` (or a new focused suite — and while in there, install the hermetic sync stub this suite is currently missing)

**Steps.**
1. Write a failing test: apply a `dataChanged` payload with `operation: "delete"` for a row present in the store; assert the row is gone and a record-change notification fired.
2. Run; confirm failure (row still present).
3. Implement: route `delete` operations to store removal; keep `create`/`update` on the upsert path; unknown operations log and no-op.
4. Run `evyTests`; green. Also add the hermetic stub to `EVYStoreRoutingTests` setup (`installHermeticMutationSync`) — this suite currently fires real RPCs.
5. `bun run format`; commit `[BUG] iOS: apply delete operations from dataChanged instead of re-upserting`.

Server-side note: core deletes already broadcast `operation` (`api/src/data/data.ts`, `buildEmitNotification` ~lines 220–233). No API change needed. Sync-time deletion (rows deleted while offline) is Phase 7.

### 0C — iOS: loud condition-evaluation errors

**Problem.** In `EVYActionRunner.run` (`ios/evy/UI/EVYActionRunner.swift`, ~line 32) condition evaluation uses `try?` — an unparseable/erroring condition is indistinguishable from "evaluated false": the false branch runs and the array stops, silently. Documented behavior ("the error is surfaced") only applies to *branch* throws.

**Files.**
- Modify: `ios/evy/UI/EVYActionRunner.swift`
- Modify: `ios/evyTests/EVYActionRunnerTests.swift`
- Modify: `docs/evy/sdui.md` (Sequencing/Conditions section: document the new behavior)

**Steps.**
1. Write failing tests: (a) a syntactically broken condition (e.g. `{count(}`) posts `.evyErrorOccurred` and stops the array without running either branch; (b) a valid condition evaluating false still runs the false branch and stops (unchanged); (c) empty condition unchanged.
2. Run; confirm (a) fails today (false branch runs).
3. Implement: replace `try?` with `do/catch`; on catch, post the error notification (include the row id and the offending condition text in the message) and stop.
4. Run `evyTests`; green. Grep fixtures for conditions that would now throw (`scripts/fixtures/**/*.json`) — there should be none; if any exist, fix the fixture in the same PR.
5. Update `docs/evy/sdui.md` Conditions/Sequencing: "an invalid condition is an error (surfaced + stops the array), not false."
6. `bun run format`; commit `[BUG] iOS: surface condition evaluation errors instead of treating them as false`.

### 0D — Codegen: fail on schema→config drift in the Drizzle generator

**Problem.** `scripts/generate-drizzle.ts` validates config→schema references (`validateConfigSemantic`, ~lines 187–262) but not the reverse: a new `DATA_EVY_*` `$def` in `types/schema/data/data.schema.json` with no entry in `types/schema/data/drizzle.config.json` silently produces no table.

**Files.**
- Modify: `scripts/generate-drizzle.ts`
- Add: `scripts/generate-drizzle.test.ts` (colocated, following `scripts/sdui-row-schema-utils.test.ts` precedent)

**Steps.**
1. Extract (or export) the validation entry point so it is testable with in-memory schema/config objects rather than the real files.
2. Write failing test: a schema containing `DATA_EVY_Foo` with a config lacking a `Foo` table entry must throw with a message naming the missing `$def`. Add an escape hatch test: `$defs` listed in an explicit `nonTableDefs` allowlist (value objects that intentionally have no table) pass.
3. Run `bun test scripts/generate-drizzle.test.ts`; confirm failure.
4. Implement (~10–20 lines): after existing validation, diff schema `$defs` matching `DATA_EVY_*` against config table keys + allowlist; throw listing the misses. Seed the allowlist with any current intentional non-table defs (inspect `data.schema.json` — as of the audit all `DATA_EVY_*` defs have tables, so it likely starts empty).
5. Run the test; green. Run `bun run types:generate` end-to-end; confirm clean.
6. `bun run format`; commit `[FEAT] Drizzle generator fails when a DATA_EVY_ def has no table config`.

### 0E — API: file binaries out of sync's list path

**Problem.** The `files` resource wires `listFileRowsWithBinary` as its list op (`api/src/data/data.ts` ~lines 93–97; `api/src/data/resources/files.ts` ~lines 42–62, 207–225), so sync inlines every changed file's full base64 body, and one missing binary on disk throws and fails the entire sync.

**Files.**
- Modify: `api/src/data/data.ts` (files registry entry: list returns metadata only)
- Modify: `api/src/data/resources/files.ts` (split metadata list from binary fetch; keep the binary path for direct single-file `get`)
- Modify: `api/src/tests/sync.test.ts`, `api/src/tests/files.test.ts`
- Verify (likely no change): `ios/evy/UI/EVYRemoteFile*.swift` / `ios/evy/Data/EVYFileCache.swift` — iOS already lazy-fetches file content by id via `getFile` (`ios/evy/Data/EVYAPIManager.swift` ~lines 63–78)
- Verify: `web/app` — search for any consumer of `dataBase64` from sync payloads (e.g. image previews); if web reads binaries from sync, add a lazy `get files` fetch in the same PR

**Design decision (lock in):** `sync` and *filtered-list* `get` on `files` return metadata rows only (no `dataBase64`). A `get` with `filter.id` for a single file keeps returning the binary — that is the existing lazy-fetch contract iOS uses. A missing binary for a single-file get remains an error; a missing binary can no longer fail sync.

**Steps.**
1. Grep both clients for `dataBase64` to confirm consumers of the sync-carried binary. Record findings in the PR description.
2. Write failing api tests: (a) sync response containing a changed file has metadata but no `dataBase64`; (b) sync succeeds even when a file row's binary is missing on disk; (c) single-id `get files` still returns the binary.
3. Run `bun run --cwd api test:unit`; confirm (a)/(b) fail.
4. Implement the split in `files.ts` + registry wiring in `data.ts`.
5. Api tests green. Fix any web consumer found in step 1 (lazy fetch on demand).
6. Run `./run-e2e.sh --skip-ios`; then run iOS e2e separately (photo-bearing marketplace flows must still render images).
7. `bun run format`; commit `[REFACTOR] Sync returns file metadata only; binaries fetched lazily by id`.

### 0F — Web: one `<Modal>` primitive

**Problem.** Three dialogs each independently re-implement portal + backdrop + escape handling (`web/app/components/ActionPopup.tsx` ~line 121, `CreateFlowDialog.tsx` ~line 40, `PageInUseDialog.tsx` ~line 20) with shared CSS (`web/app/globals.css` ~610–702, ~875) but no shared component. No focus trap anywhere; `ActionPopup` lacks `aria-modal`; Tab escapes into the page beneath.

**Files.**
- Add: `web/app/components/Modal.tsx` — portal to `document.body`, `.evy-modal-root`/`-backdrop`/`-panel` skeleton, `role="dialog"` + `aria-modal="true"` + labelled-by wiring, `useEscapeKey`, focus trap (focus first focusable on open, cycle Tab/Shift-Tab, restore focus on close), footer slot.
- Modify: `ActionPopup.tsx`, `CreateFlowDialog.tsx`, `PageInUseDialog.tsx` — render through `Modal`; delete their local skeletons.
- Modify: `web/app/globals.css` — consolidate `PageInUseDialog`'s bespoke panel class (~line 875) into the shared modal styles.
- Tests: existing Playwright suites already exercise all three dialogs (`web/integration/configuration.pw.ts`, `flowSelector.pw.ts`, sheet/page suites); add focus-trap assertions to one of them.

**Steps.**
1. Read the three dialogs and list every behavioral difference (footer buttons, backdrop-click semantics, escape semantics, initial focus target). The `Modal` API must cover all three without per-dialog conditionals.
2. Note the interaction with `PopoverSelect`: dropdown menus open *inside* `ActionPopup` portal over portal, and Escape inside the menu `stopPropagation`s (`web/app/components/PopoverSelect.tsx` ~lines 206–209). The focus trap must treat the popover's portal content as inside the trap (track by element containment of both portals, or a shared context) — this is the one genuinely fiddly part; write the integration test for "Escape closes open dropdown, second Escape closes modal" before implementing.
3. Build `Modal.tsx`; migrate `PageInUseDialog` first (simplest), then `CreateFlowDialog`, then `ActionPopup`.
4. Add focus-trap + aria assertions to `web/integration/configuration.pw.ts`.
5. Run `bun run --cwd web test:unit && bun run --cwd web test:integration`; green. Run `bun run --cwd web build && bun run --cwd web lint`.
6. `bun run format`; commit `[REFACTOR] Web: single Modal primitive with focus trap and aria-modal`.

### 0G — Documentation: fix the actively misleading items

One PR, docs only (plus one error-string change).

**Steps.**
1. `docs/services/marketplace/data.md`: remove the embedded `address: address` field from `DATA_MARKETPLACE_Item`; document `transfer_options.pickup.address_id` referencing the core `addresses` resource (align with `docs/evy/data.md` ~lines 190, 250).
2. `docs/evy/functions.md`: fix the quoting self-contradiction — the Comparisons examples (~lines 98–101: `{item.title == "Amazing"}`, `{item.type == "square"}`) use quoted literals that never match on iOS. Rewrite examples with unquoted literals and add an explicit warning box referencing the forbid-quotes rule (~lines 69/73). Also fix `length` documentation (~line 29) to describe actual behavior (aliases `count`: arrays → element count, numbers echo) **or**, if 1.6 below is taken, to the corrected behavior.
3. `docs/evy/data.md` ~line 58: remove or rewrite the dead link to `../plans/external-service-resource-id-discovery.md` (the file exists only in a git stash — either recover it from stash `2194b2f6` into `docs/plans/`, or inline the routing rules it documented). Same decision for the stashed `quoted-string-literal-unification.md` (Phase 1/6 supersede it — recommend inlining a short note and deleting the reference).
4. Root `README.md` line ~3: reword "local-first and peer-to-peer" to match reality (iOS keeps an offline local store synced over a central gateway; web is online-only). Keep aspiration statements clearly labeled as roadmap if desired.
5. `api/README.md` (~lines 9, 31): replace `service: "evy"` phrasing with the actual dispatch rule (the generated core service UUID; named constant `EVY_CORE_SERVICE`). Also update the runtime error string in `api/src/procedures/rpc.ts` (~line 44) that says "only supported for service \"evy\"" to name the constant/UUID — **check `api/src/tests/` first**: `types/rpcRequestHelpers.ts` documents that tests assert on stable error strings; update the matching assertions in the same commit.
6. `ios/README.md` (~line 21–29 and ~77): add the warning that `evyTests` suites without the hermetic stub fire real RPCs at `localhost:8000`; fix the storage-key description (records are stored under separate `namespace`/`resource` columns; the colon form is a binding grammar only); mention that `dataChanged` push applies continuously after startup sync.
7. `bun run format`; commit `[BUG] Docs: fix misleading marketplace address model, quoting examples, dead links, service-id phrasing`.

---

## Phase 1 — Grammar conformance corpus

**Goal.** One checked-in set of test vectors for the `{...}` expression / action-string grammar, executed by both the Swift interpreter tests and the TS parsers, so the five hand-written implementations stop drifting apart. This *pins current behavior* (including warts) before Phase 6 changes anything.

**Context to read first.**
- `ios/evy/Utils/interpreter.swift` (the canonical evaluator: regex layer ~lines 10–17, `ParserScanState` ~86–133, `parseText` ~416–540, root resolution ~250–297)
- `ios/evy/UI/EVYActionParser.swift` (action-branch grammar), `ios/evy/Utils/functions.swift`
- `web/app/utils/interpreter.ts`, `functionArgs.ts`, `conditionExpression.ts`, `actionBranch.ts`, `actionOperands.ts`
- `docs/evy/functions.md`, `docs/evy/sdui.md` (Conditions/Branches sections)
- Audit findings: two tokenizers disagreeing about quotes; the `[^}^"]` regex typo copied into web; three quoting regimes; `length` aliasing `count`; one-level paren nesting cap.

**File structure.**

| File | Status | Responsibility |
| --- | --- | --- |
| `types/grammar/conformance.json` | new | The vectors. Single source of truth. |
| `types/grammar/README.md` | new | Vector format spec + how to add a vector + platform-applicability rules. |
| `web/app/utils/grammarConformance.test.ts` | new | Bun-test runner over the TS-applicable vectors. |
| `ios/evyTests/GrammarConformanceTests.swift` | new | XCTest runner over the iOS-applicable vectors. |
| `ios/evy.xcodeproj/project.pbxproj` | modify | Add the JSON as a test-bundle resource. |
| `docs/evy/functions.md` | modify | Point to the corpus as the behavioral reference. |

**Vector format (lock in before writing vectors).**

```jsonc
{
  "id": "comparison-unquoted-literal-eq",       // stable, kebab-case
  "category": "comparison | props | function | action-branch | condition-parse | datum",
  "platforms": ["ios", "web"],                   // which runners execute it
  "input": "{item.condition == pending}",
  "data": { "item": { "condition": "pending" } },// environment; iOS loads into a fresh in-memory store
  "expect": { "text": "true" },                  // OR {"parse": {...}} for parse-only vectors OR {"error": true}
  "notes": "why this behavior is what it is"
}
```

- iOS executes `comparison`/`props`/`function`/`datum` categories through `EVY.parseText`-equivalents against a hermetic store; web executes `condition-parse` and `action-branch` categories through `parseCondition`/`parseBranch`/`splitFunctionArguments` asserting **parse structure**, since web evaluation is intentionally a mock.
- Vectors documenting known warts get `"notes"` starting with `WART:` — e.g. quoted-literal comparisons resolving to unevaluated text, one-level paren nesting, missing-leaf-returns-parent-JSON. These pin today's behavior so Phase 6/8 changes are *visible* as vector diffs, not surprises.

**Steps.**
1. Write `types/grammar/README.md` (the format above, plus the rule: any PR that changes parser behavior on either platform must update vectors in the same PR).
2. Seed the corpus (~60–100 vectors) covering: bare-path props; nested paths; `[0]` index sugar; missing root (→ whole string empty); missing leaf (→ parent JSON echo, WART); each documented function (`count`, `length` current behavior WART, `now`, `earliestDatetime`, `findFirst` id-shorthand + expression + null semantics, every `format*`); comparisons with every operator; `&&`/`||`/parens; quoted-literal-in-comparison (WART); boolean literals; `$datum` in templates; action-branch parses for all 11 functions incl. `submit`/`draft` markers, quoted strings in action data, nested `{k: v}` objects, trailing-arg trimming; condition-parse for standalone booleans (currently unparseable on web — WART vector with `expect.parse: null`).
3. Write the web runner: load JSON, iterate web-applicable vectors, dispatch by category to the right parser, assert. Run `bun run --cwd web test:unit`; fix vector expectations until the suite is green **without changing parser code** (the corpus describes reality).
4. Add the JSON to the iOS test bundle; write the Swift runner (fresh in-memory store per vector via the existing `makeStore()` pattern from `ContentViewTests`; hermetic stub installed). Run `evyTests`; adjust expectations to observed behavior — every divergence you find between what you *expected* and what iOS does is a candidate WART vector and possibly a new audit finding; record them in the PR.
5. Where iOS and web genuinely disagree on a shared category, split the vector per platform and tag both `WART:` — these are the Phase 6 work list.
6. Point `docs/evy/functions.md` at the corpus as the normative behavioral reference.
7. (Optional sub-stage, recommended) Fix `length`: give it a real implementation on iOS (string → char count; missing/null → 0; non-string → 0 per docs), update the WART vector to a normal one, update web's stub if needed, update docs. This is the corpus's first consumer proving the loop works.
8. `bun run format`; commit(s): `[FEAT] Shared grammar conformance corpus + runners`, `[BUG] iOS: length() implements documented string semantics`.

**Exit criteria.** Both runners green in CI; corpus README explains the update rule; known warts are pinned as vectors.

---

## Phase 2 — Explicit flow `submits` declaration

**Goal.** A flow that submits a create declares `submits: {service, resource}` on the flow record. Both clients stop *inferring* submission semantics by string-scraping actions (`EVYFlowStore.createKeys` on iOS; `collectDraftSignals`/`finalizeCreateBranchForSave` on web) and instead *validate* actions against the declaration.

**Context to read first.**
- `ios/evy/Core/EVYFlowStore.swift` (~lines 179–225: `createKeys`, `draftScopeId` — first-sorted-resource tiebreak)
- `web/app/utils/createDraftSignals.ts`, `web/app/utils/actionBranch.ts` (~lines 120–186: `finalizeCreateBranchForSave`), `web/app/components/ActionPopup.tsx` (~79–91: the save gate)
- `types/schema/data/data.schema.json` (`DATA_EVY_Flow`), `types/schema/sdui/evy.schema.json` (`UI_Flow`), `types/schema/data/drizzle.config.json`
- `scripts/seed.ts` (`decomposeFlow` ~375–497), `types/validators.ts` (`validateUiFlow` ~502–577)
- `docs/evy/sdui.md` (Flow section), fixtures `scripts/fixtures/evy/evy_sdui.json`, `scripts/fixtures/services/service_sdui.json`

**File structure.**

| File | Status | Responsibility |
| --- | --- | --- |
| `types/schema/data/data.schema.json` | modify | `DATA_EVY_Flow` gains optional `submits: { service: uuid, resource: string }` |
| `types/schema/sdui/evy.schema.json` | modify | `UI_Flow` mirrors it |
| `types/schema/data/drizzle.config.json` | modify | nothing structural (column auto-derives to jsonb) — verify only |
| `api/drizzle/` | new migration | `bun run --cwd api db:generate` after types:generate |
| `types/validators.ts` | modify | `validateUiFlow`: if a flow contains `create(...,submit)` actions, `submits` must be present and match; mismatch or multiple distinct submit resources = validation error |
| `scripts/fixtures/**/*_sdui.json` | modify | add `submits` to the create flows (item create flow, any address/message create flows) |
| `scripts/seed.ts` | modify | `decomposeFlow` carries `submits` through to the flow record |
| `ios/evy/Core/EVYFlowStore.swift` | modify | `draftScopeId` prefers declared `submits`; `createKeys` becomes a consistency check that posts an error on mismatch |
| `ios/evyTests/EVYDraftMergesTests.swift` + flow-store tests | modify | cover declared-vs-inferred precedence and mismatch error |
| `web/app/utils/createDraftSignals.ts` | modify | reads the declaration; flags disagreement instead of silently rewriting |
| `web/app/utils/actionBranch.ts` | modify | `finalizeCreateBranchForSave` uses the declaration (no whole-flow scan) |
| `web/app/components/ConfigurationPanel.tsx` or flow settings UI | modify | surface/edit `submits` (a service+resource picker at flow level; reuse the pickers from `BranchEditor`) |
| `web/app/utils/flowFactory.ts` | modify | new flows created with `submits` unset |
| `docs/evy/sdui.md`, `docs/evy/data.md` | modify | document the field and the validation rule |

**Steps.**
1. Schema change + `bun run types:generate` + `bun run --cwd api db:generate` (verify the generated migration only adds a nullable column; commit migration).
2. Write failing `validateUiFlow` unit tests (in the existing validators test location — check `types/` test setup; if validators are tested via api tests, put them in `api/src/tests/validation.test.ts`): flow with submit-create and no `submits` fails; matching declaration passes; mismatched resource fails.
3. Implement the `validateUiFlow` rule; tests green.
4. Update fixtures with `submits`; run `bun run db:seed` (seed runs validateUiFlow — must pass).
5. iOS: write failing test — a flow with declared `submits` whose actions target a *different* resource posts an error; a flow with declaration gets its draft scope from the declaration (no scraping). Implement in `EVYFlowStore` (keep `createKeys` as the checker; delete the alphabetical tiebreak — with a declaration there is nothing to tie-break; without one, keep legacy inference for backward compat this phase). `evyTests` green.
6. Web: write failing unit tests for `createDraftSignals` reading the declaration; implement; then update `ActionPopup` save gate to validate against the declaration and *warn* (not rewrite) on disagreement. Update `flowFactory`. Playwright: extend `web/integration/configuration.pw.ts` submit-vs-inline scenarios to run against declared flows.
7. Full verification block; `./run-e2e.sh --skip-ios`; iOS e2e separately (the create-item flow exercises this end to end).
8. `bun run format`; commit `[FEAT] Flows declare submits {service, resource}; clients validate instead of inferring`.

**Exit criteria.** All fixture create-flows declare `submits`; both clients prefer the declaration; string-scraping survives only as a mismatch detector; validateUiFlow enforces consistency.

---

## Phase 3 — `UI_RowActions` write-path validation

**Goal.** The API stops accepting arbitrary JSON in `row.data.actions`. Malformed actions are rejected at write time instead of silently vanishing rows on iOS.

**Context.** `api/src/data/resources/rows.ts` (~lines 3–8), `types/schema/data/data.schema.json` (`DATA_EVY_RowData`: three typed keys + `additionalProperties: JSONValue`), `types/schema/sdui/evy.schema.json` (`UI_RowActions`, `additionalProperties: false`, 6 trigger keys), `types/schema/sdui/action.schema.json`, `types/validators.ts` (~109–234: the `$ref`-rewriting ajv registry rooted at `https://evy.local` — cross-file `$ref` is already supported).

**File structure.**
- Modify `types/schema/data/data.schema.json`: `DATA_EVY_RowData.properties.actions` → `$ref` to the SDUI `UI_RowActions` schema (follow the existing cross-schema `$ref` conventions used elsewhere in `types/schema/`; check how `evy.schema.json` refs are registered in `validators.ts`).
- Modify `api/src/tests/validation.test.ts`: new cases.
- Possibly modify `web/app/utils/rowActions.ts` consumers — web already writes canonical `{}`/compact shapes; verify only.
- Modify `docs/evy/sdui.md`: note that actions shape is now validated at the API.

**Steps.**
1. Write failing api tests: `create rows` / `update rows` with (a) `actions` containing an unknown trigger key → rejected; (b) an action entry missing `condition` → rejected; (c) canonical `{}` and valid trigger lists → accepted; (d) legacy array-shape actions → rejected (they are already fail-fast on web per project history — confirm no legacy rows exist in fixtures).
2. Run `bun run --cwd api test:unit`; confirm failures.
3. Wire the `$ref`; run `bun run types:generate`; api tests green.
4. Run `bun run db:seed` (all fixtures must pass the new validation) and `./run-e2e.sh --skip-ios`. Then a full builder session smoke test: create a row, edit actions, save — the builder must produce only valid shapes (it should already; any failure here is a builder bug to fix in this PR).
5. `bun run format`; commit `[FEAT] API validates row actions shape on write`.

**Note.** This validates the *object shape* (triggers → list of {condition,true,false} strings). The *string contents* stay unvalidated until Phase 6 — that is intentional sequencing.

---

## Phase 4 — Marketplace payload schema

**Goal.** Give marketplace items a real JSON Schema, validated in the marketplace service on create/update — closing the platform's only fully-unvalidated write path — while keeping SDUI flexibility (`additionalProperties: true` initially).

**Context.** `services/marketplace/src/data.ts` (`validateCreateDataPayload` = "any object" + ISO-date walk, `assertMarketplaceRules` ~27–38), `types/validators.ts` (~680–725), `docs/services/marketplace/data.md`, `scripts/fixtures/services/service_data.json`, `types/schema/resources/marketplace.resources.json`, `scripts/generate-types.ts` (Swift generation for the new schema), the wrapper/blob response asymmetry (`data.ts` ~52–58 vs ~91).

**File structure.**

| File | Status | Responsibility |
| --- | --- | --- |
| `types/schema/services/marketplace/item.schema.json` | new | `DATA_MARKETPLACE_Item`: id, seller fields as currently used, title, price (shared `price` shape), photo ids, condition_id, transfer_options (with `pickup.address_id` uuid — matching the core model; **no embedded address**), payment_methods, timestamps. `additionalProperties: true`. |
| `scripts/generate-types.ts` | modify | include the new schema dir in TS + Swift outputs |
| `types/validators.ts` | modify | expose `validateDataMarketplaceItem` from the entity ajv bundle |
| `services/marketplace/src/data.ts` | modify | on create/update where `resource === items`, validate payload; other resources keep the generic object check |
| `services/marketplace/src/tests/data.test.ts` | modify | new cases |
| `docs/services/marketplace/data.md` | modify | schema becomes the documented source of truth (link it) |

**Steps.**
1. Derive the schema from reality, not from docs: read `scripts/fixtures/services/service_data.json` items and grep the SDUI fixtures for every `items.` path referenced in bindings/conditions (`grep -o 'dc28ed59[^}]*' scripts/fixtures/services/service_sdui.json` plus named paths). The union of fixture shape + referenced paths is the required-field baseline; everything else optional.
2. Write the schema; `bun run types:generate`; confirm TS type + Swift model generate (check the Swift emitter handles it — if the custom SDUI emitter is the wrong tool, route this schema through quicktype like `os`/`file` schemas are; look at `generate-types.ts` ~190–220).
3. Write failing marketplace tests: create with fixture item passes; create with `price: "banana"` (wrong shape) rejected with a useful error; create with extra unknown props passes (additionalProperties true); update validated the same way.
4. Run `bun run --cwd services/marketplace test:unit`; confirm failures; implement validation in `data.ts`; green.
5. Seed + e2e: `bun run db:seed`, `./run-e2e.sh --skip-ios` (marketplace e2e goes through the api gateway and will catch forwarded-error shape changes).
6. Update `docs/services/marketplace/data.md` to point at the schema file.
7. `bun run format`; commit `[FEAT] Marketplace items validated against DATA_MARKETPLACE_Item schema`.

**Deliberately out of scope here:** the wrapper/blob response asymmetry and `row.id`/`data.id` duplication — note them in the PR description as known follow-ups (they belong to the serviceKit consolidation, which is not scheduled in this plan's sequencing).

---

## Phase 5 — Service registration formalization

**Goal.** Service endpoints move from `NAME_WS_HOST`/`NAME_WS_PORT` env-var-by-name convention onto the `Service` row itself (with env as fallback); readiness degrades gracefully; the api→service hop gets timeouts and attributed errors.

**Context.** `api/src/procedures/services.ts` (adapter lifecycle ~52–92, env resolution `requireServiceWsEndpoint` ~131–144, lazy re-read ~179–189, forwarding ~107–124), `api/src/readiness.ts` (~12–16: hard-fails when any registered service lacks env), `api/src/data/data.ts` (`listExternalServices` ~127–134), `types/schema/data/data.schema.json` (`DATA_EVY_Service`), `docker-compose.yml` (`MARKETPLACE_WS_HOST=marketplace`), `scripts/seed.ts` (~678–701 service registry rows), `api/src/tests/services.test.ts`.

**File structure.**
- Modify `types/schema/data/data.schema.json`: `DATA_EVY_Service` gains optional `wsHost: string`, `wsPort: integer` (two scalars beat one parsed URL here — the adapter already thinks in host/port).
- New api migration (auto-derived columns).
- Modify `api/src/procedures/services.ts`: endpoint resolution order = row fields → env convention → error; validate env-derived names against `^[A-Z][A-Z0-9_]*$` and fail with a clear message naming the service; wrap forwarded calls with a timeout (config `SERVICE_RPC_TIMEOUT_MS`, default e.g. 10s) and rethrow errors as JSON-RPC errors carrying `error.data = {serviceId, serviceName, code}`.
- Modify `api/src/readiness.ts`: an unreachable/unconfigured external service degrades readiness output to a warning listing the service, instead of failing the health check (gate on a `REQUIRED_SERVICES` env list if hard-fail is wanted for specific services in compose).
- Modify `scripts/seed.ts`: seed the marketplace Service row with `wsHost`/`wsPort` when env provides them (keeps compose behavior identical).
- Modify `docker-compose.yml` / `.env.example`: document the two mechanisms; keep env vars working.
- Modify `api/src/tests/services.test.ts` (+ `readiness` coverage in `bootstrap.test.ts` if that's where it lives — check).
- Modify `api/README.md`.

**Steps.**
1. Schema + typegen + migration; commit separately (`[FEAT] Service rows carry optional ws endpoint`).
2. Write failing tests: endpoint from row wins over env; env fallback still works; invalid env-name service errors with the service name in the message; forwarded call to a hung service times out with `error.data.serviceId` populated; readiness reports degraded-not-dead for an unreachable service.
3. Implement resolution order + timeout wrapper + error attribution; tests green.
4. Readiness change + tests.
5. `./run-e2e.sh --skip-ios` (compose path uses env fallback — proves nothing broke); then a manual run with the seed writing row endpoints to prove the row path.
6. Update `api/README.md` (registration section) — while there, verify the Phase 0G doc fixes didn't conflict.
7. `bun run format`; commit `[FEAT] Formalized service registration: row endpoints, timeouts, attributed errors, graceful readiness`.

---

## Phase 6 — Action AST migration (big rock 1)

**Goal.** Replace action *branch strings* with typed objects validated by schema at the API, executed natively by iOS, edited natively by web. Eliminates: duplicated branch parsers, `submit`/`draft` bare-word sentinels, lossy builder round-tripping, silent malformed-action failures. **Conditions remain expression strings** in this phase (covered by the Phase 1 corpus).

This phase is six sequential stages; each is a separate PR; the system works after every stage. Prerequisites: Phases 1 (corpus pins string behavior), 2 (`submits` removes the builder's save-time rewriting), 3 (write-path validation infra).

### Stage 6.1 — Schema: `UI_ActionInvocation`

**Files.** `types/schema/sdui/action.schema.json` (extend), possibly new `types/schema/sdui/actionInvocation.schema.json`; `docs/evy/sdui.md` (new format documented alongside old).

**Design (lock in).** `UI_RowAction.true` / `.false` become `oneOf: [string, UI_ActionInvocation]` during migration (dual-shape window). `UI_ActionInvocation` is a discriminated union on `fn`:

```jsonc
{ "fn": "close" }
{ "fn": "navigate", "flowId": "…", "pageId": "…", "query": { "id": {"path": "$datum.id"} } }
{ "fn": "show", "rowId": "…" }
{ "fn": "expand_text", "rowId": "…" }
{ "fn": "highlight_required", "field": "…" }
{ "fn": "select", "value": {"path": "$datum"} }
{ "fn": "select_photo" } / { "fn": "delete_photo" } / { "fn": "expand_photo" }
{ "fn": "create", "service": "uuid", "resource": "…", "mode": "submit" }
{ "fn": "create", "service": "uuid", "resource": "…", "mode": "inline", "data": { … } , "idDestination": {"path": "pickup_address.id"} }
{ "fn": "create", "service": "uuid", "resource": "…", "mode": "fromPath", "dataPath": "pickup_address", "idDestination": … }
{ "fn": "update", "service": "uuid", "resource": "…", "mode": "store", "filter": { … }, "changes": { … | {"path": …} } }
{ "fn": "update", "service": "uuid", "resource": "…", "mode": "draft", "changes": { … } }
```

Value leaves in `data`/`filter`/`changes`/`query` are a tagged value type: `{"lit": <json>}` for literals (string/number/bool/null), `{"path": "a.b.c"}` for data paths, `{"expr": "{now()}"}` for function expressions, `{"obj": {…}}` nesting. This removes the bare-word/quoting ambiguity class entirely. Keys may be dotted paths (unchanged semantics).

**Steps.** Write the schema with `unevaluatedProperties: false` per variant; add exhaustive positive/negative schema unit tests (wherever validators are tested — `api/src/tests/validation.test.ts`); `bun run types:generate`; confirm TS types emit sanely. Swift: the custom SDUI emitter does not handle discriminated unions well (audit: enums → String, unknowns → String) — plan a **handwritten** `EVYActionInvocation` Swift enum with Codable conformance plus a contract test against the embedded schema JSON, following the existing `SduiRowAttributeContractTests` pattern. Commit.

### Stage 6.2 — Shared converter: string → AST (TS)

**Files.** New `types/actionAst.ts` (or `web/app/utils/` if types/ can't host runtime web deps — check import direction; `types/` is the right home since the seed migration also needs it): `parseActionStringToInvocation(branch: string): UI_ActionInvocation | ConversionError`, built on the existing `parseBranch`/`splitFunctionArguments` logic (move/reuse, don't fork). Plus `serializeInvocationToLegacyString` for round-trip testing only.

**Steps.** Port the 11 functions; drive with a new vector category in the Phase 1 corpus (`action-ast-convert`: legacy string → expected AST JSON) — every fixture action string becomes a vector. Round-trip property: convert → serialize → convert = identical AST for the whole fixture corpus. Bun tests green. Commit.

### Stage 6.3 — iOS dual-read + native execution

**Files.** `ios/evy/UI/EVYActionParser.swift` (decode object branches into `EVYActionInvocation`; string branches still parsed the old way), `ios/evy/UI/EVYActionRunner.swift` (execute from the invocation enum — the string path converts to the same enum first, so there is **one** execution path and the legacy parser becomes a front-end), `ios/evyTests/EVYActionRunnerTests.swift` (duplicate the key scenarios in AST form; the string-form tests stay until stage 6.6).

**Steps.** Failing tests first (AST-form create/update/navigate/show/select through the runner, including sequencing semantics unchanged); implement enum + single execution path; malformed AST decode = loud error with row id (consistent with 0C). `evyTests` green; iOS e2e still green (fixtures still strings at this point — proves dual-read).

### Stage 6.4 — Web native AST editing

**Files.** `web/app/utils/actionBranch.ts` (parse/serialize handles both shapes; internal editor model becomes the AST), `web/app/components/actionPopup/BranchEditor.tsx` (edits the AST; the arg-slot widgets map 1:1 to typed fields — this mostly *simplifies*), `web/app/components/ActionEditor.tsx` (summary cards from AST), `web/app/utils/createDraftSignals.ts` (reads `mode` from AST instead of marker strings), unit + Playwright tests (`web/integration/configuration.pw.ts`).

**Behavioral rule.** Editing a legacy string action converts it to AST **on save** (never on load — opening and cancelling must not rewrite rows). Unconvertible strings (parser can't recognize them) render read-only with a visible "unrecognized action" state instead of today's silent "None" + lossy rewrite.

### Stage 6.5 — Fixture + data migration

**Files.** New `scripts/migrate-actions-to-ast.ts` (reads all `rows` via the api or directly via Drizzle, converts every string branch with the 6.2 converter, writes back; idempotent; `--dry-run` prints a diff summary and every unconvertible string); fixtures `scripts/fixtures/**/*_sdui.json` rewritten to AST form (run the converter over the fixture files — script it, don't hand-edit); `scripts/seed.ts` + `types/validators.ts` (`validateUiFlow` accepts both, warns on strings).

**Steps.** Dry-run against a seeded dev DB → zero unconvertibles; convert fixtures; reseed; **full e2e including iOS** (this is the highest-risk stage — the entire marketplace flow suite runs on AST actions); run the migration against the dev DB; commit fixtures + script separately from the runtime changes.

### Stage 6.6 — Retire the string path

After 6.5 has soaked (all environments migrated, an iOS release with dual-read is out if there are external installs — for a dev-stage platform this can be immediate): schema drops the `string` branch from the `oneOf` (API now rejects string actions); delete the legacy branch parsers on both platforms (`EVYActionParser` string front-end, web `parseBranch` legacy mode, `serializeInvocationToLegacyString`); delete the corresponding WART vectors and the `action-branch` legacy category from the corpus; update `docs/evy/sdui.md` to AST-only. Commit `[REFACTOR] Remove legacy action-string parsing`.

**Exit criteria for Phase 6.** No `{fn(...)}` branch strings in schema, fixtures, DB, or parsers; API rejects malformed actions with field-level errors; builder and iOS share one validated contract; the two save-time inference/rewrite mechanisms are gone.

---

## Phase 7 — First-class sync: server cursor + tombstones (big rock 2)

**Goal.** `sync` becomes a top-level RPC with a server-issued cursor and deletion propagation, with per-resource error isolation. Kills the client-clock skew class, the "deletes never propagate" class, and the storage-version-wipe hack. Prerequisite: 0B (iOS applies delete pushes).

**Context.** `api/src/procedures/sync.ts` (~24–90), `api/src/procedures/coreApi.ts` (~19–32), `api/src/index.ts` (method registration), `api/src/data/resources/coreResource.ts` (list/`updatedAfter` ~30–161, delete ~114–161), `services/marketplace/src/data.ts` (delete path), `types/schema/rpc/` (sync request/response schemas), iOS `ios/evy/Core/EVY+Sync.swift`, `EVY.swift` (~23–54 storage-version wipe, ~36 `markSynced` client clock), `EVY+Stores.swift` (~33–43 sortIndex re-enumeration bug), web `web/app/api/sync.ts` (~149–156 EPOCH-every-load), `web/app/api/wsClient.ts`.

### Stage 7.1 — Top-level `sync` method + server cursor

- Register `sync` in `api/src/index.ts`; keep `api{method:"sync"}` delegating to it (removal noted for a later cleanup).
- Response gains `cursor: string` — server-generated inside the sync transaction: `max(updatedAt)` observed across returned rows, else the previous cursor echoed, else server `now()`. Request accepts `cursor` (opaque) with `lastSyncTime` honored as legacy alias during the window.
- Schemas: `types/schema/rpc/sync.request.schema.json` / new `sync.response` additions; typegen.
- Tests in `api/src/tests/sync.test.ts`: cursor monotonicity; a row written between two syncs appears exactly once; clock-skewed client timestamp irrelevance (cursor comes from server).

### Stage 7.2 — Tombstones

- Schema: add optional `deletedAt: string(date-time)` to every `DATA_EVY_*` row type in `data.schema.json` (except `devices` — out of scope) + marketplace `Data` table (`services/marketplace/src/schema.ts` — direct column, it is not schema-generated; check). Migrations for both DBs.
- `coreResource.remove` → soft delete (stamp `deletedAt`, bump `updatedAt`, notify with `operation: "delete"`); same in marketplace `data.ts`.
- List semantics: plain `get` filters `deletedAt IS NULL`; `get` with `updatedAfter`/cursor **includes** tombstoned rows (clients need them to delete locally).
- Files resource: soft delete keeps the metadata row as tombstone; binary removal from disk stays immediate.
- Tests: delete → immediate `get` omits the row; incremental sync after delete includes the tombstone; create-after-delete with the same id behaves sanely (recommend: rejected — tombstone occupies the id).
- Note: a tombstone purge job is deliberately deferred; record row counts stay small at this stage. Add a `// PURGE:` marker comment where it would go.

### Stage 7.3 — iOS consumes cursor + tombstones

- `EVY+Sync.swift`: persist and send the server cursor (migrate from `lastSyncTimestamp`: if only the old key exists, do one legacy-timestamp sync then store the returned cursor); on tombstoned rows, delete locally (reuse 0B's store-removal path).
- Fix the **sortIndex re-enumeration bug** while in here: incremental deltas must not renumber local collections from 0 (`EVY+Stores.swift` ~33–43). Decide: full-sync assigns order; delta upserts preserve the existing row's sortIndex (new rows append). Add a regression test: two-row store, delta updates row B, order unchanged.
- Bump `syncStorageVersion` once (the wipe mechanism stays as an escape hatch but should not be needed again for deletions).
- Tests: hermetic transport returning cursors + tombstones; assert store state.

### Stage 7.4 — Web incremental + push

- `web/app/api/sync.ts`: store the cursor (in-memory is fine — per-session); subscribe to `dataChanged` in `wsClient` and patch `FlowEntityMaps` via a new `pageReducer` action (`RECORD_PUSHED`), honoring `operation: "delete"`. Guard against clobbering in-flight local edits: skip patches for entities with unsaved local changes newer than the push (compare `updatedAt`; log conflicts).
- This is the cheap fix for concurrent-builder clobbering flagged in the audit; full optimistic locking (`updatedAt` preconditions on update RPCs) is a natural rider here — include it if scope allows: `wsClient.writeRecord` sends `expectedUpdatedAt`, API compares and returns a conflict error, builder toasts and re-syncs. If cut, file it as follow-up.
- Playwright: extend `web/integration/websocket.pw.ts` with a pushed-update scenario.

### Stage 7.5 — Per-resource error isolation

- `sync.ts`: replace all-or-nothing `Promise.all` with settled results; response gains `errors: [{service, resource, message}]` alongside `data`; one unreachable external service yields its resources in `errors` while everything else syncs.
- Clients: iOS logs + surfaces a non-blocking warning; web logs. Cursor advancement rule: **do not** advance the stored cursor past a failed resource — simplest correct rule: if `errors` is non-empty, clients keep their previous cursor (data still applied; next sync re-fetches some rows idempotently).
- Tests: kill-marketplace scenario in `api/src/tests/sync.test.ts` (there is precedent for adapter mocking in `services.test.ts`).

**Exit criteria.** Deletes propagate to offline clients via sync and online clients via push; cursors are server-issued; a down service degrades sync instead of failing it; web receives live updates; full e2e green including iOS.

---

## Phase 8 — Scope-as-value on iOS (big rock 3)

**Goal.** Expression resolution takes an explicit scope value instead of reading the global mutable statics `EVY.activeCacheScopeId` / `EVY.draftStore.activeScopeId`. Removes the `onAppear` re-assertion choreography (`ios/evy/UI/EVYPage.swift` ~82–95), the save-swap-restore hacks (`ios/evy/Data/EVYSearchModel.swift` ~41–43/71–73, `ios/evy/UI/Rows/View/EVYPhotoGalleryRow.swift` ~35–37), and unblocks any future off-main rendering. Do Phase 1 first so behavior is pinned.

**Context to read.** `ios/evy/Utils/interpreter.swift` (`_resolveBindingRoot` ~250–297 — the reads of the globals), `ios/evy/Data/EVYDraftStore.swift`, `ios/evy/Data/EVYState.swift`, `ios/evy/UI/EVYPage.swift`, `ios/evy/ContentView.swift` (~148–154 scope injection per route), `ios/evy/Core/EVY+Mutations.swift` (`updateData` ladder), `ios/evy/Data/Models/EVYDraft.swift` (scope id derivation).

### Stage 8.1 — Introduce the value type and thread it through the interpreter core

- New `ios/evy/Core/EVYResolutionScope.swift`: `struct EVYResolutionScope { let cacheScopeId: String; let draftScopeId: String }` plus `static var legacyGlobal: EVYResolutionScope { … reads the current statics … }`.
- Add a `scope: EVYResolutionScope` parameter (defaulted to `.legacyGlobal`) to the interpreter entry points and down through `_resolveBindingRoot`, draft-store reads, cache reads. Mechanical, wide diff, zero behavior change.
- Run the Phase 1 corpus + full `evyTests`: zero diffs expected.

### Stage 8.2 — `EVYState` carries its scope

- `EVYState` captures the scope at construction and passes it to recompute closures; `EVYPage`/`EVYRow` construct states with the scope from the environment (`ContentView` already injects per-route scope — extend the environment value to carry the full `EVYResolutionScope`).
- Tests: a background (non-active) page's `EVYState` recomputes against *its own* scope even when another page has since "activated" — this is the exact bug class the globals caused; write it as a regression test first.

### Stage 8.3 — Migrate writers and remove the swap hacks

- `EVY.updateData` and mutation paths take the scope explicitly (callers: rows, action runner — the runner gets the scope from the row that triggered it).
- Delete the save-swap-restore in `EVYSearchModel` and `EVYPhotoGalleryRow`; pass scope instead.
- `EVYPage.activatePageScope` shrinks to setting the *navigation-level* notion of "current scope for new work" only if anything still needs it — target state: it only updates the environment, no statics.

### Stage 8.4 — Retire the globals

- Remove `.legacyGlobal` and the statics; the compiler surfaces every remaining implicit reader. Delete the apologia comments in `EVYPage`. Keep `evyTests` + corpus + iOS e2e green.
- Also in this stage (same theme, tiny): make `interpreter.swift`'s `regexPatternCache` concurrency-safe (immutable precompiled table or a lock) — it is a non-isolated mutable global the strict-concurrency checker will flag.

**Exit criteria.** No global scope statics; no swap-restore; sheet/navigation/async interleavings resolve against the scope of the row that rendered them; corpus unchanged.

---

## Phase 9 — Procedures registry (big rock 4)

**Goal.** Replace the two-entry `coreApiHandlers` map and the hand-maintained one-entry `types/apiDataSources.ts` with a schema-per-procedure registry: name → request schema → response schema → handler; generated into client-facing metadata (web source picker); forwarding semantics so external services can expose procedures. Rate-limit hook for `place_search` (no auth involvement).

**Context.** `api/src/procedures/coreApi.ts` (~19–32), `api/src/procedures/rpc.ts` (~42–46: the core-only rejection), `api/src/procedures/placeSearch.ts`, `types/apiDataSources.ts` (~16–18), `ios/evy/Core/EVY+Source.swift` (~16–23: `$api:` classification), `ios/evy/Data/EVYSearchRequesting.swift`, web `web/app/utils/sourceBinding.ts` + wherever the builder offers `$api:` sources (search `API_DATA_SOURCE_ATTRIBUTES` consumers).

**File structure.**

| File | Status | Responsibility |
| --- | --- | --- |
| `types/schema/rpc/procedures/place_search.schema.json` (+ `sync` if not already first-class post-Phase 7) | new | per-procedure request/response |
| `types/schema/resources/procedures.json` | new | registry manifest: name, owning service (core or service UUID), request/response schema paths, client metadata (result attributes for builder autocomplete — replaces `apiDataSources.ts`) |
| `scripts/generate-procedures.ts` | new | emits TS registry (`types/generated/ts/procedures.ts`) + Swift constants; wired into `types:generate:resources` |
| `api/src/procedures/coreApi.ts` | rewrite | dispatch + ajv validation driven by the registry |
| `api/src/procedures/rpc.ts` | modify | `api` calls for non-core services forward to the service adapter when the registry declares the procedure for that service; otherwise reject with a precise error |
| `api/src/procedures/rateLimit.ts` | new | simple in-memory token bucket keyed by socket, applied per-procedure via registry config (`rateLimit: {perMinute: n}`); `place_search` gets a sane default |
| `services/marketplace/src/rpc.ts` | modify | register an `api` method (even with zero procedures initially) so forwarding has a target contract |
| `web/app` source picker | modify | options generated from the registry (delete `apiDataSources.ts`) |
| `types/apiDataSources.ts` | delete | superseded |
| `api/src/tests/rpcApi.test.ts`, `placeSearch.test.ts` | modify | registry dispatch, validation failures, rate limiting, forwarding rejection/acceptance |
| `docs/evy/data.md` / `api/README.md` | modify | document procedures as a first-class concept |

**Steps.**
1. Write the manifest + schemas for the existing procedures, matching current wire behavior exactly (golden-test against recorded current responses before refactoring).
2. Generator + typegen; commit.
3. Failing api tests: unknown procedure → precise error; invalid `place_search` request → schema error; valid → unchanged response; per-socket rate limit trips at the configured threshold; procedure declared for marketplace forwards; undeclared external procedure rejected.
4. Rewrite `coreApi.ts` dispatch off the registry; implement forwarding + rate limiter; tests green.
5. Web: generate the source picker options; verify builder autocomplete for `$api:place_search` result attributes still works (Playwright `builderAssistFlow.pw.ts`).
6. iOS: no behavior change required (`$api:<name>` already sends `api {method: name}`); verify Search e2e.
7. `./run-e2e.sh --skip-ios`; iOS e2e; `bun run format`; commit `[FEAT] Schema-driven procedures registry with forwarding and rate limits`.

---

## Standing verification block (every phase)

```bash
bun run types:generate
bun run --cwd api build && bun run --cwd api lint && bun run --cwd api test:unit
bun run --cwd web build && bun run --cwd web lint && bun run --cwd web test:unit && bun run --cwd web test:integration
bun run --cwd services/marketplace test:unit
./run-e2e.sh --skip-ios
bun run format
```

Plus: Xcode build (iPhone 17 / iOS 26.5) and `evyTests` for any phase touching `ios/`; iOS e2e run separately with services kept up. Reseed the dev DB (`bun run db:seed`) after any test run that may have fired live RPCs.

## Explicitly not in this plan (by decision or later sequencing)

- Auth enforcement, identity, server-side visibility filtering, devices, addresses — deliberate placeholders; do not touch.
- Web quick-fix batch beyond the Modal (self-show placeholder replacement, dynamic service namespaces, row-cloning pipeline collapse) — worthwhile, but not part of the audit's core sequencing; schedule opportunistically.
- serviceKit extraction, DB driver unification, iOS Observation-native invalidation, tombstone purge job, optimistic locking (if cut from 7.4) — noted follow-ups.
