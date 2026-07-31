# Plan: Reduce iOS e2e wall time by merging tests and removing duplicate coverage

## Problem

The E2E CI job is still ~11 min (latest dev run 30622569081: 11m20s), of which the
iOS suite is ~10.5 min: ~1.5 min xcodebuild build + **~9.5 min executing 29 tests
sequentially**. Parallelizing across simulators was explored and didn't pay off, so
this plan shrinks the suite itself.

Where the ~9.5 min actually goes (from a full inventory of
`ios/e2e/e2e.swift`, 4880 lines, 29 test methods):

1. **App launches.** Every test pays `seedFlows` (WSEmitter connect + login + full
   flow-graph upsert) + `app.launch()` + a 20s-budget home-screen wait in `setUp`.
   On top of that, `WebSocketE2ETests.openViewItemPage` (`e2e.swift:3938`) does
   `app.terminate()` + `launchApp()` — **13 of 19 WebSocketE2ETests methods relaunch
   at least once; `testShippingConfirmationSheetShowsSurchargeAwareCopy` relaunches
   twice**. Total launch-ish events per run: ~44. At ~6–10 s each that is ~5 min of
   the 9.5.
2. **Redundant work.** `tearDownWithError` (`e2e.swift:2240`) reseeds 3 flows after
   every test even though the next test's setUp reseeds them again (19 wasted
   reseeds ≈ 30–60 s). Three tests additionally push a "restore" SDUI update that
   setUp reseeding also makes redundant.
3. **Duplicate coverage.** One test is fully subsumed by another; a 20s pre-flight
   home-wait is repeated 17× (dead cost in every relaunch test); several
   backend-only assertion blocks re-test what `api/e2e/e2e.test.ts` and
   `services/marketplace/e2e/e2e.test.ts` already cover.

Target: **29 test methods → ~12**, launch events **~44 → ~18**, test phase
**~9.5 min → ~5 min**, whole CI job **~11 min → ~6.5 min**. Merging removes
per-test overhead, not assertion bodies — coverage is preserved except where noted.

## Ground rules for every merge (apply throughout)

- **Keep sync/async style as-is.** Converting a sync (`awaitResult`) test to async
  or vice versa risks the Xcode 26 concurrency runner crash
  (swiftlang/swift#84793). Only merge tests that share a style; all named merge
  groups below already do.
- **Wrap each merged phase in `XCTContext.runActivity(named:)`** so a failure
  report still names the behavior that broke (with `continueAfterFailure = false`,
  a failing early phase hides later phases — acceptable, but the activity name
  must make the failure findable).
- **State-mutating phases run last** (or must self-clean). Each group below
  specifies the required order; do not reorder phases without re-checking the
  latest-message gating (`findFirst(sort(messages, desc, created_at), …)`).
- Line numbers below are from the current file and will drift as phases land —
  locate by symbol/test name, not line, from Phase 2 onward.
- After each phase: run the affected class, then commit. Class run from `ios/`:

  ```bash
  xcodebuild test -project evy.xcodeproj -scheme evy \
    -destination "platform=iOS Simulator,name=iPhone 17,OS=26.5" \
    -only-testing:evyUITests/<ClassName> -parallel-testing-enabled NO -quiet
  ```

  (Backend must be up + seeded: `docker compose up -d` + `bun db:seed`, per the
  local e2e workflow. Reseed the dev DB after test runs if you use it for dev.)

## File map

| File | Change |
|---|---|
| `ios/e2e/e2e.swift` | All changes. Net large shrink: delete 1 subsumed test + dead fixtures/helpers; merge 17 tests into 6; remove redundant reseeds/waits; consolidate 3 hand-rolled copies of `openViewItemPage`. |
| `docs/plans/ios-e2e-test-reduction.md` | This plan. |

No new files, no pbxproj changes, no CI workflow changes.

---

## Phase 1 — pure deletions and redundancy cuts (no behavior merging, lowest risk)

1. Delete `WebSocketE2ETests.testWebSocketNotificationUpdatesUI` (`e2e.swift:2268`).
   It is fully subsumed by `testWebSocketRowUpdatePreservesUnrelatedRowState`
   (`:2304`): same seed, same SDUI relabel push, same two assertions, plus more.
2. Delete `WebSocketE2ETests.tearDownWithError`'s `try? seedIsolatedFlows()`
   (`:2240-2243`). Every test's setUp reseeds. Caveat handled in step 3.
3. The one real cross-class hazard the tearDown was masking:
   `E2EHomeInboxTests.setUp` (`:4512`) overwrites the **production**
   `defaultHomeFlow`, which `testCreateItemRealFlowSearchSelectPersistsAddressAndLinksItem`
   (`:3551`) depends on (it currently survives by coincidence — both flows have a
   `Sell something` footer). Make it deterministic: have the real-flow test seed
   `defaultHomeFlow` itself from the fixture before relaunching (or add a
   `tearDown` reseed of `defaultHomeFlow` to `E2EHomeInboxTests` only). Pick the
   first — it makes the dependency explicit at the point of use.
4. Delete the three redundant restore-to-"View" SDUI pushes at the end of the
   group-A tests (`:2295`, `:2344`, `:2390`) — setUp reseeding restores the flow.
   (Two of these tests merge in Phase 2; deleting first keeps Phase 2 mechanical.)
5. Delete the 20s pre-flight home-screen wait (`app.buttons["View"].waitForExistence(timeout: 20)`)
   from every test that terminates/relaunches immediately after — occurrences at
   `:2398, :2472, :2525, :2560, :2608, :2665, :2717, :2771, :2866, :2996, :3114,
   :3240, :3355, :3400` and the `Create` variant at `:3461`. The post-relaunch
   wait inside `openViewItemPage` (`:3947`) is the real gate. Keep the wait only
   in the no-relaunch tests (`:2305`, `:2357` — group A) and in classes that
   never relaunch.
6. Delete the no-op negative assertion block at `:2695-2698`
   (`Cancel pickup request` can never exist on `viewItemRequestFlowData` — the
   flow has no cancel button; the meaningful version lives at `:2795` on the
   gated flow).
7. In `testCreateItemFormEditing` (`:3459`): delete the redundant re-push of
   `minimalCreateItemFlowData` + terminate + relaunch (`:3467-3473`) — it pushes a
   flow identical to what setUp just seeded. The test then runs on the setUp
   launch with zero relaunches.
8. Delete dead fixtures/helpers (no callers):
   `createItemWithAddressFlowData` (`:447`), `listItemRow` (`:911`),
   `publishHomeFlow` (`:3899`), `typeIntoHomeEphemeralField` (`:3913`),
   `sharedHomeText` (`:3925`), `headingHomeText` (`:3929`), `addedHomeText`
   (`:3933`), the always-false `includeAddedSharedRow`/`includeHeadingRow`
   parameters of `createHomeFlowData` (`:3982-3983`) and their row plumbing, and
   the never-tapped `Details` button + `webSocketHomeDetailsPage` page
   (`:4020-4025`, `:4062-4069`; also drop `E2EFlowIds.webSocketHomeDetailsPage`).
9. Run the full `evyUITests` suite locally (28 tests expected). All green.
10. `bun run format` (runs swift-format over `ios/`).
11. Commit: `remove subsumed iOS e2e test, dead fixtures and redundant reseeds/waits`.

Expected saving: ~1–1.5 min (1 test gone, 19 reseeds gone, ~14 dead 20s-budget
waits gone, 1 relaunch gone).

## Phase 2 — merge group A: live SDUI pushes on the home flow (3 → 1, no relaunches)

Members (post-Phase-1: 2 remain): `testWebSocketRowUpdatePreservesUnrelatedRowState`
and `testConditionalActionEvaluatesLogicalExpression`. Both async, both: setUp seed
→ home → one emitter → `updateSDUI` on the same home flow.

1. Create `testLiveSDUIUpdatesOnHomeFlow` (async) with one emitter connection:
   - Activity 1 (from `…PreservesUnrelatedRowState`): type into
     `textField_e2e.unrelated_input` → push relabel SDUI → assert new button
     exists, old gone, typed text preserved.
   - Activity 2 (from `…ConditionalAction…`, **last** — it navigates away): push
     `createConditionalFlowData` → tap conditional button → assert navigation
     happened (`Go home` footer).
2. Delete the two source tests.
3. Run `WebSocketE2ETests` locally; commit:
   `merge live-SDUI home flow e2e tests`.

## Phase 3 — merge group C: pickup-request lifecycle on the gated flow (3 → 1, 3 relaunches → 1)

Members (all async, all `openViewItemPage(viewItemCancelRequestFlowData)` +
`subscribe(data_changed)`): `testCancelRequestTogglesPickerAndShippingButton`,
`testRejectedRequestReturnsTheTimeslots`,
`testAcceptedRequestHidesCancelAndShowsConfirmation`.

Ordering is forced by the latest-message gating — the accept state is terminal
(picker never returns), so it must be last; cancel and reject are self-cleaning:

1. Create `testPickupRequestLifecycle` (async): shared prefix once (create item →
   `openViewItemPage(viewItemCancelRequestFlowData)` → subscribe → assert cancel
   hidden), then:
   - Activity 1 — UI cancel: request 09:00 → assert cancel visible + timeslots
     hidden + `Shipping` segment collapsed → cancel via sheet → assert `cancel`
     message appended + picker returns.
   - Activity 2 — server reject: request again → server-side reject via emitter →
     picker returns, no "Pickup confirmed for", re-request allowed (assert cancel
     visible again after re-request... note: end this activity with the request
     **rejected or cancelled**, not pending, so Activity 3 starts clean — mirror
     the source test's exact tail and add a UI cancel if it ends pending).
   - Activity 3 — server accept (**terminal, last**): request → accept carrying
     `pickup_address` → cancel hides, `Pickup confirmed for …` + full address
     rendered, tabs still collapsed, `Shipping confirmed` absent.
2. While merging, replace the hand-rolled messageId lookup from the accepted test
   (`:3018-3040` pre-drift) with the existing `waitForMessageId` helper (`:2959`).
3. Also drop the pure-backend assertions duplicated by the TS suites:
   `XCTAssertTrue(rejectedOnServer, …)` and `XCTAssertTrue(acceptedOnServer, …)` —
   `api/e2e/e2e.test.ts:230` covers request/response message mechanics. Keep the
   *writes* (the UI needs them) — delete only the server-side re-verification
   asserts.
4. Delete the three source tests; run the class; commit:
   `merge pickup request lifecycle e2e tests`.

## Phase 4 — merge group B: default request-flow item page (5 → 2, 6 relaunches → 2)

Members (all async, all `openViewItemPage` with the default
`viewItemRequestFlowData`): `testTimeslotPickerCreatesPickupRequest`,
`testTimeslotConfirmationCancelDoesNotCreateRequest`,
`testPickupConfirmationSheetShowsEarlierTimeslotWarning`,
`testAskToBuyCreatesShippingRequestAndValidatesEmptyPostcode`,
`testShippingConfirmationSheetShowsSurchargeAwareCopy`.

The surcharge test needs **two items** (fee > 0 and fee = 0), so the end state is
two tests: one big merged journey on item #1 (fee > 0, two timeslots), and one
small test on item #2 (fee = 0 copy).

1. Create `testItemPageRequestsAndValidation` (async). Seed **one** item with
   `pickupSelection: [09:00, 10:00]` and `shippingFee: "5"`; one
   `openViewItemPage`. Phases in this exact order (negatives before any write —
   the no-message assertions read `messages` filtered by item id):
   - Activity 1 — earlier-timeslot warning: tap 10:00 → warning visible → dismiss
     → tap 09:00 → warning absent (keep the sheet's item-title interpolation
     assertion here, once) → dismiss.
   - Activity 2 — sheet dismiss writes nothing: assert no pickup message exists.
   - Activity 3 — empty-postcode validation: `Ask to buy` with empty postcode →
     `Missing information` alert → assert no shipping message → dismiss alert.
   - Activity 4 — surcharge copy (fee > 0): type postcode → `Ask to buy` → assert
     held-payment copy present / zero-fee copy absent → **dismiss without
     confirming**.
   - Activity 5 — writes, last: postcode → `Ask to buy` → Request → poll shipping
     message with `postalcode`; then tap 09:00 → Request → poll pickup message
     with `time == slot` and assert no native alert appeared.
     (`viewItemRequestFlowData` has no visibility gating, so both stay reachable
     after writes.)
2. Create `testShippingZeroFeeConfirmationCopy` (async): second item with
   `shippingFee: "0"`, one `openViewItemPage`, assert the zero-fee copy present /
   surcharge copy absent (second half of the old surcharge test).
3. Delete the five source tests; run the class; commit:
   `merge default request-flow item page e2e tests`.

## Phase 5 — merge groups D + E: navigate-query rendering and sheet behavior (4 → 2, 4 relaunches → 2)

1. Group D (async): merge `testViewItemFlowLoadsItemFromNavigateQuery` and
   `testViewItemPaymentRowsRespectVisiblePredicate` into
   `testViewItemPageRendersNavigateQueryItem`:
   - Both use the same `viewItemFlowData` view flow; the payment test only needs
     `paymentMethods: ["cash": true, "app": false]` added to the single created
     item — both assertion sets then hold on one page.
   - Replace both tests' hand-rolled relaunch blocks with `openViewItemPage`
     (they currently duplicate it inline).
   - Order: static render assertions first (`My item is called`, title in body +
     nav bar, input prefilled, `Cash accepted` present, `App payments accepted`
     absent), the title **edit** last (it mutates the item and the nav title).
2. Group E (async): merge `testSheetTitleUpdatesWhenWatchedDataChanges` and
   `testShowPresentsSheetRowFromAnotherPage` into `testSheetPresentationAndReactivity`.
   This one needs a **fixture union**: combine `sheetTitleReactivityFlowData`
   (`:1747`) and `crossPageSheetFlowData` (`:1808`) into one flow — page 1 gets
   both buttons (`Open sheet`, `Open cross-page sheet`), plus the extra page
   hosting the cross-page sheet row. Order: cross-page sheet phase first
   (read-only), title-reactivity phase last (edits the item title).
3. Delete the four source tests and, if now unused, the two superseded fixture
   builders; run the class; commit:
   `merge view-item render and sheet e2e tests`.

## Phase 6 — E2EHomeInboxTests: merge groups F + G (5 → 2) and consolidate emitters

1. Group F — `testForYouRowRendersDestinationAddresses` (merge `:4643` + `:4661`):
   assert the fixture-seeded shipping row's address first (no emitter), then seed
   the delivery request and assert its row. Different `data.type`s — they don't
   shadow each other under the latest-message filter.
2. Group G — `testRecipientRespondsToRequests` (merge `:4678` + `:4570` + `:4712`)
   in this order (all against the same seeded item, filters are global):
   - Activity 1 — reject via tap→sheet (terminal, doesn't pollute Scheduled).
   - Activity 2 — swipe→Accept: exactly one revealed `Accept` action, accept
     embeds the seller's address (keep the `pickup_address.street` read — it
     verifies the SDUI `findFirst(evy.addresses, …)` expression, which the TS
     suites do NOT cover), row moves For-you → Scheduled.
   - Activity 3 — pre-answered request: seed request+accept server-side, assert
     absent from For you, present in Scheduled. (Scheduled assertions are
     existence-based, not count-based, so Activity 2's accept doesn't break them
     — verify this when merging.)
3. Consolidate the per-call WSEmitter connections (`seedOwnRequest` `:4768`,
   `seedOwnDeliveryRequest` `:4739`, `assertResponsePersisted` `:4820`, inline
   address read `:4592`) to accept an already-connected emitter parameter; open
   **one** emitter per merged test. Assert `assertResponsePersisted`'s
   "request still reads as pending" once per merged body, not per phase
   (`api/e2e/e2e.test.ts:230` already guards the mechanism).
4. Delete the five source tests; run the class; commit:
   `merge home inbox e2e tests and share one emitter connection`.

## Phase 7 — cross-class consolidation of the cheap single-assertion classes (3 → 1) and place-search decision

1. Merge `E2EFlowTests.testNavigationAndVisibility`,
   `E2ESwipeLeftTests.testSwipeLeftButtonNavigatesToDestinationPage`, and
   `E2ESegmentContainerTests.testSwitchingSegmentSwapsChildContent` into one class
   `E2ECoreUITests` with **one** test: compose their three disjoint fixtures into
   one flow (nav home page + swipe row + segment container — the nav home page's
   vertical container can host the swipe row and the tab_container as extra
   children, or add them as rows on the same page). One seed, one launch, three
   activities. All read-only; return to a known state between activities (the nav
   activity ends back on home; swipe and segment activities stay on home).
2. Delete `E2EPlaceSearchTests` (`:4325-4483`). Rationale: the production
   real-flow test (`testCreateItemRealFlow…`) exercises the same search sheet
   (`Sydney` query → result tap → sheet dismisses) and proves the address
   *persists*, which is strictly stronger. **Accepted coverage loss** (call it
   out in the PR): the `formatAddress` subtitle assertion on the synthetic flow
   and the explicit create-vs-update `condition length(id)==0` branch. If that
   loss is unacceptable, instead fold the subtitle assertion into the real-flow
   test after its address poll — do NOT keep the whole class for it.
3. Keep `E2EErrorStateTests` untouched — different launch env (unreachable API),
   cannot merge, already the cheapest test.
4. Run the **full** suite; expected method count ~12
   (`E2ECoreUITests` 1, `WebSocketE2ETests` ~7, `E2EErrorStateTests` 1,
   `E2EHomeInboxTests` 2, real-flow + create-form already counted in WebSocket's 7).
5. Commit: `consolidate single-assertion e2e classes; drop subsumed place search test`.

## Phase 8 — trim backend-only polling in the real-flow test

`testCreateItemRealFlowSearchSelectPersistsAddressAndLinksItem` ends with two 20s
polling loops (item shape, then address row) with a 400ms `Task.sleep`.
`services/marketplace/e2e/e2e.test.ts:173` already covers the item-side
`transfer_options.pickup.address_id` round-trip verbatim.

1. Keep one poll: wait for the created item to expose
   `transfer_options.pickup.address_id` (the UI-driven part), then do a **single**
   `getResource(evy.addresses, filter: id)` assertion instead of the second 20s
   poll loop — the address row was written before the item submit, so once the
   item is visible the address must already exist; a one-shot read suffices.
2. Drop the `not.toHaveProperty("pickup_address")`-style guard if present on the
   iOS side (`marketplaceItemPickupAddressId` guard) only if it duplicates the TS
   assertion — otherwise keep.
3. Run the class; commit: `trim duplicated backend polling from real-flow e2e test`.

## Verification checklist (end state)

- [ ] Full local suite green: `bash run-e2e.sh --ci` (or docker mode) from repo
      root; iOS section passes.
- [ ] Test method count ~12 (from 29); grep `func test` in `ios/e2e/e2e.swift`.
- [ ] CI "Run E2E tests" step ≤ ~7 min (from ~11.5); pull step timing via
      `gh run view <id> --json jobs`.
- [ ] Every deleted test's unique assertion appears in a named
      `XCTContext.runActivity` inside a merged test (spot-check the inventory's
      "unique" column against activity names).
- [ ] `bun run format` clean; no dead fixture helpers left (`grep` the deleted
      symbol names).

## Risks / gotchas

- **Fail-fast masking:** with `continueAfterFailure = false`, one broken phase in
  a merged test hides the later phases' results. Mitigated by activity names; if
  a merged test turns flaky in CI, the fallback is splitting that one test back
  out — keep each phase's body self-contained so that's a cut/paste.
- **Message-state ordering:** groups B, C, G depend on precise phase order
  (negatives before writes; terminal accept last). The order is specified per
  phase above; re-derive it if the latest-message gating expressions change.
- **Async/sync mixing:** never merge an `awaitResult`-style sync test into an
  async one (Xcode 26 runner crash). All specified groups are style-homogeneous;
  `testCreateItemFormEditing`, `testSenderIsOfferedCancel…`, and the real-flow
  test are sync and stay standalone.
- **`E2EHomeInboxTests` overwrites the production home flow** — Phase 1 step 3
  makes the real-flow test self-sufficient; don't skip it, it's what makes later
  class-reordering safe.
- **Suite shrinkage hides regressions in deleted duplicates only if they were
  true duplicates.** The two deliberate coverage losses are named (place-search
  subtitle + create-vs-update branch; server-side re-verification asserts) —
  flag them in the PR description for reviewer sign-off.
