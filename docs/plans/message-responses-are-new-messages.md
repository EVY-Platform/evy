# Accepting or rejecting a request creates a new message

A transfer request (pickup / delivery / shipping) is a `DATA_EVY_Message` addressed to a
marketplace item. Today the **recipient** accepts it by mutating that message — `status` goes
`pending` → `accepted` — and the **sender** cancels it by mutating the same row's `archivedAt`.
Nothing distinguishes the two parties, so the accept affordance is offered to whoever is holding
the message, including the person who sent it.

Three changes, together:

1. **Responding creates a brand new message** carrying the original message's id and the decision
   in its `data` object. The request itself is never rewritten to say it was accepted, and the
   `status` column is **removed** — `data.value` carries all three states instead.
2. **The recipient gets accept / reject; the sender gets cancel.** Which one you are is decided
   from the ownership the device already declares on sync — the same ownership that decided you
   received the message in the first place.
3. **The sender receives the response** because they own the message it answers. That is a new
   entitlement clause on the server, in the same shape as the existing recipient rule.

Points 1 and 3 are platform behaviour. Point 2 is **hard-coded on iOS for now**: it cannot be
expressed in SDUI today, for three concrete reasons set out below.

---

## The response message

A response is an ordinary message. It addresses the same record as the request it answers, so
both parties' item pages can find it with the flat expressions the interpreter supports.

| Field | Value | Why |
|---|---|---|
| `fk` | the request's `fk` (the item id) | Keeps the response on the same record, so `findFirst(messages, fk == item.id …)` on the item page sees it, and the item owner stays entitled to it by the ordinary recipient rule. |
| `service` / `resource` | the request's `service` / `resource` (marketplace / items) | Same reason. Also the only legal choice: `Message.service` and `Message.resource` are `uuid` columns and core resources are addressed by name, so a message **cannot** address another message. |
| `visibility` | `"private"` | Filled in by `createWithGeneratedId` from `core.resources.json`; no caller supplies it. |
| `data.message_id` | the request's `id` | The link back to what was answered. Also what the server's new entitlement clause matches on. |
| `data.value` | `"accept"` or `"reject"` | The decision. A *request* carries `"pending"` here — see below. |
| `data.type` | copied from the request (`pickup` / `delivery` / `shipping`) | **Denormalised on purpose** — see below. |

### `data.value` carries all three states, and `status` goes away

`status` (`pending` | `accepted`) was the mutable field this change exists to stop writing. Rather
than leave it behind as a column nothing reads, it is **removed from the schema** and `data.value`
takes over the whole state vocabulary:

| Message | `data.value` |
|---|---|
| a request, unanswered | `"pending"` |
| an accept response | `"accept"` |
| a reject response | `"reject"` |

Requests carry `"pending"` explicitly rather than leaving `value` absent. Both work — `findFirst`
treats a missing key as null via `recordPathIsNull` — but explicit is better here for three
reasons: the predicates read as a state machine (`data.value == pending` next to
`data.value == accept`) instead of mixing a null test with equality tests; `classify` can
positively identify a request instead of inferring one from an absent field, so a future message
kind that happens to carry no `value` will not be mistaken for a transfer request; and it keeps
one vocabulary rather than two ways to say "not answered yet".

Removing the column is a real schema change — the only one in this plan — and it needs a
**backfill**, because `additionalProperties: false` on `DATA_EVY_Message` means a payload that
still carries `status` is rejected outright. See *Removing `status` safely*.

### Why `data.type` is copied onto the response

`findFirst` predicates cannot nest. `resolveFindFirstOperand` in
[`ios/evy/Utils/functions.swift`](../../ios/evy/Utils/functions.swift) resolves an operand as a
path on the candidate record, then as a data path, then as a literal — it never evaluates a
function call. So this is **not** expressible:

```
findFirst(messages, data.message_id == findFirst(messages, fk == item.id && data.type == pickup).id)
```

Copying `type` onto the response turns every lookup the item page needs into a flat predicate:

```
findFirst(messages, fk == item.id && data.type == pickup && data.value == accept)
```

The duplication is a deliberate cost of the current expression language. If nested `findFirst`
ever lands, `data.type` on responses becomes redundant and can be dropped.

### Responding archives the request

When a response is created, the responder also sets `archivedAt` on the request. This is the one
part of the change that keeps mutating a message, and it is load-bearing:

- After a **reject**, the buyer must be able to request a different timeslot. The item page's
  "is a request open?" gate is a flat `findFirst`, so it cannot ask "a request with no response".
  Archiving the request is what makes it stop matching.
- After an **accept**, the request is likewise closed, and the accept *response* is what keeps the
  picker hidden and the confirmation row visible.

`archivedAt` is already the established close-out field — `cancel` writes exactly this. What the
change removes is mutation of the *decision*, which is now immutable and additive.

> **Decision to confirm.** The alternative is to leave the request live and accept that a rejected
> request blocks re-requesting until the interpreter can join a request to its response. If you
> would rather keep messages append-only end to end, that is the trade, and this plan should be
> re-cut around a nested-`findFirst` or a client-side join first.

---

## Why the sender receives the response

Message entitlement today, in
[`api/src/data/resources/messages.ts`](../../api/src/data/resources/messages.ts):

| Clause | Matches | Who it serves |
|---|---|---|
| `syncEntitlementClause` | public rows, or `id IN ownedIds` | the message's creator, and anyone who has already received it (receipt lands it in the private store, which confers ownership) |
| `recipientClause` | `(service, resource, fk)` matches a group the device declared | the owner of the record the message addresses — the seller |

A response addresses the *item*, so `recipientClause` delivers it to the seller — who is the
person that just created it. The **buyer** owns neither the response nor the item, so nothing
delivers it to them. That is the gap.

The buyer does own the request. So the new clause is: **a message answering a message you own is
yours**.

```ts
/**
 * A response is entitled to whoever owns the message it answers: the request's sender
 * owns neither the response nor the record it addresses, so nothing else would reach them.
 *
 * Matched through `data`, not through `fk`/`service`/`resource`: those are uuid columns and
 * core resources are addressed by name, so a message can never address another message
 * directly. `->>` yields text, so a malformed or absent value simply fails to match instead
 * of throwing on a cast.
 */
function responseClause(ownedMessageIds: string[]): SQL | undefined {
  if (ownedMessageIds.length === 0) return undefined;
  return inArray(
    sql`lower(${message.data} ->> 'message_id')`,
    ownedMessageIds.map((id) => id.toLowerCase()),
  );
}
```

`scope.ownedIds` is already exactly "message ids this device declared owning" —
`splitOwnedServiceResources` in [`api/src/procedures/sync.ts`](../../api/src/procedures/sync.ts)
buckets the core-service groups by resource name, so `messages` receives its own ids. No change
to the sync request contract, and no change to `sync.ts`.

The clause joins the existing OR:

```ts
const entitlement = [
  syncEntitlementClause(message, scope.ownedIds),
  recipientClause(scope.ownedForeignKeys),
  responseClause(scope.ownedIds),
].filter((clause): clause is SQL => clause !== undefined);
```

`lower()` on both sides because ids arriving on the wire are only guaranteed to be uuids, not
lowercase ones. iOS mints lowercase (`createWithGeneratedId`) and seeds are lowercase, so this is
belt-and-braces rather than a live bug — but it is cheap and the failure mode is silent.

**Cursor invalidation is unaffected.** `declaredOwnershipFingerprint` exists because externally
*declared* ownership can expose rows older than the cursor. Ownership of a request is earned by
creating it or receiving it, and a response cannot predate the request it answers, so this clause
can never surface a row from before the cursor. Worth a sentence next to the fingerprint comment
in [`EVY+Ownership.swift`](../../ios/evy/Core/EVY+Ownership.swift), which currently reasons about
exactly this.

---

## Why the role gating is hard-coded on iOS

Three independent limits, each of which alone would be enough:

1. **`visible` has no datum.** `EVYRow.makeVisibilityState` calls
   `EVY.evaluateFromText(visibleExpr)` with no datum argument, so `{$datum…}` cannot appear in a
   `visible` expression. A `Search` child row therefore cannot vary its visibility per result —
   which is what "hide accept/reject on my own request" needs.
2. **There is one swipe affordance, not two.** `EVYSwipeableRow` renders a single
   `trailingActionButton`, and `UI_RowActions` has one `swipe-left` list. Accept *and* reject need
   two buttons.
3. **No expression can ask "am I the recipient?"** Ownership lives in `EVYOwnershipLedger`
   (`UserDefaults`) and the private store. It is not data the interpreter can read, and there is
   no function that exposes it.

So the decision moves into Swift, behind one small classifier that the UI consults. Making it a
platform primitive later means: a datum-aware `visible`, multi-action swipe in the row schema, and
an ownership predicate in the expression language. None of that is in this change.

---

## What stays as it is

- **The sync request contract** (`sync.request.schema.json`) and `api/src/procedures/sync.ts`.
- **`recipientClause`** and its uuid guard. A message still never addresses a core resource.
- **`Message.data` itself.** It is `additionalProperties: JSONValue`, so `message_id` / `value` /
  `type` need no schema work. The only schema edit anywhere is deleting `status`.
- **`cancel`.** Still a store-mode `update` writing `archivedAt: now()`, still the sender's own
  record. It moves from SDUI to the hard-coded path, but the write is identical.
- **The web builder.** It edits structured invocations and never reads messages. Removing the
  `swipe-left` action from the shipped home fixture is a fixture edit, not a builder change.

---

## Removing `status` safely

`DATA_EVY_Message` is `additionalProperties: false`. The moment `status` leaves the schema,
**any payload still carrying it is rejected** — not ignored. That makes two things load-bearing.

### The echo-back hazard

`EVY.update` on iOS sends the **whole record** as `data`:

```swift
let params = MutationParams(… data: update.updatedData)   // EVY+Mutations.swift
```

So a device holding a pre-migration message row in its local store will echo `status` back on the
next `archivedAt` write, and the API will reject it — cancel and respond both break on that row.
The fix is the same one the `visibility` migration used: **the backfill must bump `updated_at`**,
so every entitled device re-receives the row without `status` and overwrites its local copy on the
next sync. A device that acts before syncing still fails; pre-auth, with seeds routinely
re-run, that is acceptable, but it is the failure mode to expect if someone reports a dead
cancel button.

### The backfill

Drizzle will emit the `DROP COLUMN`. Prepend the data migration by hand, before the drop
(precedent: `0001_backfill_flow_submits.sql`). Two statements, because the old vocabulary maps
onto the new one asymmetrically — `pending` is a rename, but `accepted` has to become a *second
row*:

```sql
-- An accepted request becomes a pending request plus an accept response.
INSERT INTO "Message" (id, fk, service, resource, created_at, updated_at, data, visibility)
SELECT gen_random_uuid(), fk, service, resource, updated_at, updated_at,
       jsonb_build_object('message_id', id::text, 'value', 'accept', 'type', data->>'type'),
       visibility
FROM "Message" WHERE status = 'accepted' AND deleted_at IS NULL;
--> statement-breakpoint
-- Every surviving request carries its state in `data`, and re-syncs to drop the stale column.
UPDATE "Message"
SET data = jsonb_set(data, '{value}', '"pending"'),
    archived_at = CASE WHEN status = 'accepted' THEN updated_at ELSE archived_at END,
    updated_at = <a fresh ISO 8601 timestamp>
WHERE data->>'value' IS NULL;
--> statement-breakpoint
-- then Drizzle's generated DROP COLUMN
```

`updated_at` is `text` holding ISO 8601, so match the format the rest of the codebase writes
rather than using `now()` — check how the existing baseline and backfill migrations spell it.
Responses are inserted with `updated_at = updated_at` of their request so they cannot land ahead
of the cursor bump on the row they answer.

If the environment is always reseeded from `service_data.json`, the backfill is dead code and can
be dropped — but leaving it in costs nothing and makes the migration honest.

---

## File map

### Contract and server

| File | Change |
|---|---|
| [`types/schema/data/data.schema.json`](../../types/schema/data/data.schema.json) | Delete `DATA_EVY_Message.properties.status` (~line 193) and its entry in `required` (~line 155). Nothing else in the def changes. |
| `types/generated/**` | Regenerated by `bun run types:generate` — gitignored, never hand-edited. |
| [`types/schema/data/drizzle.config.json`](../../types/schema/data/drizzle.config.json) | **No change.** Columns come from `data.schema.json`; this file only declares tables, enums and indexes, and `status` appears in none of them. |
| [`api/src/data/resources/messages.ts`](../../api/src/data/resources/messages.ts) | Add `responseClause` and fold it into the entitlement OR in `listMessagesForSync` (import `sql` from `drizzle-orm`). Drop `status: v.status` from `toUpdateSet`. |
| `api/drizzle/0005_*.sql` | **New**, from `bun run --cwd api db:generate`: the `DROP COLUMN`, with the backfill prepended by hand as above. |
| [`scripts/seed.ts`](../../scripts/seed.ts) | `SeedMessageRow` (~line 305) drops `status`; `buildMessageRows` (~line 318) drops the `status !== "pending" && status !== "accepted"` validation. |
| [`scripts/fixtures/services/service_data.json`](../../scripts/fixtures/services/service_data.json) | The three seeded messages (~lines 229-272) drop `"status": "pending"` and gain `"value": "pending"` inside `data`. |
| [`api/src/tests/data.test.ts`](../../api/src/tests/data.test.ts) | New `getSyncRows` cases (~line 606): a response reaches the owner of the message it answers; it does **not** reach a device owning an unrelated message; a message with no `data.message_id` is unaffected. Plus: drop `status` from the create/update round-trip test (~line 522) and its `expect(created.status)` / `expect(updated.status)` assertions — re-point that update at `archivedAt`. Re-point `"rejects invalid message payloads"` (~line 587) at a genuinely invalid field (`fk: "not-a-uuid"`), since `status: "invalid"` would now fail as an *unknown property* and pass for the wrong reason; add a case asserting `status` is rejected as unknown. |
| [`api/src/tests/validation.test.ts`](../../api/src/tests/validation.test.ts) | **Checked, no change.** The `status` occurrences (~lines 624, 634, 833) are inside SDUI action `changes` / `data` maps, whose keys are unconstrained — they are not message payloads. |
| [`types/grammar/conformance.json`](../../types/grammar/conformance.json) | **Optional tidy.** `ast-convert-create-inline-quoted` (~line 845) creates a message with `{status: "pending", type: pickup}`. It is a pure AST-shape vector with no schema validation, so it does not break — but it reads as documentation of how a message is created. Change to `{value: "pending", type: pickup}`. The `status_holder` vectors are generic and stay. |

### iOS

| File | Change |
|---|---|
| `ios/evy/Core/EVY+MessageRequests.swift` | **New.** The whole hard-coded rule: classify a datum, resolve the device's role, find an existing response, and perform respond / cancel. Sketch below. |
| [`ios/evy/UI/EVYSwipeableRow.swift`](../../ios/evy/UI/EVYSwipeableRow.swift) | Take `[EVYSwipeAction]` instead of one `swipeLabel` + `onExecute`. Reveal width becomes `revealWidth * actions.count`; `maxStretchWidth` scales with it. Per-action accessibility identifier. |
| [`ios/evy/UI/EVYRow.swift`](../../ios/evy/UI/EVYRow.swift) | In `renderedRow` (~line 329): if `EVYMessageRequest.classify(datum)` yields a request with a role and no response yet, build the hard-coded actions; otherwise fall back to the SDUI `swipeLeft` list exactly as today. |
| [`ios/evy/UI/Views/EVYSearchModel.swift`](../../ios/evy/UI/Views/EVYSearchModel.swift) | `loadLocalResults(source:…)` drops response messages when the source is the messages resource, so the inbox lists requests only. This is the one place that knows the source key. |
| [`ios/evy/Core/EVY+Ownership.swift`](../../ios/evy/Core/EVY+Ownership.swift) | Expose `EVYOwnershipLedger.recordedIds()`-backed `didCreate(service:resource:id:)` (it is already `internal`, so this may be a one-line helper rather than new API). Add the sentence about responses to the `declaredOwnershipFingerprint` comment. |
| [`ios/evy.xcodeproj/project.pbxproj`](../../ios/evy.xcodeproj/project.pbxproj) | The project uses explicit `PBXFileReference` entries (no synchronized groups), so **both new files must be registered by hand** — a `PBXBuildFile`, a `PBXFileReference`, a group child entry, and a `Sources` phase entry each. Copy the four `EVY+Ownership.swift` lines (35, 202, 391, 869) as the template. |

| Test file | Change |
|---|---|
| `ios/evyTests/EVYMessageRequestTests.swift` | **New.** Unit tests for classification, role resolution, response detection. Pure logic, no UI. |
| [`ios/evyTests/EVYTestMessageFixtures.swift`](../../ios/evyTests/EVYTestMessageFixtures.swift) | Drop the `status:` parameter (~line 12, 39). Add `messageId:` and `value:`, both landing inside `data`, so one call builds either a request (`value: "pending"`) or a response. |
| [`ios/evyTests/EVYSearchModelTests.swift`](../../ios/evyTests/EVYSearchModelTests.swift) | Responses are excluded from a messages-sourced search (it already builds message results, ~line 211). Its `status` usages (~lines 217, 251-253, 266) become `data.value`. |
| [`ios/evyTests/EVYActionRunnerTests.swift`](../../ios/evyTests/EVYActionRunnerTests.swift) | The swipe-left-accepts-a-pending-message test (~line 1520) asserted a `status` update. Re-point it at the hard-coded path, or delete it if `EVYMessageRequestTests` covers the same ground — do not leave it asserting a write that no longer happens. The message-status helper (~line 1062) and fixtures (~lines 988-1021, 1489-1507) go with it. |
| [`ios/evyTests/EVYStoreRoutingTests.swift`](../../ios/evyTests/EVYStoreRoutingTests.swift) | Several tests (~lines 107-125, 313, 424-449) use `status` on the **messages** resource purely as a generic mutable field to exercise `update` filters and store routing. iOS never validates against the schema, so they would keep passing while asserting on a field the contract no longer has. Point them at a scratch resource instead of `messages`, or use `data.value` — do not leave them as-is. |

### Fixtures

| File | Change |
|---|---|
| [`scripts/fixtures/evy/evy_sdui.json`](../../scripts/fixtures/evy/evy_sdui.json) | Message search child, **in two stages**. Phase 2: the `swipe-left` `update {status: accepted}` becomes a `create` of an accept response followed by an `update` archiving the request — the state model flips while the app keeps working. Phase 4: the whole `swipe-left` list and `swipeLabel` are deleted, since iOS owns the affordance. Also `subtitle` `{$datum.status}` → `{$datum.data.time}`. |
| [`scripts/fixtures/services/service_sdui.json`](../../scripts/fixtures/services/service_sdui.json) | The three request-creating `create` actions drop root `"status": "pending"` and add `value: pending` to the nested `data` literal. Every message predicate is re-cut — see the table below. Nine `visible` expressions plus the three cancel-confirm `update` actions. |

Requests are created at lines 220-227 (pickup), ~331-338 (delivery) and ~439-446 (shipping). Each
becomes, e.g.:

```jsonc
"data": {
  "fk": "dc28ed59-298e-493c-8ff3-3e60f2ebccbd.id",
  "service": "66b092ae-7cd8-4d67-95b7-30b03568fd90",
  "resource": "dc28ed59-298e-493c-8ff3-3e60f2ebccbd",
  "archivedAt": "null",
  "data": "{type: pickup, value: pending, time: selected_pickup_timeslot}"
}
```

`pending` is a bare word, so it stays a literal exactly as `pickup` already does — see
[actions.md](../evy/actions.md#create) on inline `data` resolution.

The item-page rewrite, by intent:

| Reads | Was | Becomes |
|---|---|---|
| "no request open" (picker + tabs, lines 129, 173, 293, 398) | `findFirst(messages, fk == I.id && archivedAt == null).fk != I.id` | `findFirst(messages, fk == I.id && archivedAt == null && data.value == pending).fk != I.id && findFirst(messages, fk == I.id && data.value == accept).fk != I.id` |
| "a request of this type exists" (lines 487, 594, 700) | `findFirst(messages, fk == I.id && archivedAt == null && data.type == T).fk == I.id` | Gate the container on either an open request **or** an accept response for that type. Two flat `findFirst` comparisons joined by top-level `\|\|`; pick one spelling and use it for all three types. |
| "accepted" (lines 493/495, 600/602, 706/708) | `… && status == accepted && data.type == T` | `… && data.type == T && data.value == accept` (drop `archivedAt == null`: responses are never archived) |
| "cancel is available" (lines 524, 630, 736) | `… && status == pending && data.type == T` | `… && archivedAt == null && data.type == T && data.value == pending` |

`I` is the items resource id `dc28ed59-298e-493c-8ff3-3e60f2ebccbd`; `T` is `pickup` /
`delivery` / `shipping`. Top-level `&&` between two `findFirst` comparisons is supported —
`_containsTopLevelBooleanSyntax` / `_evaluateBooleanExpression` handle it, and
`testConditionalActionEvaluatesLogicalExpression` in the e2e suite covers the shape.

`scripts/shipped-fixture-action-branches.test.ts` walks both fixtures and validates every action
branch against the row schema, so a malformed edit fails `bun test scripts/` immediately. Use it
as the fast feedback loop while editing.

The Phase 2 accept action is expressible in SDUI because inline `create` data resolves `$datum` —
worth knowing that only the *gating* needs Swift, not the write:

```jsonc
"swipe-left": [
  { "condition": "", "false": "",
    "true": { "fn": "create", "service": "475731ac-31aa-4d65-94d2-7032782ae359",
              "resource": "messages", "mode": "inline",
              "data": { "fk": "$datum.fk", "service": "$datum.service",
                        "resource": "$datum.resource",
                        "data": "{message_id: $datum.id, value: accept, type: $datum.data.type}" } } },
  { "condition": "", "false": "",
    "true": { "fn": "update", "service": "475731ac-31aa-4d65-94d2-7032782ae359",
              "resource": "messages", "mode": "store",
              "filter": { "id": "$datum.id" }, "changes": { "archivedAt": "now()" } } }
]
```

### Docs

| File | Change |
|---|---|
| [`docs/evy/data.md`](../evy/data.md) | **DATA_EVY_Message** (~line 174): replace "Cancelling sets `archivedAt`; accepting sets `status` to `accepted` via `{update(...)}`" with the response-message model and the `data.message_id` / `data.value` / `data.type` shape, including the `pending` / `accept` / `reject` vocabulary now that `status` is gone. Extend the entitlement paragraph (~line 180) with the third rule: a message answering a message you own is yours. |
| [`docs/evy/sdui.md`](../evy/sdui.md) | **Swipe (`swipe-left`)** (~line 188): iOS renders its own accept/reject/cancel affordance on transfer-request message rows and ignores the row's `swipe-left` list there. Name it as a temporary hard-coding with the three blockers. |
| [`ios/README.md`](../../ios/README.md) | One line pointing at `EVY+MessageRequests.swift` as the hard-coded, non-SDUI behaviour in the client, so the next reader does not go looking for a fixture. |

---

## Code sketches

### `EVY+MessageRequests.swift`

```swift
/// The one piece of domain behaviour the client hard-codes.
///
/// Who may accept a transfer request is not expressible in SDUI today: `visible` is evaluated
/// with no datum, a row has a single swipe affordance, and no expression can read the ownership
/// that decided the message reached this device. So it lives here, in one testable place, until
/// those three gaps close.
enum EVYMessageRequest {
  static let types = ["pickup", "delivery", "shipping"]

  enum Role { case sender, recipient }

  /// The whole state vocabulary, since `status` is gone. `pending` is only ever written by the
  /// request-creating flow; `respond` writes the other two.
  enum Value: String { case pending, accept, reject }

  struct Request {
    let id: String
    let fk: String
    let service: String
    let resource: String
    let type: String
  }

  /// A message-shaped datum that is a *request*: `data.type` is a transfer type and
  /// `data.value` is `pending`. Identifying it positively rather than by an absent `value`
  /// keeps a future message kind from being mistaken for one.
  static func classify(_ datum: EVYJson?) -> Request? { … }

  /// `sender` wins over `recipient`: you cannot accept your own request, even on a device that
  /// also owns the item. Uses the *ledger* rather than `ownedServiceResources()`, because
  /// receiving a message also confers ownership of it and would read as authorship.
  static func role(for request: Request) -> Role? {
    if EVY.didCreate(service: EVYNamespace.evy,
                     resource: EVYCoreResource.messages.rawValue,
                     id: request.id) {
      return .sender
    }
    let owned = EVY.ownedServiceResources()
    let ownsAddressedRecord = owned.contains {
      $0.service == request.service && $0.resource == request.resource
        && $0.ids.contains(request.fk)
    }
    return ownsAddressedRecord ? .recipient : nil
  }

  static func hasResponse(to requestId: String) -> Bool { … }

  static func respond(to request: Request, with response: Value) throws {
    _ = try EVY.create(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.messages.rawValue,
      data: [
        "fk": .string(request.fk),
        "service": .string(request.service),
        "resource": .string(request.resource),
        "data": .dictionary([
          "message_id": .string(request.id),
          "value": .string(response.rawValue),
          "type": .string(request.type),
        ]),
      ])
    try archive(request)
  }

  static func cancel(_ request: Request) throws { try archive(request) }

  private static func archive(_ request: Request) throws {
    try EVY.update(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.messages.rawValue,
      matching: ["id": .string(request.id)],
      changes: ["archivedAt": .string(EVY.nowISO8601())])
  }
}
```

`visibility` is not passed: `createWithGeneratedId` fills it from `core.resources.json` for core
resources, and passing one explicitly would let this call site choose it.

### The swipe affordance

```swift
struct EVYSwipeAction: Identifiable {
  let id: String        // accessibility suffix: "accept", "reject", "cancel", "" for SDUI
  let label: String     // EVY text, so "::check::" resolves to a Lucide icon
  let tint: Color
  let run: () -> Void
}
```

`EVYRow.renderedRow` then becomes, in outline:

```swift
let hardCoded = EVYMessageRequest.swipeActions(for: datum)   // [] when not a live request for us
let actions = hardCoded.isEmpty ? sduiSwipeActions(contentRow) : hardCoded
if !actions.isEmpty { EVYSwipeableRow(…, actions: actions) { … } } else { … }
```

Labels: `::check::` for accept, `::x::` for reject, `::x::` for cancel (`Constants.dangerColor`),
`Constants.actionColor` for accept. Both are Lucide names resolved by `UIImage(lucideId:)` in
`EVYTextView` — confirm they render rather than falling through to the literal `::x::` text.

Accessibility identifiers: keep `swipeLeft_<identity>` for the single SDUI action so
`testSwipeLeftButtonNavigatesToDestinationPage` keeps passing, and add
`swipeAccept_<identity>` / `swipeReject_<identity>` / `swipeCancel_<identity>`.

---

## Steps

Branch off `feat/messages-owners`, **not** `dev`: this plan builds on `SyncScope.ownedForeignKeys`,
`recipientClause` and `EVYOwnershipLedger`, which are 13 commits ahead of the default branch.
`git checkout -b feat/message-responses feat/messages-owners`.

Bring the stack up once — the iOS unit tests fire real RPCs: `docker compose up -d --wait`, then
`bun run db:seed`.

### Phase 1 — the server delivers a response to the request's sender

1. Add the three failing cases to the `getSyncRows` describe in
   [`api/src/tests/data.test.ts`](../../api/src/tests/data.test.ts) (~line 606). Reuse the
   existing `createMessage` / `owns` / `ownedIds` helpers; add a `createResponse(to:)` that
   writes `data: { message_id, value: "accept", type: "pickup" }` against `otherFk` so nothing
   but the new clause could match it. It still needs `status: "pending"` at this point — Phase 2
   takes that away:
   - a response reaches the device that owns the message it answers (`ownedIds: [request.id]`);
   - it does not reach a device owning only an unrelated message;
   - a message whose `data` has no `message_id` is unaffected by the clause.
2. Run `bun run --cwd api test:unit`. The first two fail. That is the red step.
3. Add `responseClause` to
   [`api/src/data/resources/messages.ts`](../../api/src/data/resources/messages.ts) and fold it
   into the entitlement array. Import `sql`.
4. Run `bun run --cwd api test:unit`. Green.
5. Run `bun run --cwd api lint` and `bunx biome check .`.
6. Commit: `[FEAT] A response message reaches the message it answers`.

### Phase 2 — state moves from `status` to `data.value`

This phase is self-contained and worth landing on its own: at the end of it, messages are
append-only and carry their state in `data`, while the app behaves exactly as it does today
(anyone holding the message can still accept it — that is Phase 3's job to fix).

7. Delete `status` from `DATA_EVY_Message` in
   [`data.schema.json`](../../types/schema/data/data.schema.json) — the property (~line 193) and
   its `required` entry (~line 155).
8. Run `bun run types:generate`. Confirm the generated `message` table no longer has a `status`
   column and that `DATA_EVY_Message` in the emitted TypeScript has lost the field.
9. Drop `status: v.status` from `toUpdateSet` in
   [`messages.ts`](../../api/src/data/resources/messages.ts).
10. Update [`seed.ts`](../../scripts/seed.ts): `SeedMessageRow` (~line 305) and the `status`
    validation in `buildMessageRows` (~line 318).
11. Update [`service_data.json`](../../scripts/fixtures/services/service_data.json): the three
    seeded messages drop `"status": "pending"` and gain `"value": "pending"` inside `data`.
12. Fix the API tests per the file map — the create/update round trip (~line 522), the
    `"rejects invalid message payloads"` trigger (~line 587), and the `createResponse` helper
    from step 1. Add the case asserting `status` is now rejected as an unknown property.
13. Run `bun run --cwd api test:unit` and `bun test scripts/`. Green.
14. Generate the migration: `bun run --cwd api db:generate`. Inspect the emitted
    `api/drizzle/0005_*.sql` — it should only drop `Message.status`. Prepend the backfill by hand
    exactly as in *Removing `status` safely*, keeping the `DROP COLUMN` last.
15. Apply and reseed: `bun run --cwd api db:migrate`, then `bun run db:seed`. Verify with
    `docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_EVY_DATABASE" -c 'SELECT data->>''value'', count(*) FROM "Message" GROUP BY 1;'`
    → only `pending` on a fresh seed, and no `status` column left in `\d "Message"`.
16. Rewrite the request-creating `create` actions and every message predicate in
    [`service_sdui.json`](../../scripts/fixtures/services/service_sdui.json) per the intent table.
    Work one transfer type at a time — pickup, then delivery, then shipping — and run
    `bun test scripts/` after **each**, so a malformed branch is caught while the edit is small.
17. In [`evy_sdui.json`](../../scripts/fixtures/evy/evy_sdui.json), turn the accept swipe into the
    two-action `create`-then-archive list shown above, and change `subtitle` to
    `{$datum.data.time}`.
18. Reseed and walk it by hand: request → accept → "Pickup confirmed", and request → cancel →
    picker returns. Nothing should read `status` anywhere.
19. `bun run format`, then commit: `[FEAT] Messages carry their state in data.value`.

### Phase 3 — the iOS classifier (test first)

20. Rework [`EVYTestMessageFixtures.swift`](../../ios/evyTests/EVYTestMessageFixtures.swift): drop
    the `status:` parameter, add `messageId:` and `value:` landing inside `data`, so one call
    builds a request (`value: "pending"`) or a response. Keep `visibility: "private"`.
21. Write `ios/evyTests/EVYMessageRequestTests.swift`:
    - a pickup/delivery/shipping message with `data.value == "pending"` classifies as a request;
      one with `accept`/`reject` does not; a non-message dictionary does not; an unknown
      `data.type` does not; a message with no `data.value` at all does not;
   - `role` is `.sender` when the ledger records the message id under `evy`/`messages`;
   - `role` is `.recipient` when `ownedServiceResources()` covers `(service, resource, fk)` and
      the ledger does **not** record the message — seed the item ownership with
      `EVY.recordOwnership`;
    - `role` is `.sender` when **both** hold (you own the item and you sent the request);
    - `role` is `nil` when neither holds;
    - `hasResponse` is true once a response fixture naming the request is in the store, and false
      for a response naming a different message;
    - `respond` creates a message whose `data` carries `message_id`, `value`, and the copied
      `type`, whose `fk`/`service`/`resource` mirror the request, and archives the request;
    - `cancel` archives the request and creates nothing.

    Follow `EVYStoreRoutingTests.swift` for setup: `EVYOwnershipLedger.reset()` in
    `setUp`/`tearDown`, and seed rows through `EVY.applySyncedValue` so visibility routing runs.
22. Register the new test file in
    [`project.pbxproj`](../../ios/evy.xcodeproj/project.pbxproj) — build file, file reference,
    group child, and the `evyTests` sources phase.
23. Run `xcodebuild test -project ios/evy.xcodeproj -scheme evy -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:evyTests/EVYMessageRequestTests`.
    Expect a compile failure on `EVYMessageRequest` — red step.
24. Write `ios/evy/Core/EVY+MessageRequests.swift` and register it in `project.pbxproj` (four
    entries, app target this time). Add whatever thin `EVY.didCreate(service:resource:id:)`
    helper the role check needs to
    [`EVY+Ownership.swift`](../../ios/evy/Core/EVY+Ownership.swift).
25. Re-run the same `-only-testing` invocation. Green.
26. Commit: `[FEAT] Classify transfer requests and the device's role`.

### Phase 4 — two swipe affordances

27. Generalise [`EVYSwipeableRow.swift`](../../ios/evy/UI/EVYSwipeableRow.swift) to
    `[EVYSwipeAction]`. Scale `revealWidth` and `maxStretchWidth` by `actions.count`, keep
    `revealSnapThreshold` as-is, and keep the ZStack ordering comment's invariant intact (content
    above the buttons, so a tap on a barely-open row closes rather than fires).
28. Run `-only-testing:evyTests` in full — the geometry helpers are pure and may already be
    covered. Fix any call-site breakage.
29. Wire the fallback in [`EVYRow.swift`](../../ios/evy/UI/EVYRow.swift) `renderedRow`: hard-coded
    message actions when `classify` yields a request with a role and `!hasResponse`, otherwise the
    SDUI `swipeLeft` list. Run the hard-coded handlers inside `EVY.withScope(evyScope)`, the same
    way `runActions` does, so the writes land in the row's own scope.
30. Delete the `swipe-left` list and `swipeLabel` from the message search child in
    [`evy_sdui.json`](../../scripts/fixtures/evy/evy_sdui.json) — iOS owns the affordance now, so
    `actions` becomes `{}`. Reseed.
31. Filter responses out of a messages-sourced list in
    [`EVYSearchModel.swift`](../../ios/evy/UI/Views/EVYSearchModel.swift) `loadLocalResults`, and
    add the case to
    [`EVYSearchModelTests.swift`](../../ios/evyTests/EVYSearchModelTests.swift).
32. Repoint the tests that used `status` on the **messages** resource as a generic mutable field:
    [`EVYStoreRoutingTests.swift`](../../ios/evyTests/EVYStoreRoutingTests.swift) (~lines 107-125,
    313, 424-449) and
    [`EVYActionRunnerTests.swift`](../../ios/evyTests/EVYActionRunnerTests.swift) (~lines
    988-1062, 1489-1527). iOS does not validate against the schema, so these pass either way —
    which is exactly why they need doing deliberately rather than being left to rot.
33. Run the whole unit target. Green.
34. Build the app: `xcodebuild -project ios/evy.xcodeproj -scheme evy -destination 'platform=iOS Simulator,name=iPhone 17' build`. Walk it by hand as the
    recipient and as the sender.
35. Commit: `[FEAT] Recipients accept or reject, senders cancel`.

### Phase 5 — end to end

The e2e suite is red from Phase 2 onward — it asserts on `status` in several places. That is
expected; this phase is where it comes back.

36. In [`ios/e2e/e2e.swift`](../../ios/e2e/e2e.swift), replace `waitForMessageStatus` /
    `messageHasStatus` (~line 684) with `waitForMessageResponse(emitter:messageId:value:)` /
    `messageHasResponse`, matching on `data.message_id` and `data.value`.
37. `testHomepageSwipeAcceptUpdatesPickupMessageStatus` (~line 4161) →
    `testHomepageSwipeAcceptCreatesAcceptResponse`. The class already declares ownership of the
    seeded item (`ownedServiceResources`, ~line 4030), so this device is the **recipient** — the
    accept affordance is the one it should see. Assert on the new
    `swipeAccept_<childRowId>_<messageId>` identifier and on a created response, not on a status
    change. Update `messageSearchHomeFlowData` to match the shipped fixture (no `swipe-left`).
38. Add `testHomepageSenderSeesCancelNotAcceptOrReject`: create the request **from the app** (the
    existing `testTimeslotPickerCreatesPickupRequest` path at ~line 2391 shows how), return to
    the inbox, and assert `swipeCancel_…` exists while `swipeAccept_…` / `swipeReject_…` do not.
    This is the case the change exists for and nothing covers it today.
39. Add `testHomepageSwipeRejectCreatesRejectResponse`, and assert the buyer's picker returns.
40. Rework `testAcceptedRequestHidesCancelAndShowsConfirmation` (~line 2645): instead of reading
    the message back and PUTting `status: "accepted"`, `createResource` a response message via the
    emitter with `data: { message_id, value: "accept", type: "pickup" }` and `fk` set to the item.
    The assertions on the hidden cancel button and the "Pickup confirmed for …" row stay.
41. Check `testCancelRequestTogglesPickerAndShippingButton` (~line 2555) and
    `testAskToBuyCreatesShippingRequestAndValidatesEmptyPostcode` (~line 2748) against the new
    predicates and fix the expectations they encode.
42. Add an API e2e case in [`api/e2e/e2e.test.ts`](../../api/e2e/e2e.test.ts): two connections,
    one creating a request against an item the other owns, the second creating a response, and
    the first receiving it on its next sync. This is the round trip the unit test can only
    approximate.
43. `./run-e2e.sh` from the root. Full suite, iOS included — this change touches the swipe path
    and the item page, so `--skip-ios` is not enough here.
44. `bun run format` from the repo root.
45. Commit: `[FEAT] End-to-end coverage for request responses`.

### Phase 6 — docs

46. Update `docs/evy/data.md`, `docs/evy/sdui.md`, and `ios/README.md` per the docs table.
47. Commit: `[FEAT] Document response messages and the hard-coded client rule`.
48. Open the PR: `[FEAT] Accepting or rejecting a request creates a new message`. Summary, the
    major changes, tests run, and the risks below.

---

## Risks and follow-ups

| Risk | Note |
|---|---|
| **`findFirst` is not "newest".** | `evyFindFirst` returns the first array match in store order. A second pickup request for the same item after a cancel could resolve to either. This predates the change and the archive predicates keep it survivable, but it is real and the new expressions lean on it harder. Worth a dedicated fix. |
| **A reinstall loses the sender role.** | The ledger is `UserDefaults`. A reinstalled device that received its own request back from sync reads as neither sender nor recipient (`role` → `nil`, no affordance) rather than wrongly offering accept. Fails closed, and resolves when auth lands and ownership derives from an account — same caveat `data.md` already records for messages. |
| **`data ->> 'message_id'` is unindexed.** | Every sync now evaluates a jsonb extraction over `Message`. Fine at current volume. An expression index is the fix, but it cannot be declared in `drizzle.config.json`, and hand-written SQL that the Drizzle schema does not know about breaks `db:generate` diffing — the same trap a previous migration hit. Defer deliberately. |
| **Dropping `status` is irreversible and strict.** | `additionalProperties: false` means a payload still carrying `status` is **rejected**, not ignored — and `EVY.update` echoes the whole record back, so any pre-migration row still in a device's local store breaks its next write. The backfill's `updated_at` bump is what fixes that, on the next sync. Ship API and app together; there is no version skew tolerance here. |
| **Every jsonb column in the database is double-encoded.** | Found while implementing: the `bun-sql` driver stores jsonb by JSON-stringifying it, so `Row.data`, `Flow.pageIds` and `Message.data` all hold a jsonb *string*. Reads are symmetric so the app never notices, but `data ->> 'key'` is NULL and `jsonb_set` throws. `messages.ts` reads tolerantly and the migration normalises `Message.data`, but **the write path still produces strings**, so the tolerance is load-bearing rather than transitional. Fixing the driver and normalising the other tables is its own change. The pglite unit tests store jsonb properly and would not have caught this — `returns responses stored with a double-encoded data column` writes the production shape on purpose. |
| **The `accepted` → response backfill creates rows.** | The only migration statement that inserts rather than updates. If it runs on a database with real accepted requests, verify the inserted responses carry a `type` (`data->>'type'` is null for any message that somehow lacked one) before trusting the item page. On a reseeded environment it is a no-op. |
| **Archiving on respond is still a mutation.** | Called out as a decision above. If append-only is the harder requirement, this plan needs re-cutting around a nested-`findFirst` or a client-side join first. |
| **The inbox hides responses.** | `EVYSearchModel` drops them, so the sender learns the outcome on the item page rather than in the inbox. A response-aware inbox row ("your pickup request was accepted") is the natural follow-up and needs either `if()` in the child's text or a datum-aware `visible`. |
