# Home inbox tabs, and the last hard-coded swipe becomes SDUI

The homepage currently lists every open message in one `Search` row, and the accept / reject /
cancel affordances on those rows are the one piece of domain behaviour the iOS client still
hard-codes ([`EVY+MessageRequests.swift`](../../ios/evy/Core/EVY+MessageRequests.swift)). This
change replaces the single list with a `TabContainer` of three category lists, and deletes the
hard-coded rule by closing the runtime gaps that forced it into Swift:

1. **For you** — open requests for items this device owns. Swipe reveals a single **Accept**
   button; tapping the row opens a confirmation sheet with **Accept** and **Reject** buttons.
2. **From you** — open requests this device sent (items it does not own). Swipe reveals a
   single **Cancel** button.
3. **Scheduled** — requests that have been accepted (`data.value == accept`).

Every row shows the addressed item's `title` as its title and the message's `data.value` as its
subtitle. "Open" means what the item page already means by it: the latest message for the
`(fk, data.type)` pair is this request and says `pending`
(see [data.md](../evy/data.md#the-state-of-a-transfer-method-is-its-latest-message)).

After this change a row has exactly **one** swipe affordance: the `swipe-left` trigger, whose
action list (one or many entries) all runs when the revealed button is tapped. No client code
supplies extra buttons.

## Why this is now expressible (and what has to be added)

`EVY+MessageRequests.swift:9-28` names three gaps that kept the rule in Swift. This design
closes or sidesteps each:

| Gap | How this plan handles it |
| --- | --- |
| `visible` is evaluated with no datum, so a Search child cannot vary per result | Sidestepped: each tab's `Search` row filters its **source** with a new `filter()` function, so no per-result visibility is needed |
| A row has a single `swipe-left` affordance, and a recipient needs two | Requirement changed: swipe = Accept only; Reject moves into a tap-opened sheet |
| No expression can read ownership | New `owns(service, resource, id)` expression function backed by `EVY.ownedServiceResources()` |

Two smaller runtime gaps also surfaced during exploration and are part of the plan:

- A sheet presented by `show` renders with **no datum** (`EVYRow.swift:311-316` presents
  `.id(rowId)` only; `EVYSheetOverlay` at `EVYRow.swift:501-544` passes none), and container
  children never inherit their parent's datum (`EVYTabContainerRow.swift:55-58` etc.). The
  sheet's Accept/Reject buttons need `$datum` at action time, so `show` must carry the
  triggering row's datum into the sheet, and containers must pass their datum to children.
- An unresolvable `$datum.<path>` in inline action data resolves to the **literal source text**
  (`EVYObjectLiteral.swift:95-124`: `parsePropStrict` returns nil, `getDataFromText` throws,
  fallback is `.string(value)`). The shared response template must carry `time` (pickup /
  delivery) and `postalcode` (shipping) forward, and whichever key the request lacks would be
  written as garbage. Fix: an unresolvable `$datum.…` value in a **payload** map (`create`
  inline `data`, `update` `changes`) omits the key. `filter` / `query` maps keep today's
  behaviour — dropping a filter key would silently widen a store update.

Useful precedents that make the rest cheap — no new machinery needed:

- Declarative **response messages already exist**: the item page's cancel action
  (`scripts/fixtures/services/service_sdui.json`, rows 9–11) creates a message carrying
  `message_id`, `value`, `type`, and the forwarded `time` via object-template values. The
  homepage accept/reject/cancel reuse that exact shape.
- **`swipe-left` already runs with the row's datum.** `EVYRow.runActions` resolves
  `datum ?? self.datum` (`EVYRow.swift:310`), and
  `testSwipeLeftUpdateActionRunsAgainstItsOwnFormattedSearchResult`
  (`EVYActionRunnerTests.swift:1519`) covers it. (`docs/evy/sdui.md:190` claims datum `nil` —
  stale, fix it.)
- **Search child rows own their taps.** A Search row with `destination: ""` never fires its own
  `tap` (`EVYSearch.swift:149` early-returns), so tap/swipe actions go on the child template —
  which is how the item search already navigates.
- **TabContainer tabs need `tap: [{fn: select, value: $datum}]`** or they are inert
  (`EVYTabContainerRow.swift:31-42`); copy the item page's usage.

## Design decisions (made — do not re-litigate during implementation)

- **`filter(collection, predicate)` binds the candidate as `$datum`**, not as bare fields the
  way `findFirst` does. Implementation reuses the ephemeral-datum mechanism
  (`interpreter.swift:459-473` `_formatData`): per candidate, substitute `$datum` tokens, then
  evaluate with the existing boolean machinery. This makes nested lookups unambiguous: inside
  `filter(messages, … findFirst(sort(messages, desc, createdAt), fk == $datum.fk && …) …)` the
  bare `fk` is the inner `findFirst` candidate and `$datum` is the outer `filter` candidate.
  Note `filter` is also a *field name* on `update` invocations — prose-only collision, accepted.
- **`owns(service, resource, id)`** returns `"true"`/`"false"` (dispatch site A, the
  `interpreter.swift:533` switch) and reads `EVY.ownedServiceResources()` — ledger + private
  store + `EVY_OWNED_SERVICE_RESOURCES` launch override. There is no `!` operator, so fixtures
  write `owns(…) == false`. Web gets a doc-shaped stub (web has no ownership concept at all).
- **Swipe buttons are single and accent-colored.** The red tint existed only on hard-coded
  reject/cancel; a per-row `swipeStyle` is out of scope. The sheet's Reject button uses the
  existing `Button` `style: "danger"`.
- **Sheet copy is static** ("Respond to request" etc.). Display-string `$datum` interpolation
  inside stored sheets is *not* added — only the datum context for the buttons' actions. Richer
  copy ("Accept 'Amazing Fridge' pickup?") would need per-result sheet materialization; defer.
- **Subtitles show the raw `data.value`** (`pending` / `accept`), exactly as specified.
- **Scheduled shows accepted requests to both parties** (spec does not split by ownership).
- The three predicates use the **latest-message idiom** from the item page, not a
  "some message answers me" existence check — one state machine everywhere.

## The three source expressions

For you (`owns == true`), From you (`owns == false`):

```
{filter(messages, $datum.data.value == pending && owns($datum.service, $datum.resource, $datum.fk) == true && findFirst(sort(messages, desc, createdAt), fk == $datum.fk && data.type == $datum.data.type).id == $datum.id)}
```

Scheduled:

```
{filter(messages, $datum.data.value == accept)}
```

⚠️ `filter(findFirst(sort(…)))` is **exactly three function levels**, the ceiling of
`functionParamsPattern` (`interpreter.swift:17-24`, raised in commit `3ce17503`). A fourth
level renders as source text silently. Say so in `methods.md` next to `filter`.

The shared response invocation (swap `accept` for `reject` / `cancel`):

```json
{ "fn": "create", "service": "475731ac-31aa-4d65-94d2-7032782ae359",
  "resource": "messages", "mode": "inline",
  "data": {
    "fk": "$datum.fk", "service": "$datum.service", "resource": "$datum.resource",
    "data": "{message_id: $datum.id, value: accept, type: $datum.data.type, time: $datum.data.time, postalcode: $datum.data.postalcode}" } }
```

This depends on the Phase-4 omission rule: a pickup request has no `postalcode` and a shipping
request has no `time`, and the missing one must be dropped, not written as literal text.
Carrying the whole `data` forward is load-bearing — the item page reads the *latest* message's
`data.time` for its confirmation row (see data.md).

## File map

**iOS runtime (modified)**

| File | Change |
| --- | --- |
| [functions.swift](../../ios/evy/Utils/functions.swift) | add `evyFilter` (near `evyFindFirst`, reuse `evaluateFindFirstAtom` machinery) and `evyOwns` |
| [interpreter.swift](../../ios/evy/Utils/interpreter.swift) | dispatch `filter` in `_resolveBindingRoot` (`:291-301`, so `filter(...)` works as a collection root / Search source); dispatch `owns` in the `switch` (`:533`); ensure `_watchTargets` (`:912`) recurses into `filter` args so `messages` is watched |
| [EVYObjectLiteral.swift](../../ios/evy/UI/EVYObjectLiteral.swift) | payload maps omit keys whose `$datum.…` value does not resolve (flag threaded from `EVYActionRunner` create-data / update-changes call sites only) |
| [EVYRow.swift](../../ios/evy/UI/EVYRow.swift) | delete `swipeActions` hard-coded branch (`:336-344`); `show` closure captures the run's datum and presents `(ref, datum)`; `EVYSheetOverlay` takes and forwards `datum`; container call sites (`:412`, `:432`, `:456`) pass `self.datum` |
| [EVYSwipeableRow.swift](../../ios/evy/UI/EVYSwipeableRow.swift) | single action: `EVYSwipeAction` list → one label-and-handler pair; drop `id`/`tint` fields and `revealWidth(actionCount:)` (`:43-45`); accessibility id stays `swipeLeft_<identity>` |
| container row views under `ios/evy/UI/Rows/Container/` (`EVYVerticalContainerRow`, `EVYHorizontalContainerRow`, `EVYTabContainerRow`) | accept a `datum` and pass it into child `EVYRow`s |
| [EVYSearch.swift](../../ios/evy/UI/Views/EVYSearch.swift) | list-only mode: blank/absent `placeholder` renders no `EVYTextInput`, and `shouldShowNoResults` (`:90-102`) also fires for an empty local list with no query in that mode |
| [EVYSearchModel.swift](../../ios/evy/UI/Views/EVYSearchModel.swift) | delete `onlyOpenRequests` (`:92-108`) and its call (`:71-79`) |

**iOS (deleted)**: [EVY+MessageRequests.swift](../../ios/evy/Core/EVY+MessageRequests.swift),
`ios/evyTests/EVYMessageRequestTests.swift`.

**iOS tests (modified)**: `interpreterTests.swift` (filter/owns), `EVYActionRunnerTests.swift`
(datum omission; show-carries-datum where unit-testable), `EVYSwipeGeometryTests.swift` (drop
the multi-action section `:196-243`), `EVYSearchModelTests.swift` / `EVYSearchTests.swift`
(filtering removed; list-only mode), `GrammarConformanceTests.swift` (only if the corpus gains
an ownership context), `ios/e2e/e2e.swift` (see Phase 8).

**Cross-platform grammar**: [conformance.json](../../types/grammar/conformance.json) (+ README
if extended), [web/app/utils/functions.ts](../../web/app/utils/functions.ts),
[web/app/utils/idCandidates.ts](../../web/app/utils/idCandidates.ts) + their tests.

**Fixtures / scripts**: [evy_sdui.json](../../scripts/fixtures/evy/evy_sdui.json) (home page
rewrite), [service_data.json](../../scripts/fixtures/services/service_data.json) (seed an
accepted pair). `scripts/shipped-fixture-action-branches.test.ts` and `scripts/seed.ts`'s
`validateUiFlow` gate the fixture — run them, no changes expected.

**Web integration**: [builderAssistFlow.pw.ts](../../web/integration/builderAssistFlow.pw.ts)
asserts on `"Search messages"` / `"Filter messages by type"` (lines ~113, 369-401) — update to
the new row names.

**Docs**: [methods.md](../evy/methods.md) (`filter`, `owns`), [actions.md](../evy/actions.md)
(omission rule), [sdui.md](../evy/sdui.md) (rewrite the swipe section: remove the hard-coded
exception `:188-201` and the message-list rule, fix the stale "datum nil" claim, document
show-datum + container datum inheritance + Search list-only mode).

**No schema changes.** Triggers, `swipeLabel`, `TabContainer`, and every action shape already
exist — `bun run types:generate` is not needed, and `SduiRowAttributeContractTests` /
`validation.test.ts` should pass untouched.

## New home page fixture (evy_sdui.json)

Keep the flow/page ids, the item search row (`96d3efe4-…`), and the footer. Replace the
messages Search row (`7c4a8f21-…` and child `8d5b9e32-…`) with:

- **TabContainer** `29646c92-90d0-4a68-8c23-3acf88612d06`, name `Message tabs`, `title: ""`,
  `segments: ["For you", "From you", "Scheduled"]`,
  `actions: {"tap": [{"condition": "", "false": "", "true": {"fn": "select", "value": "$datum"}}]}`,
  children (in order):
  - **Search** `574da230-8f09-43b2-b003-deadf6786bc4` "For you requests" — For-you source above,
    `placeholder: ""`, `no_results: "No requests"`, `destination: ""`, `actions: {}`, child:
    - **ListItem** `95444ce6-d4be-4001-8798-213cce23afd8` "For you request row" —
      `title: "{findFirst(dc28ed59-298e-493c-8ff3-3e60f2ebccbd, $datum.fk).title}"`,
      `subtitle: "{$datum.data.value}"`, `swipeLabel: "Accept"`,
      `actions.swipe-left: [create-accept]`,
      `actions.tap: [{fn: "show", rowId: "b70f6354-50cb-47cc-91bc-3387deb7277f"}]`, sheet:
      - **VerticalContainer** `b70f6354-50cb-47cc-91bc-3387deb7277f`, `title: "Respond to request"`, children:
        - **Text** `daea8a6d-8d13-462f-98fa-5403e4f81463` — confirmation copy, e.g.
          `title: "Accept this request, or reject it?"`
        - **HorizontalContainer** `07ce5b44-8f2c-4183-a6e9-2f853a8dd255`, children:
          - **Button** `e519e84d-9a7e-4563-bacb-388bba69e9b2` `label: "Accept"` —
            `tap: [create-accept, close]`
          - **Button** `d780b1bf-b638-4e99-84fd-36be12bb96fb` `label: "Reject"`,
            `style: "danger"` — `tap: [create-reject, close]`
  - **Search** `396da583-4748-40b9-aa88-4f8bb9074fc3` "From you requests" — From-you source,
    same shape, child:
    - **ListItem** `373ff30f-dc80-425c-a382-fadc8fcdcd81` "From you request row" — same
      title/subtitle, `swipeLabel: "Cancel"`, `actions.swipe-left: [create-cancel]`, no tap, no sheet
  - **Search** `4e81c7e7-f765-4864-ac63-35e2eff707cd` "Scheduled requests" — Scheduled source,
    child:
    - **ListItem** `c52a5527-ee4a-46c8-8f5c-1e18f782bcc0` "Scheduled row" — same
      title/subtitle, `actions: {}`

`dc28ed59-298e-493c-8ff3-3e60f2ebccbd` is the marketplace `items` resource id (doubles as the
binding key for the synced items collection);
`475731ac-31aa-4d65-94d2-7032782ae359` is the core service. Every message-datum path (`fk`,
`service`, `resource`, `data.*`) comes off `$datum` at action time, so the same child template
serves all transfer types.

## Seed data

`service_data.json` messages today: three `pending` requests (pickup/delivery/shipping), all
addressing `12401f50-…` "Amazing Fridge". Add an **accepted pair against the second item**
`760eac03-8783-4916-846e-6c316d0af5a1` "Amazing Freezer" so Scheduled is non-empty:

- request `dfc53233-6152-4878-bf4f-b11a47c636ac` — `{type: "delivery", value: "pending",
  time: "2026-06-04T10:00:00"}`, `createdAt: "2026-06-01T00:00:00.000Z"`
- response `b0897a47-c45c-4e9c-8021-8ec3bdcac59c` — same `fk`/`service`/`resource`,
  `{message_id: "dfc53233-…", value: "accept", type: "delivery", time: "2026-06-04T10:00:00"}`,
  `createdAt: "2026-06-01T00:01:00.000Z"` (must sort after the request — millisecond ISO)

**Audit before seeding**: any e2e or web test that renders the Freezer item page will now see
an in-flight arrangement (the transfer tabs are gated on nothing being live), and
`E2EHomepageMessageSearchTests`-style label counting changes. Search `ios/e2e`, `web/integration`
for `760eac03`, `Amazing Freezer`, and message-count assertions; adjust or scope the pair to a
different item if a conflict is real. `scripts/seed.ts:buildMessageRows` already accepts
`accept` (it rejects `cancel` — leave that unless a cancel seed is needed).

## Tasks

Work on `feat/messages-upgrade`. Note two memory-bank facts: **iOS unit tests fire real RPCs at
`localhost:8000`** (start `docker compose up -d` + seed first; reseed after runs), and **e2e home
flows reuse the production home page id** — reseed the home page in `setUp` when a test needs
the real one.

### Phase 1 — `filter()` expression function

1. Write failing `interpreterTests.swift` tests: `filter` returns all matches; `$datum` binds
   the candidate; nested `findFirst(sort(…), fk == $datum.fk && …)` resolves the outer
   candidate through `$datum` while bare fields bind the inner candidate; empty result on no
   match; non-collection input errors; the exact For-you expression from this plan returns only
   the open request among (request, response, second settled request) fixtures.
2. Run `evyTests` (docker API up) — confirm the new tests fail.
3. Implement `evyFilter` in `functions.swift` + `_resolveBindingRoot` dispatch. Per candidate:
   register as ephemeral datum, substitute `$datum` tokens, evaluate the predicate with the
   `findFirst` boolean machinery. Support trailing property access (`filter(…).0` not required,
   but chaining should not crash).
4. Run the tests — pass. Also run the existing interpreter suite for regressions.
5. Write a failing watch-target test: `EVY.watchTargets` over a `{filter(messages, …)}` source
   includes the `messages` binding (and does not choke on `$datum`). Fix `_watchTargets` if
   needed; pass.
6. Add conformance vectors (`expression` category, `platforms: ["ios"]`): `filter` basic and
   the latest-message self-id idiom, with seeded `data` roots; plus one `split-args` vector for
   the nested arg split. Run `GrammarConformanceTests` and `bun run --cwd web test:unit`.
7. Web: register `filter: evyCollectionPlaceholder` in `functions.ts:311`; add to
   `functionCandidateNames` (`idCandidates.ts:72-89`); update `idCandidates.test.ts`. Run web
   unit tests.
8. Document `filter` in `methods.md` (binding rule, nesting rule, the 3-level regex ceiling).
9. Commit.

### Phase 2 — `owns()` expression function

1. Write failing `interpreterTests.swift` tests: `owns(s, r, id) == true` after
   `EVY.recordOwnership`; `false` otherwise; args resolve `$datum.…` inside a `filter`
   predicate; comparison against `false` works. (Ledger is `UserDefaults`-backed — reset in
   setUp/tearDown like `EVYMessageRequestTests` does today.)
2. Run — fail. Implement `evyOwns` + the `case "owns"` in the `interpreter.swift:533` switch.
   Run — pass.
3. Web: `owns` stub returning a doc-shaped `"false"` placeholder + `idCandidates` + tests.
4. Conformance: preferred — extend the corpus with an optional per-vector `ownership` list
   (ios-only, seeded via `EVYOwnershipLedger.record`, reset in teardown) and add `owns`
   vectors + README note. If that runner change balloons, keep coverage in `interpreterTests`
   and record the corpus gap in the README instead.
5. Document `owns` in `methods.md` (semantics = `ownedServiceResources()`: created + held
   privately + launch override; no web runtime counterpart).
6. Commit.

### Phase 3 — sheets carry the triggering row's datum

1. Write what is unit-testable first: a failing test that `EVYActionRunner.run`'s `show`
   callback receives enough context to present with a datum (adjust the closure signature to
   `(rowId) -> Void` remaining but capture datum at the `EVYRow` layer — the observable unit is
   the presented-sheet state; if that is not reachable in unit tests, drive this phase by the
   Phase 8 e2e and keep this step as a compile-level refactor).
2. Implement: `presentedSheetRef: EVYRowRef?` becomes a small `Identifiable` struct
   `(ref, datum)`; the `show` closure in `runActions` (`EVYRow.swift:311-316`) captures
   `datum ?? self.datum`; `EVYSheetOverlay` gains `datum` and passes it to its root `EVYRow`.
3. Implement container datum inheritance: the three container row views accept `datum` and
   construct children as `EVYRow(ref:, datum:)`; `EVYRow.swift` call sites pass `self.datum`.
4. Run the full `evyTests` target — no regressions (container children were always datum-nil
   before; inheritance only adds context where a parent has one).
5. Update `sdui.md`: `show` presents the sheet in the triggering row's datum context; container
   children inherit the parent datum; sequencing/`close` semantics unchanged.
6. Commit.

### Phase 4 — unresolvable `$datum.…` payload values omit the key

1. Write failing `EVYActionRunnerTests` tests: inline create with
   `data: "{…, postalcode: $datum.data.postalcode}"` against a pickup datum produces a record
   **without** a `postalcode` key (today: literal `"$datum.data.postalcode"`); same for
   `update` `changes`; and a pin that `filter` / `query` maps keep the current behaviour.
2. Run — fail. Implement in `EVYObjectLiteral.resolveValues` / `resolveValue` behind a
   parameter set only by the create-data and update-changes call sites in `EVYActionRunner`.
3. Run — pass. Note the rule in `actions.md` (create inline section).
4. Commit.

### Phase 5 — Search list-only mode

1. Write failing tests at whatever level `EVYSearchTests` supports: blank `placeholder` ⇒ no
   text input; empty local results with blank placeholder ⇒ `no_results` shows without a query.
2. Implement in `EVYSearch.body` (`:104-134`) and `shouldShowNoResults` (`:90-102`).
3. Run — pass. Document in `sdui.md`'s Search notes (row binding table).
4. Commit.

### Phase 6 — delete the hard-coded rule; one swipe affordance

1. Delete `EVY+MessageRequests.swift` and `EVYMessageRequestTests.swift`.
2. `EVYRow.swipeActions(for:)` (`:336-351`): remove the hard-coded branch; keep only the
   single declarative affordance. Remove the now-unneeded indirection if trivial.
3. `EVYSwipeableRow`: replace `actions: [EVYSwipeAction]` with a single label-and-handler pair
   (the struct's own comment says the list existed only for the hard-coded rule); drop
   `EVYSwipeGeometry.revealWidth(actionCount:)`; keep the `swipeLeft_<identity>` accessibility
   id and one-open-at-a-time coordinator.
4. `EVYSearchModel`: delete `onlyOpenRequests` and call it nowhere; lists are now filtered by
   their source expressions. (This also removes a per-render `getAll` over messages —
   `isSettled` ran on every row render.)
5. Prune `EVYSwipeGeometryTests.swift:196-243` (multi-action section) and any
   `EVYSearchModelTests` covering the removed filter.
6. Run the full `evyTests` target; reseed the dev DB afterwards.
7. `sdui.md`: delete the hard-coded-exception block (`:188-201`) and the message-list rule
   paragraph; rewrite the swipe section — single accent button, `swipeLabel`, action list runs
   in order **with the row's datum** (fixing the stale "datum nil" line); leave
   `docs/plans/*` history untouched.
8. Commit.

### Phase 7 — fixtures and seeds

1. Rewrite the home page in `evy_sdui.json` exactly as specified above (new UUIDs listed
   there). Keep item search + footer.
2. Add the accepted seed pair to `service_data.json` after the audit described in "Seed data".
3. Run `bun test scripts` (or the repo's root test command) — `validateUiFlow` via
   `scripts/seed.ts` and `shipped-fixture-action-branches.test.ts` gate the fixture.
4. `docker compose up -d` + reseed; launch the iOS app with an `EVY_OWNED_SERVICE_RESOURCES`
   declaration for the Fridge item and eyeball all three tabs.
5. Update `builderAssistFlow.pw.ts` name/placeholder assertions; run web integration tests.
6. Commit.

### Phase 8 — e2e rewrite

1. Replace `E2EHomepageMessageSearchTests` (`e2e.swift:4390-…`) with a home-inbox class seeding
   the **new** home flow shape (update the inline fixture copies at `~:1857` and `~:4445`):
   - recipient (declares ownership of the seeded item, as today via
     `ownedServiceResources`): For-you tab lists the request with title "Amazing Fridge" and
     subtitle "pending"; swipe reveals exactly one `swipeLeft_<childRowId>_<requestId>` button
     labelled Accept; tapping it persists an `accept` response (reuse
     `assertResponsePersisted`); the row then leaves For-you and appears under Scheduled.
   - tap flow: tapping the row opens the sheet; Reject persists a `reject` response and
     dismisses.
   - answered requests offer nothing (row gone — the filter drops it).
2. Rewrite `testSenderIsOfferedCancelAndCannotAnswerItsOwnRequest` (`:3009`): create the
   request through the app (item page flow) so the ledger marks this device the sender; the
   request appears under **From you** (device does not own the item); swipe reveals only
   Cancel; tapping persists a `cancel` message.
3. Keep the generic declarative swipe class (`:4012-4100`) as-is — it is now the only swipe
   contract.
4. Run the e2e suite per `ios/README.md` / `run-e2e.sh` (docker compose + seed + xcodebuild
   from `ios/`). Remember: async XCUITests crash the Xcode 26 runner; keep new tests sync where
   the existing pattern does.
5. Commit.

### Phase 9 — sweep

1. Full test pass: root/scripts/web unit (`bun test` per workspace), `api` tests, iOS
   `evyTests`, iOS e2e, web Playwright integration. Reseed the dev DB last.
2. Re-read `methods.md`, `actions.md`, `sdui.md`, `data.md` for consistency with what shipped
   (especially: data.md's "three gaps" reference near the sync section, if any remains).
3. Commit; open the PR against `dev`.

## Risks and traps

- **Regex nesting ceiling**: the tab sources sit at exactly three function levels; one more
  nesting silently renders as text. Covered by an interpreter test in Phase 1.
- **`createdAt` ordering**: seeded pairs must use millisecond ISO strings and the response must
  be strictly later — `sort` compares strings and ties fall back to store order.
- **Search `destination` stays `""`** on all three tab lists. Setting one would trigger
  `selectResult`'s write + `dismiss()` path on row taps.
- **Per-datum `visible` on child templates** appeared to work incidentally (formatter bakes it)
  but is untested — this plan deliberately does not rely on it.
- **`filter` cost**: the For/From-you predicates run a nested `findFirst(sort(…))` per message
  per evaluation. Fine at seed scale; note in `methods.md` rather than optimizing now.
- **Seeded accepted pair** can flip the Freezer item page into "arranged" state for other
  tests — do the Phase 7 audit before committing the seeds.
- **e2e page-id collision**: home flows share the production page id; reseed in `setUp`
  (existing pattern at `e2e.swift:4420`).
