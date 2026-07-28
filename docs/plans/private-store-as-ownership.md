# Ownership from the private store plus a simple created-records ledger

Two changes, together:

1. **Messages become `visibility: "private"`**, so they live in `privateStore`. Whatever a device holds privately, it owns — which is how a message that reaches you stays owned once received, so its later updates keep arriving.
2. **The `ownedStore` SwiftData store is replaced by a plain ledger** of `(service, resource, id)` triples for records this device created, persisted in `UserDefaults` next to the sync cursor.

The ledger is what keeps a seller entitled to messages about an item they created. That matters because `visibility` cannot express it: it is one global column that only decides which iOS store a synced row is written to, and every device syncs every private row — that is why every device already holds *every seeded address* in its `privateStore`. So "private" does not mean "mine", and a marketplace item cannot be private without hiding the catalogue from everyone else. Created-record ownership has to be recorded explicitly; it just does not need a whole `EVYDataStore` to do it.

---

## The two ownership sources, and what each is for

| Source | Answers | Load-bearing for |
|---|---|---|
| **Ledger** — ids this device created | "I made this" | A seller who creates a **public** marketplace item and must receive buyers' messages addressed to it. Nothing else can express this. |
| **Private store** — private rows this device holds | "I hold this privately" | A message that arrives for you: it is in your private store, so it stays owned and its later updates keep coming. |
| Launch override (`EVY_OWNED_SERVICE_RESOURCES`, unchanged) | "the account would own this" | Seeded data in the e2e tests, standing in for auth. |

Worth being straight about the overlap: with the ledger in place, the private-store source is largely **robustness rather than strictly load-bearing today**. A buyer owns their message via the ledger (they created it), and a seller keeps receiving it via the item id in the ledger. The private-store source earns its place for the case where a device is entitled some other way — the override now, an account after auth — and should keep receiving that message afterwards without re-deriving why. It is a few lines, and it is the model asked for; just do not expect a test to fail if you remove it.

---

## Malformed ids are a contract violation, not something to filter around

`ownedServiceResources.ids` is `format: "uuid"` in [`sync.request.schema.json`](../../types/schema/rpc/sync.request.schema.json) and `validateSyncRequest` enforces formats, so **one bad id fails the entire sync request** — every resource, not just that group. Per the decision on this: that rejection is correct and should not be papered over with a silent client-side uuid filter. A non-uuid id in the request is a bug at the source.

That means the source has to be *defined* correctly rather than *filtered* afterwards. The one real trap:

- `EVY.store(for: "$local:key")` returns `privateStore`, and local singletons are written with `id = EVYNamespace.singletonId` (`"current"`). `testLocalPrefixRoutesToPrivateDataStore` in [interpreterTests.swift](../../ios/evyTests/interpreterTests.swift) does exactly this.
- `applySyncedRecord` falls back to `singletonId` for any synced value with no `id` of its own.

So the private-store source enumerates **only service-namespaced rows** — skipping `EVYNamespace.local`, `.cache` and `.draft`. That is not defensive filtering; those namespaces hold scratch values and local singletons, which are not records the server knows about and were never ownership candidates. It is the same exclusion [`EVYDataStore.namespace(forSyncedResource:)`](../../ios/evy/Data/EVYDataStore.swift) already makes when resolving a binding key.

To make a violation loud instead of mysterious, add a debug assertion where the request is assembled rather than a filter:

```swift
assert(
  ids.allSatisfy(isEvyRecordId),
  "ownedServiceResources must only contain record ids - the sync request schema rejects anything else, which fails the whole sync")
```

Ledger ids need no such care: `createWithGeneratedId` mints `UUID().uuidString.lowercased()`, so they are uuids by construction.

---

## What stays as it is

- **The server.** `listOwnedMessages` filters by id and `fk`, never by visibility, so the query is untouched. Ownership-scoped delivery, the `updatedAfter`/tombstone rule and the uuid guard on foreign-key groups all keep working.
- **`preownedServiceResources` and `declaredOwnershipFingerprint`.**
- **The cursor-invalidation rule**, and its reasoning is unchanged on both sources: ownership earned at create time cannot predate the cursor (a message cannot address a record that did not exist yet), and ownership earned by *receiving* a private row only entitles you to that row's own later updates. Only the externally-declared set can expose rows older than the cursor, which is why that alone is fingerprinted. This holds while no private resource is a message target — true today because `Message.service`/`Message.resource` are uuid columns while core resources are addressed by name, so a message can only point at an external service resource, and those are public. **If a private external-service resource ever becomes a message target, receiving it must void the cursor.** Write that next to the fingerprint.

---

## File map

### Contract and server

| File | Change |
|---|---|
| [`types/schema/data/data.schema.json`](../../types/schema/data/data.schema.json) | `DATA_EVY_Message.visibility.default` → `"private"`, matching `DATA_EVY_Address`. This feeds the generated Drizzle column default, so it needs a migration (below). |
| `types/generated/**` | Regenerated by `bun run types:generate` — never hand-edited. |
| [`api/src/data/resources/messages.ts`](../../api/src/data/resources/messages.ts) | Add `visibility: "private"` to the `makeCoreResource` config, exactly as [`addresses.ts`](../../api/src/data/resources/addresses.ts) does. This is what defaults an omitted `visibility` on create. |
| `api/drizzle/0004_*.sql` | **New**, from `bun run --cwd api db:generate`: the column default change, plus a hand-added backfill (precedent: `0001_backfill_flow_submits.sql`). Without the backfill, existing rows stay public and belong to nobody. |
| [`scripts/seed.ts`](../../scripts/seed.ts) | `buildMessageRows` hardcodes `visibility: "public"` (~line 363) → `"private"`, or mirror `buildAddressRows` and honour an explicit fixture value with a `"private"` fallback. |
| [`api/src/tests/data.test.ts`](../../api/src/tests/data.test.ts) | ~line 524 asserts a created message is `"public"` → `"private"`. |

### iOS

| File | Change |
|---|---|
| [`ios/evy/Core/EVY+Ownership.swift`](../../ios/evy/Core/EVY+Ownership.swift) | Add the `EVYOwnershipLedger` (below). `recordOwnership` writes to it instead of `ownedStore`. `ownedServiceResources()` unions the ledger, the private store's service-namespaced rows, and the launch override. Replace the doc comment about why the ledger needed its own store. **No new file, so no `project.pbxproj` change** — this file is already registered. |
| [`ios/evy/EVY.swift`](../../ios/evy/EVY.swift) | Delete `static let ownedStore`. The ledger lives in `UserDefaults` alongside `EVYSyncState`, which is the pattern it follows. |
| [`ios/evy/Core/EVY+Mutations.swift`](../../ios/evy/Core/EVY+Mutations.swift) | **No change.** The `recordOwnership(...)` call in `createWithGeneratedId` stays; only its storage changes. |
| [`ios/evyTests/EVYStoreRoutingTests.swift`](../../ios/evyTests/EVYStoreRoutingTests.swift) | Swap `EVY.ownedStore.wipeAll()` in `setUp`/`tearDown` for `EVYOwnershipLedger.reset()`. The three `recordOwnership` tests survive as-is. `testSyncedRecordsAreNotOwned` **splits in two** — a synced *private* record is now owned, a synced *public* one is not. Add the local-singleton test (step 10). |
| [`ios/evyTests/EVYTestMessageFixtures.swift`](../../ios/evyTests/EVYTestMessageFixtures.swift) | `visibility` → `"private"`. One edit that makes every message-seeding test realistic. |
| [`ios/evyTests/EVYActionRunnerTests.swift`](../../ios/evyTests/EVYActionRunnerTests.swift) | `statusByMessageId` (~line 1042) reads `EVY.publicStore`; private fixtures land in `privateStore`. Make it search `EVY.syncedStores()` so it stops encoding a storage decision, and do the same for the `publicStore.deleteAll` cleanups on the messages resource. `testSwipeLeftUpdateActionAcceptsPendingMessageFromFormattedSearchResult` (~line 1517) writes via `EVY.publicStore.applySyncedValue` (the store method, bypassing visibility routing) so it keeps passing — switch it to `EVY.applySyncedValue` so it exercises the real path. |
| [`ios/evyTests/interpreterTests.swift`](../../ios/evyTests/interpreterTests.swift) | Its `store(_:at:)` helper writes straight to `publicStore`, so the message expression tests are unaffected. No change expected — confirm by running them. |

Nothing changes in `web/` (it treats `visibility` as an ordinary field and never reads messages) or in the marketplace service.

### The ledger

Goes in `EVY+Ownership.swift`, ~35 lines, no SwiftData:

```swift
/// Records this device created, as `(service, resource, id)`.
///
/// A created record is owned however it is stored - a marketplace item is public
/// so every device can see the catalogue, and its seller still has to own it to
/// receive messages about it. `visibility` cannot express that, so it is recorded
/// here. Kept in `UserDefaults` beside the sync cursor: it is a small set of ids,
/// not queryable data, so an `EVYDataStore` would be a container, a schema and a
/// migration surface for no gain.
enum EVYOwnershipLedger {
  private static let key = "ownedRecords"

  private struct Entry: Codable, Hashable {
    let service: String
    let resource: String
    let id: String
  }

  private static var entries: Set<Entry> {
    get {
      guard let data = UserDefaults.standard.data(forKey: key),
        let decoded = try? JSONDecoder().decode(Set<Entry>.self, from: data)
      else { return [] }
      return decoded
    }
    set {
      guard let data = try? JSONEncoder().encode(newValue) else { return }
      UserDefaults.standard.set(data, forKey: key)
    }
  }

  static func record(service: String, resource: String, id: String) {
    entries.insert(Entry(service: service, resource: resource, id: id))
  }

  /// Ids by (service, resource), for merging with the other ownership sources.
  static func grouped() -> [(service: String, resource: String, ids: [String])] { … }

  // used by tests
  static func reset() {
    UserDefaults.standard.removeObject(forKey: key)
  }
}
```

`entries.insert` on a computed property reads, mutates and writes back — correct, and fine at this size. Deduplication comes free from `Set`, so `record` stays idempotent exactly as the current `upsert` is.

### Docs

| File | Change |
|---|---|
| [`docs/evy/data.md`](../evy/data.md) | **Visibility** section (~line 142): the private store is also part of the device's ownership set for sync, and `private` still means "every device stores this privately", not "mine". **`sync` in practice** paragraph: ownership is the union of created records, private rows and the launch override. **DATA_EVY_Message** section: messages are private, and receipt confers ownership. |

---

## Steps

Branch off the current one: `git checkout -b feat/private-store-ownership`.

Bring the stack up once — the iOS unit tests fire real RPCs and the migration needs a database: `docker compose up -d --wait`.

### Phase 1 — messages become private

1. Edit [`data.schema.json`](../../types/schema/data/data.schema.json): `DATA_EVY_Message.visibility.default` → `"private"`.
2. Run `bun run types:generate`. Confirm the generated `message` table now reads `visibility: visibilityEnum("visibility").notNull().default("private")`.
3. Add `visibility: "private"` to the `makeCoreResource` config in [`messages.ts`](../../api/src/data/resources/messages.ts).
4. Change the message `visibility` assertion in [`data.test.ts`](../../api/src/tests/data.test.ts) to `"private"`, and `buildMessageRows` in [`seed.ts`](../../scripts/seed.ts) to `"private"`.
5. Run `bun run --cwd api test:unit` and `bun test scripts/`. Green.
6. Generate the migration: `bun run --cwd api db:generate`. Inspect the emitted `api/drizzle/0004_*.sql` — it should only alter the `Message.visibility` default. Append the backfill by hand:

   ```sql
   --> statement-breakpoint
   UPDATE "Message" SET visibility = 'private', updated_at = … WHERE visibility = 'public';
   ```

   Bumping `updated_at` is what makes an entitled device re-receive the row and move it from its public store to its private one. Match the timestamp format the rest of the codebase writes (ISO 8601 text) — check how `0001_backfill_flow_submits.sql` handled timestamps and follow it.
7. Apply and reseed: `bun run --cwd api db:migrate`, then `bun run db:seed`. Confirm with
   `docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_EVY_DATABASE" -c 'SELECT DISTINCT visibility FROM "Message";'` → only `private`.
8. Commit: `[FEAT] Messages are private records`.

### Phase 2 — the ledger replaces the owned store (test first)

9. Update the ownership tests in [`EVYStoreRoutingTests.swift`](../../ios/evyTests/EVYStoreRoutingTests.swift) to reference `EVYOwnershipLedger.reset()` in `setUp`/`tearDown` instead of `EVY.ownedStore.wipeAll()`. The three `recordOwnership` tests (grouping, idempotency, create-records-ownership) keep their assertions unchanged — that is the point of keeping the ledger.
10. Add the new cases in the same file:
    - a synced **private** record is owned — seed via `EVY.applySyncedValue` with `visibility: "private"`, assert its `(service, resource, id)` appears;
    - a synced **public** record is **not** owned (the surviving half of `testSyncedRecordsAreNotOwned`);
    - **a `$local:` singleton in the private store is not declared** — write one the way `testLocalPrefixRoutesToPrivateDataStore` does, then assert `ownedServiceResources()` contains no `"current"` id and no `local` service. Write this before the implementation: it is the case that would otherwise put a non-uuid id in the request and take **all** sync down with it;
    - a created **public** record is still owned (the ledger doing its job) — this is the seller path, and it is worth an explicit test rather than leaning on `testCreateRecordsOwnershipOfTheNewRecord`, whose scratch resource happens to be public already.
11. Run `-only-testing:evyTests/EVYStoreRoutingTests`. Expect compilation to fail on `EVYOwnershipLedger` not existing — that is the red step.
12. Implement `EVYOwnershipLedger` in [`EVY+Ownership.swift`](../../ios/evy/Core/EVY+Ownership.swift) as sketched above, and point `recordOwnership` at it:

    ```swift
    static func recordOwnership(service: String, resource: String, id: String) {
      EVYOwnershipLedger.record(service: service, resource: resource, id: id)
    }
    ```

    Keep it a thin named seam so [`EVY+Mutations.swift`](../../ios/evy/Core/EVY+Mutations.swift) needs no edit, or inline it at the call site if you prefer one less hop — either is fine, but do not change the create path's behaviour.
13. Rewrite `ownedServiceResources()` to union the three sources into the existing `[OwnedServiceResourceKey: Set<String>]` accumulator: ledger entries, private-store rows whose namespace is service-namespaced, then `preownedServiceResources`. Add the debug assertion from the malformed-ids section where the array is built. Keep the existing sort so an unchanged ownership set produces an identical payload between syncs.

    ```swift
    for row in (try? privateStore.getAll()) ?? [] where isSyncedNamespace(row.namespace) {
      idsByKey[.init(service: row.namespace, resource: row.resource), default: []]
        .insert(row.id)
    }
    ```

    with

    ```swift
    /// Local singletons and scratch scopes share the private store but are not
    /// records the server knows, so they are not ownership candidates.
    private static func isSyncedNamespace(_ namespace: String) -> Bool {
      namespace != EVYNamespace.local
        && namespace != EVYNamespace.cache
        && namespace != EVYNamespace.draft
    }
    ```
14. Delete `static let ownedStore` from [`EVY.swift`](../../ios/evy/EVY.swift).
15. Flip `visibility` to `"private"` in [`EVYTestMessageFixtures.swift`](../../ios/evyTests/EVYTestMessageFixtures.swift), and fix the two spots in [`EVYActionRunnerTests.swift`](../../ios/evyTests/EVYActionRunnerTests.swift) named in the file map.
16. Build and run the whole `evyTests` target (iPhone 17 / iOS 26.5). All green. If a message test fails on a store lookup, it is reading `publicStore` directly — point it at `syncedStores()` rather than at `privateStore`, so it stops encoding a storage decision.
17. Commit: `[REFACTOR] Replace the owned store with a created-records ledger`.

### Phase 3 — verify end to end

18. Reseed and reset the device so no pre-change public message rows are left behind: `bun run db:seed`, then `xcrun simctl erase <udid>`. **Not optional** — see the upgrade risk below.
19. Run `./run-e2e.sh --skip-ios` from the repo root. API, marketplace and web must pass.
20. Run the iOS e2e separately against the running stack on the freshly erased simulator: `xcodebuild test … -only-testing:evyUITests -parallel-testing-enabled NO`. Watch `E2EHomepageMessageSearchTests`: it reaches the seeded messages through the item declared by its `ownedServiceResources` override. If it fails, check the seeded messages are `private` in the database (step 7) before suspecting the client.
21. Manually confirm the round trip: Home → an item → Pickup → a timeslot → **Request**. No error alert, and the row lands in Postgres with `visibility = 'private'`:

    ```bash
    docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_EVY_DATABASE" -c 'SELECT id, fk, visibility FROM "Message" ORDER BY created_at DESC LIMIT 3;'
    ```

    Relaunch the app and confirm the message is still there — that is created → private → owned → still synced.
22. Also confirm the ledger survives a relaunch, since it moved storage: create an item through "Sell something", relaunch, and check the sync request still declares it. The cheapest check is a breakpoint or a temporary log on `ownedServiceResources()`; do not leave the log in.
23. Update the docs per the file map and run `bun run format` from the repo root.
24. Commit: `[FEAT] Document ownership from the private store and the created-records ledger`.
25. Open the PR: title `[REFACTOR] Ownership is created records plus what the device holds privately`. The body must cover the summary, both ownership sources and what each is for, why `visibility` cannot express created-record ownership, the migration plus backfill, the reinstall requirement from step 18, and every test run.

---

## Risks

- **Sync-killing ids.** A malformed id fails the whole request, and by decision there is no filter to catch it. The `$local:` test in step 10 and the debug assertion in step 13 are the guards; the namespace scoping is what actually prevents it.
- **Mixed stores on an existing install.** A device already holding public messages will not re-receive them (it does not own them, so sync will not send them), and `namespace(forSyncedResource: "messages")` checks the public store first — so `{messages}` resolves to the stale public collection and the private rows are invisible. Step 18's erase covers it, but the symptom looks nothing like the cause. If it becomes a recurring nuisance, the fix is a one-time launch migration moving `messages` rows from `publicStore` to `privateStore`; deliberately not in this plan, as there are no production installs.
- **Both ownership sets grow without bound.** The ledger gains an entry per created record forever (there is no delete mutation on iOS to prune it), and the private-store source now declares every private row ever received, including other devices' seeded addresses. Core-named groups are inert server-side — the uuid guard in `listOwnedMessages` drops them — so this is wasted payload rather than a correctness problem. `UserDefaults` is a plist; a few thousand short strings is tens of KB and fine, but it is not the right home if this ever becomes large.
- **Two sources for one question.** Anyone reading `ownedServiceResources()` will wonder why ownership comes from two places. The table at the top of this plan is the answer, and it belongs in the code comment too — otherwise the next person deletes the one that has no failing test behind it.
