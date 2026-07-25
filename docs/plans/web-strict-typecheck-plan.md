# Web Strict Typecheck — Implementation Plan

**Goal.** `bun run --cwd web typecheck` (i.e. `tsc --noEmit -p web/tsconfig.json`) passes with zero errors and runs as a gate in `web.yml` CI, so a type-level protocol mistake like `notification.record` (a field `DataChangedNotification` never had) can no longer ship.

**Why this exists.** The web build (`dev/build.ts`, Bun bundler) strips types without checking them, and `bun test` doesn't typecheck either. During the architecture-audit work, `WSClient` read `notification.record` — the contract exposes `value` — and every suite stayed green while remote-push version tracking silently never ran. `web/tsconfig.json` already has `strict: true`; nothing executes it.

**Baseline.** ~63 errors across 22 files as of `b2e5706d` (capture the exact number in Phase 0 — it is the progress meter for every later task). Reproduce with:

```bash
cd web && ../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

**Scope guard.** Never hand-edit anything under `types/generated/` — fix the schema or the generator and regenerate. Runtime behavior must not change except where a task explicitly says it does; the existing unit/integration suites are the behavioral safety net for every task.

---

## Root-cause inventory

Every error traces to one of seven causes. Fixing causes, not call sites, is the plan.

| # | Cause | Errors | Files |
| --- | --- | --- | --- |
| 1 | `DATA_EVY_RowData` schema pairs typed `properties` with `additionalProperties: {$ref JSONValue}`; json-schema-to-typescript emits both an index signature and named optional props, and TS2411 rejects the combination (`UI_RowActions` has no index signature; optional props add `undefined`, which the JSONValue union lacks) | 16 generated + 5 app (assignments *to* `DATA_EVY_RowData`) | `types/generated/ts/data/data.ts`, `rpc/{create,update,delete}.response.ts`, `web/app/utils/flatGraph.ts` |
| 2 | `rpc-websockets` ships `dist/index.d.ts` but its `exports` map has no `types` condition, so `moduleResolution: "bundler"` cannot resolve declarations (TS2307) | 1 | `web/app/api/wsClient.ts:13` |
| 3 | `parseBranch(branch: UI_ActionBranch)` is called with editor *strings* — the editor's internal representation (a deliberate phase-6 decision) — which works at runtime because `branchToEditableString` accepts strings, but the signature says otherwise | 5 | `actionBranch.ts:202,231`, `createDraftSignals.ts:77,126`, `BranchEditor.tsx:132` |
| 4 | Palette row configs are typed `UI_RowActions` but hold editor-string branches: `rowAction(branch: string)` builds `{true: "<string>"}` (`rowActions.ts:7`), used by `defineRow.tsx`'s `defaultRowActions` for every sidebar row | 1 direct, more once cause 3 is fixed | `web/app/utils/rowActions.ts`, `web/app/rows/defineRow.tsx`, `web/app/types/row.ts:26` |
| 5 | Small real production type holes: `OperandEditor` reads `parsed.value` before narrowing the `ParsedOperand` union; `decodeFlow.ts` types nested rows as `{}`; `rowCodec.ts:61` puts `string \| undefined` in a required field; `serverFlowDecompose.ts` builds `DATA_EVY_Flow/Page` without required `visibility` | 8 | `OperandEditor.tsx:97`, `decodeFlow.ts:219,225`, `rowCodec.ts:61`, `serverFlowDecompose.ts` (4) |
| 6 | Test fixtures use the retired legacy string-action format (`true: "{show(...)}"`) and omit required `visibility` — the web mirror of the iOS 1A cleanup | ~27 | `actionBranch.test.ts` (14), `decodeFlow.test.ts`, `pageReducer.test.ts`, `flatGraph.test.ts`, `idCandidates.test.ts`, `urlUtils.test.ts`, `grammarConformance.test.ts`, `actionVariables.test.ts` |
| 7 | No `typescript` dependency is declared anywhere (today's tsc binary is a transitive dep of `json-schema-to-typescript` at root) and no script or CI step runs it | 0 errors, the reason nothing catches the rest | `web/package.json`, `.github/workflows/web.yml` |

## Evidence gathered (do not re-derive)

- **Swift generation is unaffected by cause-1's schema change.** `scripts/generate-types.ts` quicktypes only `data/os` and `files/file` (`SWIFT_QUICKTYPE_SCHEMAS`); SDUI Swift comes from `generate-swift-sdui.ts`, which reads `evy.schema.json` + `sdui/definitions/*`, not `data.schema.json`.
- **Drizzle generation is unaffected.** `generate-drizzle.ts` reads column definitions from `drizzle.config.json`; `DATA_EVY_RowData` is the payload of a `jsonb` column, whose `additionalProperties` it never inspects.
- **ajv semantics of the schema change are identical for wire input.** `additionalProperties: true` and `additionalProperties: {$ref JSONValue}` accept exactly the same set of JSON documents (JSONValue matches any JSON). API test suites confirm.
- **`rpc-websockets` is already in `web/package.json`** — cause 2 is purely a `types` resolution gap, not a missing dependency.
- **`serverFlowDecompose` output never reaches the server as-is.** Its only production consumer is `flowEntities.ts` (injected/nested flow decomposition); flat records the builder *saves* go through `rowCodec`/`flatGraph`. So adding `visibility` is type-truth restoration, not a wire change — Phase 2's investigation step confirms this before fixing.
- **tsconfig scope is `app/**` + `dev/**`.** `integration/` and `e2e/` (`*.pw.ts`) are outside it. Keep it that way for this plan; extending is a possible follow-up, not in scope.

---

## File structure

No new production modules. Files touched, by responsibility:

| File | Status | Responsibility in this plan |
| --- | --- | --- |
| `web/package.json` | modify | `typescript` devDependency; `"typecheck": "bunx tsc --noEmit"` script |
| `web/tsconfig.json` | modify | `paths` mapping for `rpc-websockets` types (cause 2) |
| `types/schema/data/data.schema.json` | modify | `DATA_EVY_RowData.additionalProperties` → `true`, with a comment-in-description saying why (cause 1) |
| `web/app/utils/actionBranch.ts` | modify | add `parseBranchText(text: string)`; `parseBranch` delegates; string call sites move over (cause 3) |
| `web/app/utils/createDraftSignals.ts`, `web/app/components/actionPopup/BranchEditor.tsx` | modify | call the text entry point where they hold editor strings (cause 3) |
| `web/app/utils/rowActions.ts`, `web/app/rows/defineRow.tsx`, `web/app/rows/*.tsx` configs | modify | palette defaults become structured invocations; `rowAction` honestly typed (cause 4) |
| `web/app/components/actionPopup/OperandEditor.tsx` | modify | narrow before reading `.value` (cause 5) |
| `web/app/utils/decodeFlow.ts` | modify | type nested rows as `UI_Row`, not `{}` (cause 5) |
| `web/app/utils/rowCodec.ts` | modify | eliminate the `string \| undefined` hole (cause 5) |
| `web/app/utils/serverFlowDecompose.ts` | modify | explicit `visibility` on constructed records (cause 5, after investigation) |
| `web/app/**/*.test.ts` (8 files) | modify | structured-invocation fixtures, `visibility` on fixtures, union guards (cause 6) |
| `.github/workflows/web.yml` | modify | typecheck step between lint and build (cause 7, last) |
| `docs/plans/architecture-audit-implementation-plan.md` | modify | close the "Make the web build typecheck" remaining-work item |

Files deliberately **not** touched: anything in `types/generated/` (regenerated only), `node_modules` (never), other packages' tsconfigs (api/marketplace typecheck is a separate follow-up).

---

## Phase 0 — Tooling and baseline

1. Add `typescript` (`^5`) to `web/package.json` `devDependencies`. Run `bun install --force` in `web/` (forced: `file:` deps are copied, not linked — see the evy-types memory; same staleness applies to fresh dep additions).
2. Add script to `web/package.json`: `"typecheck": "bunx tsc --noEmit"`.
3. Run `bun run --cwd web typecheck`. It must fail. Record the exact error count and the per-file grouping in the commit message — this is the baseline every later task shrinks.
4. Commit: `[CHORE] Add web typecheck script (fails: N errors, baseline)`. A failing check that exists beats a green check that doesn't; CI wiring waits until Phase 4.

## Phase 1 — Kill the generated-type errors (cause 1)

The one schema change with the widest blast radius; do it first so later counts are clean.

1. In `types/schema/data/data.schema.json`, change `DATA_EVY_RowData.additionalProperties` from `{"$ref": ".../JSONValue"}` to `true`. Extend the def's `description`: unknown keys are unconstrained JSON; `true` rather than the JSONValue ref because json-schema-to-typescript renders the ref as a closed index signature that TS2411-conflicts with the typed properties, while `true` renders `[k: string]: unknown` — identical validation for wire input.
2. `bun run types:generate`.
3. Inspect `types/generated/ts/data/data.ts` — the `DATA_EVY_RowData` index signature must now be `[k: string]: unknown` and the four typed properties must remain (`actions`, `sheet_row_id`, `child_row_id`, `children_row_ids`).
4. Run `bun run --cwd web typecheck` — the 16 generated-file errors and the 5 `flatGraph.ts` assignment errors must be gone. If any app code *read* `row.data[...]` relying on the old JSONValue union, new errors appear here; fix by narrowing at the read site (the pattern `rowTraversal.ts` already uses).
5. Regression check, since this schema feeds ajv: `bun run --cwd api test:unit`, `bun run test:scripts`, `bun run --cwd web test:unit`, and `bun run --cwd services/marketplace test:unit`.
6. Confirm no unexpected generation drift: `git status` — only `data.schema.json` changed (generated output is gitignored).
7. Commit: `[FIX] RowData unknown-key schema no longer fights the TS generator`.

## Phase 2 — Production code fixes (causes 2–5)

Each numbered item: fix → `bun run --cwd web typecheck` (count must drop, nothing new) → focused tests → commit. One commit per item.

**2a — rpc-websockets types (cause 2).**
1. In `web/tsconfig.json` add `compilerOptions.paths`: `{"rpc-websockets": ["./node_modules/rpc-websockets/dist/index.d.ts"]}` (requires `baseUrl: "."`, already set). This is a types-only mapping — the bundler still resolves the runtime module through the exports map; the upstream gap is the missing `types` condition in the package's exports.
2. Typecheck: TS2307 in `wsClient.ts` gone. **New errors may surface inside `wsClient.ts`** now that `Client` is actually typed — fix them; they are exactly the class of bug this plan exists for. Run `bun run --cwd web test:unit` and the `remoteRecords`/`saveConflict`/`websocket` integration specs.

**2b — editor-string vs stored-branch entry points (cause 3).**
1. In `actionBranch.ts`, add `parseBranchText(branchText: string): ParsedBranch | null` holding the current implementation body; reduce `parseBranch(branch: UI_ActionBranch)` to `parseBranchText(branchToEditableString(branch))`.
2. Move the string-holding call sites to `parseBranchText`: `actionBranch.ts:202,231` (`finalizeCreateBranchForSave`, the display-label path), `createDraftSignals.ts:77,126`, `BranchEditor.tsx:132`.
3. Typecheck, then `bun test app/utils/actionBranch.test.ts app/utils/createDraftSignals.test.ts` from `web/`.

**2c — palette defaults become structured invocations (cause 4).**
The decision: editor strings stay editor-internal; *configs* are storage-shaped. `branchToEditableString` already converts invocations for editing, and `normalizeStoredRowActions` accepts structured input, so defaults-as-invocations is the smaller change.
1. Change `defaultRowActions` (`defineRow.tsx`) and `rowAction` (`rowActions.ts`) to take `UI_ActionInvocation | ""` instead of `string`.
2. Update every palette config call site (grep `defaultRowActions(` under `web/app/rows/`): `"{select($datum)}"` → `{ fn: "select", value: "$datum" }`, `"{show(...)}"` self-show placeholders → their structured forms, etc. Consult `types/generated/ts/sdui/action.ts` for the variant shapes.
3. Typecheck; then the behavior net: `bun run --cwd web test:unit` and the drag/config integration specs (`dragAndDrop`, `configuration`, `rows`) — dropping a palette row must still inject working defaults, e.g. `injects show-self tap default when dropping a Dropdown row`.

**2d — small holes (cause 5).**
1. `OperandEditor.tsx:97`: compute `valueMatchesVariableOption` only after (or guarded by) `parsed.type === "value"` so the union narrows; behavior identical (it was `undefined`-comparing before).
2. `decodeFlow.ts:219,225`: type `ServerRow`'s `child`/`sheet`/`children` as `ServerRow`/`ServerRow[]` rather than `{}`.
3. `rowCodec.ts:61`: make the offending field's source non-optional or supply the explicit fallback the runtime already implies.
4. `serverFlowDecompose.ts`: **investigate first** — confirm (per the evidence section) its records never go to the server unmodified; then set `visibility: "public"` (the DB default) on constructed flow/page/row records with a one-line comment. If investigation contradicts the evidence, stop and reassess rather than paper over it.
5. Typecheck after each; `bun run --cwd web test:unit` once at the end; commit per sub-item or as one `[FIX] Close web production type holes` if each is a few lines.

## Phase 3 — Test fixtures (cause 6)

Mirror of iOS 1A: fixtures move to the formats production actually stores.

1. `actionBranch.test.ts` (14 errors): tests exercising *editor-string parsing* switch to `parseBranchText`; tests exercising *stored branches* build `UI_ActionInvocation` literals. Delete any test that only asserts behavior of the rejected legacy stored-string format (precedent: iOS 1A removed 28 such tests) — but keep string-*rejection* coverage if present.
2. `decodeFlow.test.ts`, `pageReducer.test.ts`, `flatGraph.test.ts`, `idCandidates.test.ts`: replace `{condition:"", true:"{show(...)}", false:""}` fixture actions with structured invocations.
3. `idCandidates.test.ts`, `urlUtils.test.ts` (and `serverFlowDecompose`-adjacent fixtures): add required `visibility: "public"` to flow/page/row fixture literals.
4. `grammarConformance.test.ts`, `actionVariables.test.ts`: guard the `{} | undefined` values before asserting (e.g. explicit `if (!x) throw` so the type narrows and the test still fails loudly).
5. After each file: typecheck + `bun test <file>` from `web/`. Commit: `[REFACTOR] Web test fixtures use stored action format (typecheck)`.

## Phase 4 — Turn on the gate (cause 7)

1. `bun run --cwd web typecheck` — zero errors. Run the full web verification: `build`, `lint`, `test:unit`, `test:integration`.
2. Add a typecheck step to `.github/workflows/web.yml` between lint and build (same job, fail-fast ordering: lint → typecheck → build → tests). Match the existing step syntax in that file.
3. Update `docs/plans/architecture-audit-implementation-plan.md`: move "Make the web build typecheck" from Remaining to Completed, pointing at the script + workflow step.
4. If `AGENTS.md`/root `README.md` enumerate per-package check commands, add `typecheck` there.
5. Full sweep before the final commit: `bun run types:generate` (no drift), `./run-e2e.sh --skip-ios`, `bun run format`. Commit: `[FEAT] Web typecheck gates CI`.

---

## Validation

After each task: `bun run --cwd web typecheck` (count strictly decreases; no new errors) plus the focused tests named in the task.

After each phase:

```bash
bun run --cwd web build && bun run --cwd web lint && bun run --cwd web test:unit && bun run --cwd web test:integration
```

Phase 1 additionally requires `bun run --cwd api test:unit`, `bun run test:scripts`, `bun run --cwd services/marketplace test:unit` (shared schema), and Phase 4 ends with `./run-e2e.sh --skip-ios` from a clean Docker volume plus `bun run format`.

iOS is expected to be untouched (see evidence on Swift generation); if Phase 1 shows any diff in Swift-relevant generation, stop — that means the evidence was wrong, and the schema change needs the iOS build/test pass (`evyTests` on iPhone 17 / iOS 26.5) before proceeding.

## Known risks

- **Typing `Client` in 2a will likely surface real latent errors in `wsClient.ts`** — budget for fixing them there; do not suppress with `any`.
- **Cause-4 palette conversion touches every sidebar row config.** The integration suite is the net; if a config was subtly relying on an unconvertible string, the drop tests catch it.
- **`@ts-expect-error` / `as any` are not acceptable end states** anywhere in this plan; if a task seems to need one, the root cause isn't found yet.
- One pre-existing open item is adjacent but out of scope: the flaky/regressed iOS e2e `testHomepageSwipeAcceptUpdatesPickupMessageStatus` (tracked separately; nothing in this plan touches iOS).
