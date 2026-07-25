# Architecture Audit — Simplification Plan

## Goal

Simplify the work on `feat/overhaul` relative to `origin/dev` without removing required behavior from the architecture audit. Prefer deleting dead paths, narrowing APIs, and reusing existing primitives over adding new abstractions.

This review covered the 156 changed files across API, marketplace, shared types/tooling, web, iOS, tests, documentation, and infrastructure.

## Principles

- Fix branch-introduced correctness issues before refactoring around them.
- Remove compatibility or migration code once it has no production consumer.
- Share logic only where two implementations already need to remain behaviorally identical.
- Keep generated migrations, schemas, and generated outputs generated.
- Do not remove tests that protect live behavior; remove tests only with the dead API or compatibility path they exclusively exercise.
- Do not add generalized frameworks for one or two call sites.

## Phase 0 — Correctness issues exposed by the review

These items should happen first because later simplifications depend on the corrected boundaries.

### 0A — Normalize web `dataChanged` records once and prevent echo saves

**Files**

- [`web/app/api/wsClient.ts`](../../web/app/api/wsClient.ts)
- [`web/app/state/AppProvider.tsx`](../../web/app/state/AppProvider.tsx)
- [`web/app/state/reducers/pageReducer.ts`](../../web/app/state/reducers/pageReducer.ts)
- Related unit/integration tests

**Problem**

`WSClient.rememberVersionFromNotification` reads `notification.record`, but the notification contract exposes `value`. `AppProvider` separately normalizes `value`, so transport state and UI state interpret the same protocol in different places. Applying a remote record also changes the maps watched by autosave, which can write the received change back to the server.

**Simplification**

1. Validate and normalize `notification.value` into typed records in `WSClient`.
2. Use the same normalized records to update `serverVersions` and notify subscribers.
3. Change subscribers to receive normalized records rather than raw protocol payloads.
4. Mark remote-origin map updates so they advance the autosave baseline without entering the local save path.
5. Remove payload casts and normalization from `AppProvider`.

**Acceptance criteria**

- A pushed `updatedAt` becomes the next write precondition.
- Remote creates, updates, arrays, and tombstones update local state.
- Applying a remote record does not emit an outbound create/update/delete.
- The `notification.record` diagnostic is gone.

### 0B — Restrict page-reference discovery to rows on each page

**File**

- [`web/app/utils/pageReferences.ts`](../../web/app/utils/pageReferences.ts)

**Problem**

`findPageReferences` scans every global row for every page, so a matching row can be reported as belonging to pages that do not contain it. The subsequent deduplication cannot correct this because the incorrect page ID is part of the key.

**Simplification**

1. Traverse only each page's root rows and descendants with the existing row-walking utility.
2. Emit references during that traversal.
3. Remove the global row scan and deduplication pass.
4. Let `branchReferencesPage` accept the stored action branch directly; `parseBranch` already supports structured branches.

**Acceptance criteria**

Add coverage for two pages, an orphan row, a nested row, and an exact expected page label/count.

### 0C — Make the web flow-submission target atomic

**Files**

- [`web/app/components/ConfigurationPanel.tsx`](../../web/app/components/ConfigurationPanel.tsx)
- [`web/app/components/actionPopup/BranchEditor.tsx`](../../web/app/components/actionPopup/BranchEditor.tsx)
- [`web/integration/configuration.pw.ts`](../../web/integration/configuration.pw.ts)

**Problem**

Changing the service currently persists `{ service, resource: "" }`, although the schema requires a non-empty resource. The two-step editor therefore creates an invalid intermediate flow and duplicates service/resource option construction already needed by `BranchEditor`.

**Simplification**

1. Replace the service and resource controls with one selector of complete `{ service, resource }` targets plus “None.”
2. Share the existing service/resource option builder with `BranchEditor`.
3. Dispatch only a complete target or `undefined`.
4. Remove both partial-change handlers, `submitsResourceOptions`, and the invalid-intermediate-state comment.

**Acceptance criteria**

The integration test selects and clears a concrete target, and no persisted update contains an empty resource.

## Phase 1 — Delete dead and transitional code

### 1A — Remove legacy action-string conversion from the iOS app target

**Files**

- [`ios/evy/UI/EVYActionParser.swift`](../../ios/evy/UI/EVYActionParser.swift)
- [`ios/e2e/e2e.swift`](../../ios/e2e/e2e.swift)
- [`ios/evyTests/XCTestCase+UniqueKey.swift`](../../ios/evyTests/XCTestCase+UniqueKey.swift)
- Parser-only portions of [`ios/evyTests/EVYActionRunnerTests.swift`](../../ios/evyTests/EVYActionRunnerTests.swift)

**Evidence**

Stored non-empty strings are rejected, production execution accepts only `EVYActionInvocation`, and `EVYActionParser.invocation` is used only by tests/tooling. E2E has a second parser for the same retired syntax.

**Simplification**

1. Remove `invocation`, `createAction`, `updateAction`, function-call helpers, and parser-only model types from the app target.
2. Retain only the narrow object-value parser still used at runtime, renamed for that role.
3. Prefer typed invocation factories in unit tests.
4. If compact E2E authoring remains valuable, keep one test-target-only converter rather than shipping and duplicating it.
5. Remove tests that exclusively validate the rejected legacy format; keep structured Codable and execution coverage.

### 1B — Remove the dormant marketplace procedure endpoint

**File**

- [`services/marketplace/src/rpc.ts`](../../services/marketplace/src/rpc.ts)

Marketplace declares no procedures, and gateway dispatch rejects undeclared procedures before forwarding. Remove the speculative `server.register("api", ...)` handler. Add a handler when the first marketplace-owned procedure is declared.

Keep service-forwarding tests that exercise real gateway behavior.

### 1C — Remove unused rate-limiter cleanup

**Files**

- [`api/src/procedures/rateLimit.ts`](../../api/src/procedures/rateLimit.ts)
- [`api/src/tests/rateLimit.test.ts`](../../api/src/tests/rateLimit.test.ts)

`RateLimiter.forget` has no production caller; stale windows are already bounded by sweeping. Remove the method and its method-only test. Reintroduce explicit cleanup only if socket lifecycle code actually uses it.

### 1D — Remove the undocumented seed-only marketplace endpoint path

**Files**

- [`scripts/seed.ts`](../../scripts/seed.ts)
- [`.env.example`](../../.env.example)

`marketplaceEndpointColumns` reads undocumented `SEED_MARKETPLACE_WS_HOST/PORT`, while normal environments configure `MARKETPLACE_WS_HOST/PORT`. The standard seed path therefore always stores null and relies on the API fallback.

Remove the helper, its spread into the marketplace service row, and inaccurate environment prose. Keep persisted `wsHost/wsPort` columns for real service registration.

### 1E — Time-box the one-off action migration

**Files**

- [`scripts/migrate-actions-to-ast.ts`](../../scripts/migrate-actions-to-ast.ts)
- [`scripts/action-ast-conversion.test.ts`](../../scripts/action-ast-conversion.test.ts)
- [`docs/evy/sdui.md`](../evy/sdui.md)

Before rollout, remove the already-completed fixture-writing mode and retain only database dry-run/migration behavior. After every environment reports zero legacy branches, delete the migration script and its documentation reference. Keep the fixture regression test that prevents legacy branches from returning.

### 1F — Tighten unused exports and access levels

Apply only the following verified changes; do not perform a broad public-API rewrite.

- Delete unused `isConflictError` from [`api/src/data/conflicts.ts`](../../api/src/data/conflicts.ts).
- Make `ExternalServiceRow` private in [`api/src/data/data.ts`](../../api/src/data/data.ts).
- Make `PurgeResult` private in [`api/src/data/tombstones.ts`](../../api/src/data/tombstones.ts).
- Make `ActionConversion` private in [`types/actionAst.ts`](../../types/actionAst.ts).
- Make `DraftSignals` private in [`web/app/utils/createDraftSignals.ts`](../../web/app/utils/createDraftSignals.ts).
- Delete the test-only [`web/app/utils/apiDataSources.ts`](../../web/app/utils/apiDataSources.ts) facade and test the production `idCandidates` path instead.
- Remove `isUnstorableBranchText` from [`web/app/utils/actionBranch.ts`](../../web/app/utils/actionBranch.ts) unless it is wired into real save validation.
- Remove or internalize `EVYActionBranch.isEmpty` and `resolvedInvocation` in [`ios/evy/UI/EVYActionInvocation.swift`](../../ios/evy/UI/EVYActionInvocation.swift) by pattern-matching at their two production consumers.

## Phase 2 — Collapse duplicated logic at existing boundaries

### 2A — Validate core procedures once without `never` casts

**Files**

- [`api/src/procedures/coreApi.ts`](../../api/src/procedures/coreApi.ts)
- [`api/src/procedures/sync.ts`](../../api/src/procedures/sync.ts)

The generic `CoreProcedure` erases request types and recovers them with `as never`. Sync responses are validated in `sync`, `syncMethod`, and the registry path.

Replace each three-callback record with a direct handler accepting `unknown`. A private typed sync handler should validate the request, run sync, and validate the response once; both top-level and compatibility dispatch can call it. Keep registry matching and rate limiting unchanged.

### 2B — Traverse the UI flow row tree once during validation

**File**

- [`types/validators.ts`](../../types/validators.ts)

Trigger validation and submit-target collection currently implement the same `sheet`/`child`/`children` recursion independently. Introduce one internal flow-row walker that owns recursion and paths, then run both non-recursive checks from its callback.

Do not create a general tree framework; keep the helper local to flow validation.

### 2C — Reuse one sync resource-fetch loop

**File**

- [`api/src/procedures/sync.ts`](../../api/src/procedures/sync.ts)

`fetchEvyCoreData` and `fetchExternalServiceData` duplicate row/error accumulation, incremental request construction, empty-result handling, and error mapping.

Normalize resources to service/resource descriptors and use one private fetch loop with an injected fetch operation. Preserve current core/external `Promise.all` concurrency, device exclusion, and per-resource failure behavior.

If the resulting generic types are harder to read than the two loops, keep the loops; readability is the acceptance criterion, not line-count reduction.

### 2D — Remove redundant iOS scope APIs

**Files**

- [`ios/evy/Core/EVY+TextParsing.swift`](../../ios/evy/Core/EVY+TextParsing.swift)
- [`ios/evy/Utils/interpreter.swift`](../../ios/evy/Utils/interpreter.swift)
- [`ios/evy/UI/EVYRow.swift`](../../ios/evy/UI/EVYRow.swift)
- [`ios/evy/UI/Atoms/EVYTextView.swift`](../../ios/evy/UI/Atoms/EVYTextView.swift)
- [`ios/evy/UI/Rows/Edit/EVYInputRow.swift`](../../ios/evy/UI/Rows/Edit/EVYInputRow.swift)

The new `scope` parameters on value/condition evaluation are not forwarded into parsing. `EVYState` already installs its captured scope during initial evaluation and recomputation.

1. Remove unused scope parameters from value and condition wrappers/private functions.
2. Build visibility expressions through scoped `EVYState` even when the watch list is empty.
3. Remove unused `EVYTextView.makeState(scope:)` and `EVYInputRow.evyScope` seams.
4. Keep explicit scope on data APIs where search and photo-gallery callers use it.

### 2E — Pass one scope into iOS search

**Files**

- [`ios/evy/UI/Rows/Edit/EVYSearchRow.swift`](../../ios/evy/UI/Rows/Edit/EVYSearchRow.swift)
- [`ios/evy/UI/Views/EVYSearch.swift`](../../ios/evy/UI/Views/EVYSearch.swift)

The only production caller passes the same scope as `scopeId`, `draftScopeId`, and `scope`. Accept one `EVYScope` and derive its cache/draft IDs internally. This removes impossible combinations and two initializer parameters.

### 2F — Simplify file metadata mapping

**File**

- [`api/src/data/resources/files.ts`](../../api/src/data/resources/files.ts)

Replace the manual field-by-field metadata mapper with the existing `omitNulls`. Accept the Drizzle select-row type in binary mapping rather than casting rows to the API response type. Keep `validateGetResponse` as the boundary validator.

### 2G — Compute finalized action branches once

**File**

- [`web/app/components/ActionPopup.tsx`](../../web/app/components/ActionPopup.tsx)

Memoize one finalized `{ trueBranch, falseBranch }` result, derive `canSave` from it, and use it in the save handler. Remove the duplicate calls and dependency lists that must currently stay synchronized.

### 2H — Share only the duplicated test infrastructure

**Files**

- [`web/integration/offline.pw.ts`](../../web/integration/offline.pw.ts)
- [`web/integration/saveConflict.pw.ts`](../../web/integration/saveConflict.pw.ts)
- [`api/src/tests/bootstrap.test.ts`](../../api/src/tests/bootstrap.test.ts)
- [`api/src/tests/services.test.ts`](../../api/src/tests/services.test.ts)

1. Extract a small web JSON-RPC WebSocket mock that owns connection, login, subscription, sync, and close behavior while accepting scenario-specific write handlers. Remove the unreachable legacy wrapped-sync fallback.
2. Add one async-safe API `withEnvironment(overrides, body)` test helper that restores every key in `finally`.

Keep scenario records and assertions in each test; do not turn either helper into a general mock framework.

### 2I — Trim the generated procedure registry to consumed metadata

**Files**

- [`types/schema/resources/procedures.json`](../../types/schema/resources/procedures.json)
- [`scripts/generate-procedures.ts`](../../scripts/generate-procedures.ts)
- Generated `types/generated/ts/procedures.ts`
- [`docs/evy/data.md`](../evy/data.md)

The generator does not read `request`, while API request validation remains manually wired. Generated `PROCEDURE`, `ProcedureName`, `ProcedureMeta`, `PROCEDURE_NAMES`, and each metadata object's duplicate `name` have no external consumers.

1. Remove manifest `request` metadata and documentation claims until dispatch derives validation from it.
2. Generate only the consumed `PROCEDURES`, `proceduresForService`, and `procedureResultAttributes` surface.
3. Infer private metadata types from the generated object.
4. Inline `Object.keys(PROCEDURES)` in `proceduresForService`.
5. Regenerate output; never edit it manually.

This intentionally favors the implementation that exists today over retaining speculative registry metadata.

## Phase 3 — Documentation cleanup

### 3A — Retire contradictory legacy-action documentation

**File**

- [`docs/evy/sdui.md`](../evy/sdui.md)

Remove the legacy call-string function table and statements that the builder stores strings or that branch strings remain unchecked. Keep one structured invocation reference linked to the action schema and rewrite remaining authoring examples as structured actions.

### 3B — Stop manually mirroring schema field inventories

**Files**

- [`docs/evy/data.md`](../evy/data.md)
- [`docs/services/marketplace/data.md`](../services/marketplace/data.md)

The hand-maintained lists already omit new `submits`, service endpoint, and tombstone fields, while marketplace prose contradicts the new item schema.

Treat JSON Schema as the field-level reference. Keep only semantics that schemas do not explain well: routing, tombstones, references, representations, and examples. Do not build a new schema-to-Markdown generator.

### 3C — Replace the completed implementation plan with status and remaining work

**File**

- [`docs/plans/architecture-audit-implementation-plan.md`](architecture-audit-implementation-plan.md)

After this branch lands, replace the phase-by-phase execution instructions with a concise status/decision record:

1. Audit context and exclusions.
2. Completed decisions linked to schemas/implementations.
3. Remaining work with dependencies and acceptance criteria.
4. Explicitly deferred work.

Remove completed file inventories, commit instructions, and duplicated setup/test commands. Git history retains the execution sequence.

### 3D — Remove stale comments

- Remove the obsolete statement in [`api/src/data/resources/coreResource.ts`](../../api/src/data/resources/coreResource.ts) that tombstone purging is deferred.
- Remove comments that only explain temporary states deleted by the preceding phases.
- Do not add replacement comments where names and types make intent clear.

## Explicitly keep

The review found no worthwhile simplification in these areas:

- Generated Drizzle migrations, snapshots, and journals.
- The shared web [`Modal`](../../web/app/components/Modal.tsx) and its focus/ARIA behavior.
- The grammar conformance corpus and cross-client tests.
- The Drizzle schema/config drift check.
- The structured action schema's discriminated variants.
- Conflict, tombstone, cursor, per-resource sync degradation, reconnect, and optimistic-locking tests.
- API/marketplace forwarding wrappers whose operation-specific signatures preserve useful type clarity.
- The iOS reconnect transport protocol and core captured-scope model.
- Existing branch-added logs: they report CLI results, startup/readiness, degraded sync, save failures, or debug-only unknown operations. No obvious high-volume success-path log should be removed.

## Recommended implementation order

1. Phase 0 correctness fixes.
2. Phase 1 dead code and export removal.
3. Phase 2A–2C API/shared simplification.
4. Phase 2D–2E iOS scope simplification.
5. Phase 2F–2I local duplication cleanup.
6. Phase 3 documentation cleanup after behavior and names stabilize.

Keep commits scoped to one numbered item where practical so behavior-preserving deletions are easy to review.

## Validation

Run focused tests after each numbered item, then run the full required repository checks after each implementation batch.

### Shared/tooling

```bash
bun run types:generate
bun run test:scripts
```

### API

```bash
bun run --cwd api build
bun run --cwd api lint
bun run --cwd api test:unit
```

### Marketplace

```bash
bun run --cwd services/marketplace build
bun run --cwd services/marketplace lint
bun run --cwd services/marketplace test:unit
```

### Web

```bash
bun run --cwd web build
bun run --cwd web lint
bun run --cwd web test:unit
bun run --cwd web test:integration
```

Add a strict TypeScript diagnostic/type-checking step because the current web build did not catch the invalid `notification.record` access.

### iOS

Build and test with Xcode targeting iPhone 17 on iOS 26.5. Run focused suites first, especially reconnect, action runner, store routing, state/scope, search, content, and structured action decoding.

### End to end and formatting

```bash
./run-e2e.sh --skip-ios
bun run format
```

Run iOS E2E separately while services remain running when the changed batch touches iOS runtime behavior.
