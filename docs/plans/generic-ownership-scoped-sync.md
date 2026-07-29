# Ownership-scoped sync for every resource

Today only `messages` are ownership-scoped. Every other resource is pulled wholesale, so a `private` row still reaches every device — `visibility` decides which iOS store a row lands in and nothing else.

This makes the rule generic and gives `private` its plain meaning:

- **public rows sync to every device**, as now;
- **private rows sync only to the device that owns them** — plus, for messages, the device that owns the record the message addresses;
- ownership stays where it already is: on-device, in the created-records ledger and the private store, declared per sync via `ownedServiceResources`. Nothing is stored on the resource and nothing new goes over the API.

`Device` also becomes private. **Addresses stay private**, which is only possible after Phase 0.

The wire contract does not change: the request already carries owned ids per service resource, which is exactly what the generic rule needs.

---

## Why Phase 0 has to come first

The shipped item page renders its pickup location out of the **private** `addresses` collection, from a **public** item:

```jsonc
// Map row on the view-item page
"source":   "{findFirst(addresses, dc28ed59-….transfer_options.pickup.address_id)}",
"subtitle": "{formatAddress(findFirst(addresses, dc28ed59-….transfer_options.pickup.address_id))}"
```

That works today only because private rows still reach everyone. The moment private means owner-only, the seeded items — which point at seeded addresses (`12401f50…` → `c81e85dd…`, `760eac03…` → `9d04047d…`) that **no device owns** — lose their location entirely, and a buyer viewing a real seller's item loses it too.

**No test would catch it.** `E2EPlaceSearchTests` only asserts the address the device just created and therefore owns; nothing asserts a seeded item's address. The suite would stay green while the page quietly rendered less.

So Phase 0 copies the three fields the public page actually needs — `postcode`, `latitude`, `longitude` — onto `transfer_options.pickup` beside `address_id`. The public item then carries everything the map and the location line need, the private address record is no longer read by anyone but its owner, and Phases 1-4 become safe.

**One honest note on what this does and does not buy.** It decouples the public page from the private record. It does *not* hide the location: a marker at exact coordinates gives away as much as the street line did. If hiding is also wanted, coarsen the stored coordinates (round to ~3 decimal places, or store the suburb centroid) — that is a one-line change in the same write action, and worth deciding now rather than after the data exists. What genuinely stops being public is the **unit and street**, which is the part an address record should keep.

---

## What the model covers, and what it does not

- **Core resources with a `visibility` column** — all of them get the rule for free. In practice only `messages` and `addresses` are private, so the behaviour change is small; the *rule* is what becomes general.
- **`formatters`** — no `visibility` column, so nothing to filter: always synced. The query must handle a table without the column rather than assume one.
- **`devices`** — becomes private, but is not in `CORE_RESOURCE_REGISTRY` and so is not readable through the core `get` at all. It stays excluded from the sync loop; only the *reason* changes, and the comment should say so ("not served by the core read API" rather than "handled outside the loop").
- **External service resources** (marketplace items and friends) — their payloads have no `visibility` and the gateway forwards them without inspecting them, so they are public by construction and reach every device. The rule applies to every resource that *has* a visibility. If a service ever needs private rows, it declares and filters them itself; the gateway should not start reading service payloads.
- **The `get` RPC stays unscoped.** It has no ownership input and the e2e harness uses it to assert raw server state. Sync is the only path that populates a device, so scoping sync is what changes behaviour. Worth one line in the docs so nobody reads `get` as an access boundary.
- **Web** sends no `ownedServiceResources` and reads only public SDUI, so it is unaffected. A builder user who ever made a flow private would stop seeing it — note it, do not solve it.

---

## Entitlement and the cursor

The cursor means "you have seen everything up to here, for what you were entitled to". Widening the rule keeps the existing invariants, and each still needs to hold:

- **Ownership earned at create time** cannot expose anything older than the cursor — the record did not exist before it.
- **Ownership from a received private row** entitles you only to that row's own later updates.
- **The launch override** can expose older rows, which is why it alone is fingerprinted and voids the cursor. Unchanged.

One hazard is new and belongs in a comment next to the query: **a row that flips public → private**. Sync only sends rows matching the filter, so a device that already holds it never hears again and keeps a stale copy — there is no tombstone for "you lost access". Nothing changes visibility after creation today, so this is latent, not live. If it ever becomes possible, the flip has to emit a tombstone-like signal to non-owners.

---

## File map

### Phase 0 — the public item carries its own location

| File | Change |
|---|---|
| [`services/marketplace/src/schema/item.schema.json`](../../services/marketplace/src/schema/item.schema.json) | `transfer_options.pickup` gains `postcode` (string), `latitude` (number), `longitude` (number). **Required**, because `pickup` is `additionalProperties: false` — without the schema change every write is rejected. Name them to match the address record they are copied from (`postcode`, not `postal_code`); `ship.postal_code` and the shipping message's `postalcode` already spell it differently, and this plan does not touch either. |
| [`scripts/fixtures/services/service_sdui.json`](../../scripts/fixtures/services/service_sdui.json) | The one `draft`-mode update that writes `transfer_options.pickup.address_id` gains the three fields (see step 3). The Map row's `source` and `subtitle` stop reading `addresses` and read the item instead. |
| [`scripts/fixtures/services/service_data.json`](../../scripts/fixtures/services/service_data.json) | Both seeded items gain the three fields on `transfer_options.pickup`, copied from the address each already links to — `c81e85dd…` is postcode `2018`, lat `-33.9172075`, long `151.1985883`; `9d04047d…` is `2000`, `-33.867787`, `151.209503`. Copy, do not invent: a mismatch here is the drift this denormalization risks. |
| [`scripts/shipped-fixture-action-branches.test.ts`](../../scripts/shipped-fixture-action-branches.test.ts) | New guard: any action writing `transfer_options.pickup.address_id` must also write the three location fields. This is what stops the copy silently going missing later — the failure mode is a page that renders less, which nothing else catches. |
| [`ios/e2e/e2e.swift`](../../ios/e2e/e2e.swift) | `E2EPlaceSearchTests` asserts the pickup subtitle contains `NSW` or `Australia` (~line 3904). The subtitle becomes the postcode, so that assertion becomes the postcode the place-search mock returns (`2018`, from `ROTHCHILD_CANONICAL_ADDRESS`). |

The Map row needs no iOS change: `EVYMap` reads `latitude`/`longitude` off whatever dictionary it is bound to (`EVYJson.locationCoordinate()`), so `{<item>.transfer_options.pickup}` works as a source once those fields exist.

`formatAddress` cannot be reused for the new subtitle — it is a dynamic formatter over `unit`/`street`/`city`/`state`/`postcode` keyed on `country` ([standardFormatters.ts](../../types/standardFormatters.ts)) — and that is the point: the street is what stops being public. The subtitle becomes the bare postcode. No new formatter; if the design wants "Rosebery NSW 2018" later, that needs `city`/`state` copied too, which is a product decision, not a mechanical one.

`delivery` and `ship` carry no `address_id` today (`delivery` is selection + fee, `ship` is postal_code + areas), so there is nothing to denormalize for them. If either gains an address later, the same three fields go with it — and the guard test should grow to cover it.

### Phases 1-4 — the generic rule

| File | Change |
|---|---|
| [`api/src/data/resources/coreResource.ts`](../../api/src/data/resources/coreResource.ts) | Add `listForSync(db, scope)` to what `makeCoreResource` returns, so every resource gets the rule. Export a small `syncEntitlementClause(table, ownedIds)` for the two resources that build their own query. Widen `ResourceTable` with an optional `visibility` column so the no-visibility case (`formatters`) is expressible rather than cast around. |
| [`api/src/data/resources/messages.ts`](../../api/src/data/resources/messages.ts) | Replace `listOwnedMessages` with a `listForSync` that is the generic clause **or** the fk-recipient clause, and override it onto `messagesResource`. The uuid guard on foreign-key groups stays exactly as is — `Message.service`/`resource` are uuid columns and a core resource name would make Postgres throw on the cast. |
| [`api/src/data/resources/files.ts`](../../api/src/data/resources/files.ts) | `listFileRows` is hand-written rather than from `makeCoreResource`, so add a matching `listFilesForSync` using the shared clause. Files are public, so this is the rule applying uniformly, not a behaviour change. |
| [`api/src/data/data.ts`](../../api/src/data/data.ts) | `CoreResourceOps` gains `listForSync`. Replace `getOwnedMessages` with `getSyncRows(db, resource, scope)` dispatching through the registry. Registry entries that pick fields explicitly (`services`, `organisations`, `providers`, `files`) must add `listForSync` or they silently lose sync. |
| [`api/src/procedures/sync.ts`](../../api/src/procedures/sync.ts) | Messages rejoin `coreResourceRefs()`. `splitOwnedServiceResources` becomes "owned ids per core resource + foreign keys for other services". The core fetch calls `data.getSyncRows`. `MESSAGES_REF` and `ownsAnything` go away — the messages special case disappears into the general path. |
| [`types/schema/resources/core.resources.json`](../../types/schema/resources/core.resources.json) | `devices.visibility` → `"private"`. Addresses stay `"private"`. |
| [`api/src/data/resources/devices.ts`](../../api/src/data/resources/devices.ts) | The insert states `visibility: "private"`. |

### Tests and docs

| File | Change |
|---|---|
| [`api/src/tests/data.test.ts`](../../api/src/tests/data.test.ts) | The `getOwnedMessages` block becomes `getSyncRows`, and gains the generic cases: a public row reaches a device that owns nothing; a private row does not; a private row you own does; a formatter (no visibility column) always does. |
| [`api/src/tests/sync.test.ts`](../../api/src/tests/sync.test.ts) | The `owned messages` block becomes `ownership-scoped rows`. Messages now come through the plain core loop, so `never reads messages through the plain core loop` inverts into an assertion that they are fetched with the right scope. |
| [`services/marketplace/src/tests/`](../../services/marketplace/src/tests) | An item payload with the three pickup fields round-trips; one with an unknown pickup key is still rejected (proving `additionalProperties: false` still bites). |
| [`ios/evyTests/`](../../ios/evyTests) | Addresses stay private, so locally created ones keep landing in `privateStore`. The action-runner tests already read through `EVY.syncedStores()` — confirm rather than assume. |
| [`docs/evy/data.md`](../evy/data.md) | **Visibility**: `private` now means "synced only to the owner", not just a store choice. **`sync` in practice**: the rule is general, messages add the fk recipient, external resources are public by construction, `get` is not an access boundary. **DATA_EVY_Message**: messages stop being the exception. |
| [`docs/services/marketplace/data.md`](../services/marketplace/data.md) | `transfer_options.pickup` carries the public location fields, and why: the item is public and the address it links to is not. |

---

## Steps

Branch off the current one: `git checkout -b feat/generic-ownership-sync`.

Stack up once: `docker compose up -d --wait`.

### Phase 0 — the public item carries its own location

1. Write the failing marketplace test in [`services/marketplace/src/tests/data.test.ts`](../../services/marketplace/src/tests): creating an item whose `transfer_options.pickup` has `address_id`, `postcode`, `latitude` and `longitude` round-trips all four; an unknown key under `pickup` is still rejected.
2. Run `bun run --cwd services/marketplace test:unit`; confirm the first case fails on `additionalProperties`.
3. Add the three properties to `transfer_options.pickup` in [`item.schema.json`](../../services/marketplace/src/schema/item.schema.json) (`postcode` string, `latitude`/`longitude` number). Re-run; green.
4. Update the shipped fixture's write site — the `draft`-mode update on the items resource:

   ```jsonc
   "changes": {
     "transfer_options.pickup.address_id": "pickup_address.id",
     "transfer_options.pickup.postcode":   "pickup_address.postcode",
     "transfer_options.pickup.latitude":   "pickup_address.latitude",
     "transfer_options.pickup.longitude":  "pickup_address.longitude"
   }
   ```

   Written in the same action as `address_id`, so the copy and the link always move together.
5. Update the Map row in the same fixture — both occurrences:

   ```jsonc
   "source":   "{dc28ed59-….transfer_options.pickup}",
   "subtitle": "{dc28ed59-….transfer_options.pickup.postcode}"
   ```

   Leave the `{length(….address_id) == 0}` / `> 0` visibility expressions alone: `address_id` is still written and still on the public item, so they keep working for buyer and seller alike.
6. Add the three fields to both seeded items in [`service_data.json`](../../scripts/fixtures/services/service_data.json), copying from the address each links to (values in the file map above).
7. Add the guard test to [`shipped-fixture-action-branches.test.ts`](../../scripts/shipped-fixture-action-branches.test.ts): every action writing `transfer_options.pickup.address_id` also writes `postcode`, `latitude` and `longitude`. Verify it catches a regression by temporarily removing one field from the fixture.
8. Update the `E2EPlaceSearchTests` subtitle assertion in [`e2e.swift`](../../ios/e2e/e2e.swift) from `NSW`/`Australia` to the postcode the mock returns (`2018`).
9. Reseed, then check by hand on a fresh device that a **seeded** item page still shows a map pin and the postcode: `bun run db:seed`, erase the simulator, launch, open an item. This is the check that no automated test makes.
10. Run `bun run --cwd services/marketplace test:unit`, `bun test scripts/`, `bun run --cwd api test:unit`, `bun run format`.
11. Commit: `[FEAT] Public items carry their own pickup location`.

    Note there is a second write site the guard test cannot see: `createItemWithAddressFlowData` in [`e2e.swift`](../../ios/e2e/e2e.swift) (~line 573) writes `address_id` through a create `idDestination`. That test is about draft scope and asserts nothing about the map, so leave it — but know it produces an item with a link and no copy, which is exactly the shape the guard exists to prevent in shipped fixtures.

### Phase 1 — the generic entitlement clause (test first)

12. Write the failing tests in [`api/src/tests/data.test.ts`](../../api/src/tests/data.test.ts). Rename the `getOwnedMessages` describe to `getSyncRows` and, reusing its `owns()` / `ownedIds()` helpers, cover:
    - a **public** row of any resource reaches a device that owns nothing;
    - a **private** row does **not**;
    - a **private** row **does** reach the device that declares its id;
    - a `formatters` row (no `visibility` column) reaches everyone, proving the query does not assume the column;
    - every existing message case still holds: created-id, fk-recipient, the union, `updatedAfter` exclusion, tombstones on an incremental read, and the non-uuid group being ignored.
13. Run `bun run --cwd api test:unit`; confirm the new cases fail on the missing export.
14. Implement in [`coreResource.ts`](../../api/src/data/resources/coreResource.ts):

    ```ts
    export type SyncScope = {
      updatedAfter?: string;
      /** Ids of this resource's records the calling device declared as owned. */
      ownedIds: string[];
    };

    /**
     * What this device may see of a resource: everything public, plus the private
     * rows it owns. A table with no visibility column has nothing to scope.
     */
    export function syncEntitlementClause(
      table: ResourceTable,
      ownedIds: string[],
    ): SQL | undefined {
      if (!table.visibility) return undefined;
      const owned = ownedIds.length > 0 ? inArray(table.id, ownedIds) : undefined;
      return or(eq(table.visibility, "public"), owned);
    }
    ```

    and add `listForSync` alongside `list`, combining that clause with the existing time clause — `gt(updatedAt, updatedAfter)` when incremental, `isNull(deletedAt)` otherwise. Keep `orderBy(asc(updatedAt), asc(id))` and the same `norm` + `validateGetResponse` mapping, so a synced row is shaped exactly like a `get` row.

    **Tombstones matter here:** an owner must keep receiving the tombstone for a private row they own, or they can never learn it was deleted. The clause is on visibility and id, both of which survive a soft delete — but assert it (step 12 covers it).
15. Re-run the tests. Green.
16. Commit: `[FEAT] Entitlement clause for ownership-scoped reads`.

### Phase 2 — every resource uses it

17. Give [`messages.ts`](../../api/src/data/resources/messages.ts) a `listForSync` that ORs `syncEntitlementClause` with the existing foreign-key clause, and attach it:

    ```ts
    export const messagesResource = {
      ...makeCoreResource<DATA_EVY_Message>({ … }),
      listForSync: listMessagesForSync,
    };
    ```

    Keep the fk-group uuid guard and its comment verbatim. Delete `listOwnedMessages` and `OwnedMessagesParams`; the scope type now comes from `coreResource.ts` plus the foreign keys.
18. Add `listFilesForSync` to [`files.ts`](../../api/src/data/resources/files.ts) using the shared clause, mirroring `listFileRows`' time handling.
19. In [`data.ts`](../../api/src/data/data.ts): add `listForSync` to `CoreResourceOps`, wire it into every registry entry (including the four that pick fields explicitly), and replace `getOwnedMessages` with `getSyncRows(db, resource, scope)`. A resource missing `listForSync` should throw with a message naming it — a resource silently dropping out of sync is the failure mode to avoid.
20. Add a test that iterates the registry and asserts every entry has a `listForSync`. Ten entries means nine chances to forget one, and the symptom is silent.
21. Run `bun run --cwd api test:unit` and `bun run --cwd api build`. Green.
22. Commit: `[FEAT] Every core resource reads through the entitlement clause`.

### Phase 3 — sync applies it generically

23. Write the failing tests in [`api/src/tests/sync.test.ts`](../../api/src/tests/sync.test.ts). Rework the `owned messages` describe into `ownership-scoped rows`, spying on `data.getSyncRows`, and cover:
    - every core resource is fetched with the ownership scope, and a resource's owned ids reach the call for **that** resource only;
    - foreign-key groups (non-core services) are passed through for the messages recipient rule;
    - messages now come through the plain core loop — invert `never reads messages through the plain core loop` into an assertion that they are fetched with the right scope;
    - a resource whose read throws still degrades to an `errors` entry and holds the cursor.
24. Run them; confirm they fail.
25. Implement in [`sync.ts`](../../api/src/procedures/sync.ts): put `MESSAGES` back in `coreResourceRefs()` and update its doc comment — `devices` is excluded because it is not served by the core read API, `resources` because it is the catalog singleton. Replace `splitOwnedServiceResources` with one returning `{ coreIdsByResource: Map<string, string[]>, foreignKeys: OwnedServiceResource[] }`, and have the core `fetchResources` call `data.getSyncRows(db, ref.resource, …)`. Delete `MESSAGES_REF` and `ownsAnything`.
26. Re-run the API tests. Green.
27. Commit: `[FEAT] Sync scopes every resource by declared ownership`.

### Phase 4 — devices private

28. Set `devices.visibility` to `"private"` in [`core.resources.json`](../../types/schema/resources/core.resources.json), run `bun run types:generate`, and set `visibility: "private"` on the insert in [`devices.ts`](../../api/src/data/resources/devices.ts).
29. No migration: no column default exists to change and `visibility` is per row. Reseed and confirm:
    `docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_EVY_DATABASE" -c 'SELECT DISTINCT visibility FROM "Device";'`
30. Run `bun run --cwd api test:unit` and `bun test scripts/`. Green.
31. Commit: `[FEAT] Devices are private`.

### Phase 5 — verify the rule end to end

32. Prove the scoping at the wire, not only in tests, the way the visibility contract was proven: a scratchpad script that logs in, syncs with **no** `ownedServiceResources` and asserts the response carries public rows and **no** private ones, then syncs declaring a private row's id and asserts that row appears. Keep it out of the repo.
33. Run the iOS unit tests (iPhone 17 / iOS 26.5).
34. Run `./run-e2e.sh --skip-ios` from the repo root.
35. Run the iOS e2e separately on a freshly erased simulator with the stack seeded. Watch `E2EHomepageMessageSearchTests` (its seeded messages still arrive through the item declared by its `ownedServiceResources` override) and `E2EPlaceSearchTests` (creates its own address, so it owns it either way — and note it is a known intermittent; re-run it in isolation before calling it a regression).
36. Re-check by hand on a fresh device: a seeded item page shows the map and postcode, and shows **no** street address. That is the whole point of the change and nothing automated asserts the absence.
37. Update the docs per the file map, run `bun run format`, commit: `[FEAT] Document ownership-scoped sync for every resource`.
38. Open the PR: title `[FEAT] Private rows sync only to their owner`. The body must cover Phase 0 and why it comes first (with the item-page evidence), the general rule, devices becoming private, what the model does not cover (external services, `get`), the coordinate-precision note, and every test run.

---

## Risks

- **The silent break.** Making a resource private removes rows from other devices with no error anywhere — the app just renders less. Phase 0 removes the one instance we know of; the general lesson belongs in the docs, because the next person to flip a resource to private needs to ask who reads it. Steps 9, 32 and 36 are the only checks that would catch it.
- **Two copies of the location.** Denormalizing accepts drift as the price of decoupling. Mitigated by writing the copy in the same action as `address_id` and by the guard test — but an edit path that touches the address record alone will not update the item, and today's `instructions`-only update is exactly that shape (harmless, since it touches no location field). Anything that later edits postcode or coordinates on an address must update the linked items too.
- **A resource dropped from sync by omission.** Step 20's registry test is the guard; without it the symptom is one resource quietly never syncing.
- **Visibility flips have no tombstone.** Public → private leaves stale copies on devices that already synced. Latent today; document next to the clause.
- **The reinstall gap widens.** Ownership lives only on the device, so a reinstall loses the claim to *every* private resource, not just messages. Same root cause and resolution as before — auth — but the blast radius grows with each resource that becomes private.
- **Ownership payload growth.** Every private row a device holds is declared on every sync. Fine while private means messages and your own addresses; worth watching if that set grows.
