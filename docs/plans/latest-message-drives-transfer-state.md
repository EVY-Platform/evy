# The latest message decides what the item page shows

Today the item page answers "is a request in flight?" by asking several questions at once — is
there an unanswered request, is there an accept, is this one archived — and ANDing the answers
together. That works, but it encodes the state machine across four different predicates per
transfer type, and it has no notion of *order*: `findFirst` returns the first match in store
order, not the most recent message.

Replace all of it with one rule per transfer type:

> Find the **latest** message for this item and this transfer method, and read `data.value`.

| `data.value` of the latest message | Cancel button | Timeslots / tabs | Confirmation row |
|---|---|---|---|
| `pending` | **shown** | hidden | hidden |
| `accept` | hidden | hidden | **shown, with the agreed time** |
| `reject` | hidden | **shown** | hidden |
| `cancel` | hidden | **shown** | hidden |
| no message at all | hidden | **shown** | hidden |

Only `pending` and `accept` need a rule. `reject`, `cancel` and "nothing yet" all fall through to
the same branch, which is exactly the intent: once a request is settled the buyer is back to
picking a timeslot.

**`archivedAt` goes away entirely.** A message's whole lifecycle is now `data.value` plus
`createdAt`: withdrawing a request is another message saying `cancel`, not a mutation of the
request. That makes `Message` **write-once** — after this change nothing in the system ever
updates a message — which is what the original ask wanted and the previous change could not
deliver.

---

## This does not need to be hard-coded on iOS

The previous change put the accept/reject affordance in Swift because SDUI genuinely could not
express it. **This is different — it is expressible today**, so it stays in the flow where it
belongs. Two capabilities already exist and already have tests:

- [`sort`](../evy/methods.md#sort) takes an optional **field path**: `sort(collection, desc, createdAt)`.
- `findFirst`'s collection argument is **function-aware**. `_resolveBindingRoot` in
  [`interpreter.swift`](../../ios/evy/Utils/interpreter.swift) dispatches `sort` (and `findFirst`,
  `now`) when it is the leading prop, and `_splitFunctionArguments` splits on top-level commas
  only, so a nested call counts as one argument.

So the primitive is:

```
findFirst(sort(messages, desc, createdAt), fk == <item>.id && data.type == pickup)
```

`findFirst(sort(…))` nesting is documented at [methods.md:93](../evy/methods.md) and covered by
`interpreterTests.swift` (~line 642) and the `expression-find-first-sorted-*` conformance vectors —
but **only in the one-argument form**, without a predicate. The two-argument form is what this
plan relies on and nothing exercises it yet, which is why step 1 is a test for exactly that.

**Watch targets already traverse the nesting.** `appendWatchTargetsFromFunctions` recurses into
each argument of each function it finds, so `messages` inside `sort(...)` inside `findFirst(...)`
is still registered and the row still re-renders when a message arrives. Worth knowing, because if
it did not, every one of these rows would silently stop updating.

---

## The ordering key is the risky part

Sorting by `createdAt` is only as good as `createdAt`. Two problems, both real today:

**1. iOS writes second resolution; everything else writes milliseconds.**
[`EVY+Mutations.swift:188`](../../ios/evy/Core/EVY+Mutations.swift) fills a created record's
`createdAt` with `EVY.nowISO8601()` — no fractional seconds. The API's own `validatePayload` uses
`new Date().toISOString()`, and the seed fixtures use `2026-06-01T00:00:00.000Z`. The API honours a
client-supplied `createdAt`, so what iOS sends is what gets stored — confirmed in a live database:

```
27f415a5 | 2026-07-29T07:33:19Z        <- created by the app
c84f227e | 2026-06-01T00:00:00.000Z    <- seeded
```

`sort` compares ISO strings lexicographically. Across those two formats that is **wrong**, not
merely imprecise: at index 19 one string has `.` (0x2E) and the other `Z` (0x5A), so
`…:20.500Z` sorts *before* `…:20Z` despite being half a second later.

**2. Ties fall back to store order, which favours the request.**
`evySort` breaks equal keys with `left.offset < right.offset` — original order — regardless of
direction. A request and its response created inside the same second tie, and the request was
stored first, so `desc` still yields the request. The page would sit on `pending` forever. This is
not hypothetical: the e2e suite answers a request milliseconds after creating it.

**The fix is to make iOS write fractional `createdAt` on create**, matching the API and the seeds.
One line, and it makes the format uniform so lexicographic ordering is total and same-second ties
essentially disappear. It applies to every created record, not just messages, which is the
consistency direction anyway.

With `archivedAt` gone, `createdAt` is load-bearing in a way it never was before — it is now the
*only* thing that orders a request against its answer. Rows already written with second resolution
keep mis-sorting against fractional ones; on a development database, reseeding clears that.

---

## Every state transition becomes a new message

| Who | Action | Before | After |
|---|---|---|---|
| buyer | request | create, `value: pending` | unchanged |
| owner | accept | create `value: accept` **+ update request's `archivedAt`** | create `value: accept` |
| owner | reject | create `value: reject` **+ update request's `archivedAt`** | create `value: reject` |
| buyer | cancel | **update request's `archivedAt`** | create `value: cancel` |

A cancel message is built exactly like a response: it addresses the same record, names the request
in `data.message_id`, and carries the request's `data` forward. So `respond` and `cancel` collapse
onto one primitive that appends a value; they stay separate named entry points because the callers
mean different things.

Two consequences worth stating plainly:

- **Nothing updates a message any more.** `messagesResource.toUpdateSet` becomes vestigial (it is
  still required by `makeCoreResource`, so leave it). The echo-back hazard that made the `status`
  migration delicate — `EVY.update` sending the whole record back, and
  `additionalProperties: false` rejecting a stale field — has no path to fire here, because there
  is no update call left on this resource.
- **`isSettled` replaces the archived check.** `swipeActions` currently asks "is this archived?"
  *and* "does a response exist?". The first question disappears; the second now covers
  cancellation too, since cancelling writes a message naming the request. `hasResponse` is worth
  renaming to `isSettled` for that reason — the semantics genuinely widened.

Check the state machine holds with nothing ever archived:

| Sequence | Live messages, newest first | Latest `value` | Result |
|---|---|---|---|
| request | request | `pending` | cancel shown |
| request → accept | accept, request | `accept` | time shown |
| request → reject | reject, request | `reject` | timeslots |
| request → cancel | cancel, request | `cancel` | timeslots |
| request → reject → request again | request₂, reject, request₁ | `pending` | cancel shown |

The last two rows are what the old predicates could not express without a mutable field.

> **Why not delete the request instead of appending `cancel`?** `delete` tombstones the row and
> clients drop it, so the latest message would fall back to whatever came before — which also
> works. It loses the history of what happened, and "the state is the latest message" stops being
> true of a resource whose rows can vanish. Appending is the cheaper invariant to keep.

---

## Every gate is per-type

Fifteen rows are gated on messages. Eleven already key off `data.type` — the request container, the
confirmation, the cancel button and the note, for each of the three methods. The other four are
page-wide today, and **they become per-type**, so each transfer method is independently
requestable:

| Row | Today | Becomes |
|---|---|---|
| `Transfer options` (TabContainer) | hidden whenever anything is live | **always visible** (`"true"`) |
| `Pickup available times` (TimeslotPicker, in the Pickup segment) | hidden whenever anything is live | hidden only when **pickup** is live |
| `Delivery available times` (TimeslotPicker, in the Delivery segment) | hidden whenever anything is live | hidden only when **delivery** is live |
| `Ask to buy` (Button, in the Shipping segment) | hidden whenever anything is live | hidden only when **shipping** is live |

The tab container has to stop hiding itself: it holds all three request controls, so hiding it
while any one method is live is exactly what made them mutually exclusive. With it always visible,
a buyer with a live pickup request can still switch to the Delivery tab and ask for delivery.

Each of the other three is now gated on its own segment's method, which is the same expression the
per-type rows already use. **So there is one lookup shape on the whole page** — no type-agnostic
variant, and no "at most one arrangement is live" invariant to maintain. That invariant was the
thing propping up the old page-wide gates; independence removes the need for it rather than
weakening it.

> **Two consequences to be deliberate about.** Nothing now stops a buyer from having pickup *and*
> delivery pending at once, or an owner from accepting both — the states are genuinely independent,
> which is what was asked for. If accepting one method should close the others off, that is a
> separate rule (an `accept` on any type hiding every picker) and it is not in this plan. Second,
> the live-request blocks stay siblings of the tab container, so they stack below it whichever tab
> is selected. Step 18 checks that reads sensibly before committing.

**Watch out for duplicate row names.** `Drop-off note` and `Shipping note` each exist **twice** —
once inside a tab segment (ungated, `visible: "true"`) and once inside the matching
`Active … request` container (gated on `!= accept`). Only the second of each pair changes. Edit by
position or by parent, never by name; a name-keyed script will silently rewrite the wrong row.

---

## File map

### Contract and server

| File | Change |
|---|---|
| [`types/schema/data/data.schema.json`](../../types/schema/data/data.schema.json) | Delete `DATA_EVY_Message.properties.archivedAt`. It is not in `required`, so that is the only edit. |
| `types/generated/**` | Regenerated by `bun run types:generate` — gitignored, never hand-edited. |
| [`types/validators.ts`](../../types/validators.ts) | `isIsoDateTimeFieldName` (~line 760) drops `archivedAt`, and `isoDateTimeFieldAllowsNull` (~line 764) plus its call site (~line 797) go with it — `archivedAt` was the only key that allowed null. |
| [`api/src/data/resources/messages.ts`](../../api/src/data/resources/messages.ts) | Drop `archivedAt: v.archivedAt ?? null` from `toUpdateSet`. |
| `api/drizzle/0002_*.sql` | **New**, from `bun run --cwd api db:generate`: `DROP COLUMN archived_at`, with the cancel backfill prepended by hand. See below. |
| [`scripts/seed.ts`](../../scripts/seed.ts) | `SeedMessageRow.archivedAt` and the `archivedAt` mapping in `buildMessageRows` both go. |
| [`scripts/fixtures/services/service_data.json`](../../scripts/fixtures/services/service_data.json) | The three seeded messages drop `"archivedAt": null`. |
| [`api/src/tests/data.test.ts`](../../api/src/tests/data.test.ts) | The message round-trip test archives as its update step; with no mutable field left, drop that step and let create/get/delete carry it. Add a case asserting `archivedAt` is now rejected as an unknown property, mirroring the existing `status` one. |
| [`services/marketplace/e2e/e2e.test.ts`](../../services/marketplace/e2e/e2e.test.ts) | The core-message payload drops `archivedAt: null`. |

`archived_at` exists only on `Message` — no other table is affected.

### The backfill

Drizzle emits the `DROP COLUMN`; prepend the data migration by hand, before the drop. An archived
request has to become a cancel message — but only if nothing already answered it, because under
the old model answering archived the request too:

```sql
-- Unwrapping `data` first: the bun-sql driver stores jsonb by JSON-stringifying it, so rows
-- written by the API hold a jsonb *string*. See the 0001 migration and docs/evy/data.md.
INSERT INTO "Message" (id, fk, service, resource, created_at, updated_at, data, visibility)
SELECT gen_random_uuid(), m.fk, m.service, m.resource, m.archived_at, m.archived_at,
       jsonb_set(<unwrap m.data>, '{value}', '"cancel"')
         || jsonb_build_object('message_id', m.id::text),
       m.visibility
FROM "Message" m
WHERE m.archived_at IS NOT NULL
  AND m.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Message" r
    WHERE <unwrap r.data> ->> 'message_id' = m.id::text
  );
--> statement-breakpoint
-- then Drizzle's generated DROP COLUMN
```

`<unwrap …>` is the `CASE jsonb_typeof(…)` expression from `0001_message_state_in_data.sql`; copy
it rather than reinventing it. If the environment is always reseeded the backfill is dead code and
can be dropped — but it costs nothing and makes the migration honest.

### iOS

| File | Change |
|---|---|
| [`ios/evy/Core/EVY+Mutations.swift`](../../ios/evy/Core/EVY+Mutations.swift) | `createWithGeneratedId` (~line 188): `EVY.nowISO8601()` → `EVY.nowISO8601(fractional: true)`, with a comment that ordering depends on it. |
| [`ios/evy/Core/EVY+MessageRequests.swift`](../../ios/evy/Core/EVY+MessageRequests.swift) | `Value` gains `cancel`. `archive` and `isArchived` are deleted. `respond` and `cancel` both append a message through one private helper. `hasResponse` → `isSettled`. Rewrite the type's doc comment: a message is write-once, and its lifecycle is `data.value` over `createdAt`. |
| [`ios/evyTests/EVYMessageRequestTests.swift`](../../ios/evyTests/EVYMessageRequestTests.swift) | `testRespondCreatesAResponseAndArchivesTheRequest` → `…AndLeavesTheRequestIntact`. `testCancelArchivesTheRequestAndCreatesNothing` → `testCancelAppendsACancelMessage`. `testNoAffordanceOnAnArchivedRequest` → `…OnACancelledRequest`, driven by a cancel message. Add: a cancel message carries the request's `type` and `message_id`, so `LATEST(T)` finds it. |
| [`ios/evyTests/EVYTestMessageFixtures.swift`](../../ios/evyTests/EVYTestMessageFixtures.swift) | Drop the `archivedAt` parameter from `message` and `request`. |
| [`ios/evyTests/interpreterTests.swift`](../../ios/evyTests/interpreterTests.swift) | **New cases** for the primitive (below). Five existing cases pass `archivedAt:` to the fixture and two assert on it — repoint them; the predicates that read `archivedAt == null` become `data.value == pending`, which is what they actually meant. |
| [`ios/evyTests/EVYActionRunnerTests.swift`](../../ios/evyTests/EVYActionRunnerTests.swift) | **Messages now have no mutable field at all**, so the two generic update-mechanics tests can no longer use them as a vehicle — they currently filter on `archivedAt: null` and change `archivedAt: now()`. Move them to a scratch resource, which is where they belonged when `status` was repointed. `archivedAtByMessageId` goes with them. |
| [`ios/evyTests/EVYStoreRoutingTests.swift`](../../ios/evyTests/EVYStoreRoutingTests.swift) | If any case asserts an exact `createdAt`, it now has milliseconds. |

### Fixtures

| File | Change |
|---|---|
| [`scripts/fixtures/services/service_sdui.json`](../../scripts/fixtures/services/service_sdui.json) | All 15 message-gated rows rewritten per the reference above; `Transfer options` loses its lookup entirely. The three request-creating `create` actions drop `"archivedAt": "null"`. The three cancel-confirm actions change from an `update` that sets `archivedAt` to a `create` of a cancel message. Mind the duplicated `Drop-off note` / `Shipping note` names. |

### Web

| File | Change |
|---|---|
| [`web/app/utils/functions.ts`](../../web/app/utils/functions.ts) | `evyCollectionPlaceholder` does `args.split(",")`, which is not paren-aware, so a nested `sort(...)` makes the builder's mock render `sort(messages` instead of `messages`. Cosmetic, in mock output only — reuse the top-level splitter from [`functionArgs.ts`](../../web/app/utils/functionArgs.ts). |
| [`web/app/utils/actionBranch.test.ts`](../../web/app/utils/actionBranch.test.ts), [`web/integration/builderAssistFlow.pw.ts`](../../web/integration/builderAssistFlow.pw.ts) | Use `archivedAt` as the example field in `changes` / `data` maps. Those keys are unconstrained so nothing breaks, but they document a field that no longer exists — repoint to a field that does. |

### Docs

| File | Change |
|---|---|
| [`docs/evy/methods.md`](../evy/methods.md) | Under **findFirst**: the two-argument form accepts a nested collection call, and `findFirst(sort(c, desc, createdAt), <predicate>)` is how to say "the latest matching record". Note the tie-break is original order, so the sort field has to be unique enough to order by. |
| [`docs/evy/data.md`](../evy/data.md) | **DATA_EVY_Message**: a message is write-once; its lifecycle is the sequence of messages about a request, ordered by `createdAt`; `data.value` is `pending` / `accept` / `reject` / `cancel`; the latest message for an `(fk, data.type)` pair is that pair's state, and pairs are independent of one another; `createdAt` carries milliseconds because it is the ordering key. Delete the `archivedAt` references, including the cancellation sentence. |
| [`docs/evy/sdui.md`](../evy/sdui.md) | The swipe section says an open request is one whose `data.value` is `pending`; it no longer mentions archiving. |

---

## Expression reference

One shorthand, written out in full in the fixture. `I` is the items resource id
`dc28ed59-298e-493c-8ff3-3e60f2ebccbd`; `T` is `pickup` / `delivery` / `shipping`.

```
LATEST(T) = findFirst(sort(messages, desc, createdAt), fk == I.id && data.type == T)
```

| Row | Becomes |
|---|---|
| `Transfer options` (TabContainer) | `"true"` — no lookup at all |
| `Pickup available times`, `Delivery available times`, `Ask to buy` | `{LATEST(T).data.value != pending && LATEST(T).data.value != accept}`, `T` being that segment's own method |
| `Active T request` (VerticalContainer) | `{LATEST(T).data.value == pending \|\| LATEST(T).data.value == accept}` |
| `T accepted confirmation` (Text) | `{LATEST(T).data.value == accept}` |
| `Cancel T request` (Button) | `{LATEST(T).data.value == pending}` |
| `Drop-off note`, `Shipping note` — **the copies inside `Active … request`** | `{LATEST(T).data.value != accept}` |
| `T accepted confirmation` **subtitle** | `formatDatetime(LATEST(T).data.time, …)` — shipping reads `.data.postalcode` |
| `Confirm cancel T request` **action** | was an `update` setting `archivedAt`; becomes a `create` on `messages` with `data: "{message_id: LATEST(T).id, value: cancel, type: T, time: LATEST(T).data.time}"` |

Note the pickers' gate and the request container's gate are exact complements of each other, on the
same lookup: one shows while the state is `pending` or `accept`, the other while it is anything
else. That is the whole state machine, twice per method.

**Why the empty case works.** With no match `findFirst` returns `.string("")`, and reading
`.data.value` off it yields an empty value that compares unequal to both `pending` and `accept` —
so "no messages" lands on the same branch as `reject` and `cancel` without a special case. The
existing fixture already leans on this (`findFirst(...).fk != I.id` when nothing matches); step 1
pins it so it is a tested property rather than an accident.

**The cancel action needs the request's id at tap time.** A filter could not reach `data.value`,
which is why the current cancel names the request with `findFirst(...).id`; the same expression now
supplies `message_id` on the created message. Inline `create` data resolves function calls — that
is how `now()` works in an action — so `LATEST(T).id` resolves there.

---

## Steps

Branch off the current one: `git checkout -b feat/latest-message-state`.

Bring the stack up — the iOS unit tests fire real RPCs and the fixtures need reseeding:
`docker compose up -d --wait postgres`, then `bun run --cwd api db:migrate` and `bun run db:seed`.

The sequence is deliberately **latest-message first, `archivedAt` removal second**. Both halves are
green on their own, and doing it the other way round leaves the app briefly unable to close a
request out at all.

### Phase 1 — pin the primitive (test first)

1. Add the interpreter cases to
   [`interpreterTests.swift`](../../ios/evyTests/interpreterTests.swift), following the existing
   `store(_:at:)` / `parseTextFromText` pattern used by the `findFirst` cases around line 640.
   Seed three messages for one `fk` with **millisecond** `createdAt` values, two of them matching
   the predicate:
   - `findFirst(sort(messages, desc, createdAt), fk == item.id && data.type == pickup).id` is the
     newest matching id, not the first stored;
   - the same expression with `asc` returns the oldest, proving the sort is what decides;
   - a predicate matching nothing gives `""`, and `….data.value != pending` is true for it.
2. Run `xcodebuild test -project ios/evy.xcodeproj -scheme evy -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:evyTests/interpreterTests`.
   These should **pass with no production change** — they document a capability that already
   exists. If any fails, stop: the whole plan rests on this. A failure turns into a real
   interpreter change (most likely teaching `_resolveBindingRoot` or `evyFindFirst` about the
   nested collection argument), and the rest should be re-cut around it.
3. Commit: `[TEST] Pin findFirst over a sorted collection with a predicate`.

### Phase 2 — make `createdAt` orderable, and answer without archiving

4. Add a failing case to
   [`EVYMessageRequestTests.swift`](../../ios/evyTests/EVYMessageRequestTests.swift): after
   `respond`, the request is **not** archived, and a `sort(…, desc, createdAt)` over the two
   messages puts the response first. The second half is what catches second-resolution
   timestamps — it fails while `createdAt` has no milliseconds, because the tie-break returns the
   request.
5. Rename `testRespondCreatesAResponseAndArchivesTheRequest` to
   `testRespondCreatesAResponseAndLeavesTheRequestIntact` and flip its `archivedAt` assertion to
   `XCTAssertNil`.
6. Run `-only-testing:evyTests/EVYMessageRequestTests`. Red on both.
7. Change `createWithGeneratedId` in
   [`EVY+Mutations.swift`](../../ios/evy/Core/EVY+Mutations.swift) to
   `EVY.nowISO8601(fractional: true)`, with a comment: this is the ordering key for
   "latest message wins", and mixing formats breaks the lexicographic compare `sort` does.
8. Drop `try archive(request)` from `respond`. `archive` stays for now, reached only from `cancel`.
9. `grep -rn "createdAt" ios/evy ios/evyTests` and check nothing compares it for equality against
   a hand-written second-resolution string, or slices it by index. Fix whatever does.
10. Run the whole unit target. Green.
11. Commit: `[FEAT] Order messages by a millisecond createdAt, and answer without archiving`.

### Phase 3 — the latest message drives the item page

12. Set `Transfer options` to `visible: "true"` in
    [`service_sdui.json`](../../scripts/fixtures/services/service_sdui.json). This is the edit that
    makes the methods independent — until the tab container stops hiding itself, per-type picker
    gates cannot be reached.
13. Run `bun test scripts/`. `shipped-fixture-action-branches.test.ts` validates every action
    branch, so a malformed edit fails immediately.
14. Rewrite the pickup rows to `LATEST(pickup)`, keeping `&& archivedAt == null` in the lookups for
    now — cancel still archives at this point. Five rows: `Pickup available times` (the picker gate,
    previously page-wide), the `Active pickup request` container, the confirmation `visible`, the
    confirmation subtitle, and `Cancel pickup request`. Run `bun test scripts/`.
15. Repeat for delivery — `Delivery available times`, container, confirmation, subtitle, cancel, and
    the `Drop-off note` **inside `Active delivery request`** (not the one in the Delivery segment).
    Run `bun test scripts/`.
16. Repeat for shipping — `Ask to buy` as the picker-equivalent gate, container, confirmation, the
    `postalcode` subtitle, cancel, and the `Shipping note` **inside `Active shipping request`**. Run
    `bun test scripts/`.
17. Validate the whole flows, not just the branches — `service_sdui.json` is an **array of two
    flows**, so validate each element with `validateUiFlow` rather than the file. Then grep the file
    for `findFirst(messages` and confirm every remaining hit names a `data.type`; a page-wide
    lookup left behind is the one mistake this phase can make silently.
18. `bun run db:seed`, then walk it in the simulator as the buyer against the seeded Freezer:
    - pickup: request → cancel button appears, pickup timeslots go, **the tabs stay** and the
      Delivery tab still offers its timeslots;
    - request delivery **as well** → both live requests show, each with its own cancel;
    - cancel pickup → pickup timeslots return, delivery stays live;
    - accept delivery via the emitter → confirmation shows the agreed time, its cancel goes;
    - reject a fresh pickup request → **pickup timeslots return and requesting again works**.
    The second and third checks are the point of this change; the last is the case the old
    predicates could not express. Check the live-request blocks stacking below the tabs reads
    sensibly — if it does not, moving each into its own segment is a fixture-shape follow-up.
19. `bun run format`, then commit: `[FEAT] Each transfer method's latest message drives its own state`.

### Phase 4 — remove `archivedAt`

20. Delete `archivedAt` from `DATA_EVY_Message` in
    [`data.schema.json`](../../types/schema/data/data.schema.json), then run
    `bun run types:generate`. Confirm the generated `message` table has no `archived_at` and the
    emitted `DATA_EVY_Message` has lost the field.
21. Clean up [`types/validators.ts`](../../types/validators.ts): drop `archivedAt` from
    `isIsoDateTimeFieldName`, and delete `isoDateTimeFieldAllowsNull` and its call site.
22. Drop `archivedAt` from `toUpdateSet` in
    [`messages.ts`](../../api/src/data/resources/messages.ts), from `SeedMessageRow` and
    `buildMessageRows` in [`seed.ts`](../../scripts/seed.ts), from the three seeded messages in
    `service_data.json`, and from the marketplace e2e payload.
23. Fix the API tests: drop the archive step from the message round-trip, and add the
    `archivedAt`-is-rejected case next to the existing `status` one.
24. Run `bun run --cwd api test:unit` and `bun test scripts/`. Green.
25. Generate the migration: `bun run --cwd api db:generate`. Inspect the emitted
    `api/drizzle/0002_*.sql` — it should only drop `Message.archived_at`. Prepend the cancel
    backfill by hand, copying the jsonb-unwrap expression from `0001_message_state_in_data.sql`,
    keeping the `DROP COLUMN` last.
26. Apply and reseed: `bun run --cwd api db:migrate`, `bun run db:seed`. Verify with
    `docker compose exec -T postgres psql … -c '\d "Message"'` that the column is gone.
27. In [`EVY+MessageRequests.swift`](../../ios/evy/Core/EVY+MessageRequests.swift): add `cancel` to
    `Value`, delete `archive` and `isArchived`, route `respond` and `cancel` through one private
    append helper, and rename `hasResponse` to `isSettled`.
28. Update the iOS tests: rename the cancel and archived-request cases per the file map, drop the
    `archivedAt` parameter from
    [`EVYTestMessageFixtures.swift`](../../ios/evyTests/EVYTestMessageFixtures.swift), repoint the
    `archivedAt` predicates and fixtures in `interpreterTests.swift`, and move the two generic
    update-mechanics tests in `EVYActionRunnerTests.swift` onto a scratch resource — messages have
    no mutable field left to exercise.
29. Run the whole unit target. Green.
30. In `service_sdui.json`: drop `"archivedAt": "null"` from the three request-creating `create`
    actions, drop `&& archivedAt == null` from all fifteen `LATEST` lookups, and turn the three
    cancel-confirm `update` actions into `create` actions appending a cancel message. Run
    `bun test scripts/` after each transfer type.
31. Reseed and walk the cancel path in the simulator: request → cancel → timeslots return, and the
    database holds a `value: cancel` message rather than an archived request.
32. `bun run format`, then commit: `[FEAT] Messages are write-once; cancelling is a message`.

### Phase 5 — docs, builder, end to end

33. Update `docs/evy/data.md`, `docs/evy/methods.md` and `docs/evy/sdui.md` per the docs table.
34. Make `evyCollectionPlaceholder` in
    [`web/app/utils/functions.ts`](../../web/app/utils/functions.ts) paren-aware using the helper
    in `functionArgs.ts`, and repoint the `archivedAt` example fields in the two web test files.
    Run `bun run --cwd web test:unit` and `bun run --cwd web typecheck`.
35. In [`ios/e2e/e2e.swift`](../../ios/e2e/e2e.swift): replace `messageIsArchived` with a check for
    a `value: cancel` message, drop the archived half of `assertResponsePersisted`, and update the
    shared expression builders (`cancelRequestVisibilityExpressions`,
    `activeRequestVisibilityExpression`, `acceptedRequestFindFirstExpression`,
    `pendingRequestVisibilityExpression`, `hideSegmentInfoWhenAcceptedVisibilityExpression`) to the
    `LATEST` forms so the synthetic flows match the shipped fixture.
    `cancelRequestVisibilityExpressions()` returns a page-wide `noActive` today and now needs a
    `type:` parameter like its siblings — it is the signature that encodes the old assumption.
36. `testSenderIsOfferedCancelAndCannotAnswerItsOwnRequest` asserts the request is archived after
    cancelling — it should now assert a cancel message exists naming the request, and that no
    accept or reject does.
37. Add an e2e case for the rejection path: request, reject it via the emitter, and assert the
    pickup timeslots come back and the cancel button is gone. Nothing covers this today, and it is
    the behaviour the change exists for.
38. `./run-e2e.sh` from the root. If the Docker Hub image pull times out (it has before), use
    `./run-e2e.sh --ci`, which runs the services directly with Bun — but note its cleanup runs
    `docker compose down -v` and will destroy the database volume, so re-migrate and reseed after.
39. `bun run format`, then commit: `[FEAT] End-to-end coverage for cancelling and rejecting`.
40. Open the PR: `[FEAT] A message's lifecycle is its value and its createdAt`. Summary, the major
    changes, tests run, and the risks below.

---

## Risks and follow-ups

| Risk | Note |
|---|---|
| **Everything rests on one untested expression form.** | `findFirst(sort(…), <predicate>)` is supported by construction — `_resolveBindingRoot` dispatches `sort`, `_splitFunctionArguments` is paren-aware — but nothing exercises it. Phase 1 exists to find out before 16 predicates depend on it. |
| **`createdAt` becomes load-bearing with no fallback.** | It was previously one signal among several; with `archivedAt` gone it is the *only* thing ordering a request against its answer. A wrong or duplicated timestamp now shows the wrong state, where before `archivedAt` would still have closed the request. This is the real cost of the simplification and the reason Phase 2 comes first. |
| **Second-resolution `createdAt` already in a database.** | Rows written by an older build keep mis-sorting against fractional ones, and the failure is silent: the page sits on the wrong state. Reseeding fixes a dev database; a normalising migration is the production answer and is not in this plan. |
| **Ties still resolve to store order.** | Milliseconds make collisions unlikely, not impossible. If two messages share a `createdAt`, the older-stored one wins under `desc` — showing `pending` over an `accept`. Failing toward "not yet answered" is the safe direction, but comment it next to the sort so nobody assumes strict determinism. |
| **The backfill cannot always tell cancelled from answered.** | It infers it: archived with no message naming it means withdrawn. That is right for data written by the current code, but an archived request whose answer was hard-deleted would become a spurious cancel. Worth eyeballing the row count the `INSERT` reports before trusting it. |
| **`sort` re-sorts the whole collection per expression.** | Sixteen predicates each sort every message for the item on every re-render. Fine at current volume; the fix is a `findLatest(collection, predicate)` that scans for the maximum instead of sorting, which would also shorten the expressions considerably. Worth doing as sugar even before it matters. |
| **Nothing stops two methods being live at once.** | The point of the change, and worth being clear-eyed about: a buyer can have pickup and delivery pending together, and an owner can accept both, leaving an item with two agreed transfer arrangements. Whether an `accept` on one method should close the others is a product rule, not a gating detail, and is deliberately out of scope here. If it is wanted, it is one extra term on the three picker gates. |
| **The live-request blocks stack below the tabs.** | With the tab container always visible, a live pickup request renders below it regardless of which tab is selected, and two live requests stack. Step 18 looks at it; the tidier shape is moving each `Active … request` inside its own segment, which is a fixture restructure rather than a logic change. |
| **`Drop-off note` and `Shipping note` each name two rows.** | One inside a tab segment (ungated), one inside the matching `Active … request` (gated). Only the latter changes. A name-keyed edit hits the wrong one and the mistake is invisible until someone reads the page with a live request. |
