Data
====

# Types used to generate code for all platforms

## Core types

```
uuid
string
enum
integer
number
boolean
date-time (string)
```

---

## Sources

All `types/schema/**/*.schema.json` files define types for UI flows, RPC, and data models.

`types/schema/sdui/definitions/*.schema.json` files define SDUI row definitions, including row-specific content and view keys.

`types/schema/data/drizzle.config.json` defines the database schema configuration for generated Drizzle tables. Keep it manually in sync with `types/schema/data/data.schema.json`, with AI assistance when useful.

## Command

Run type generation after changing schemas, row definitions, or Drizzle database configuration so TypeScript, Swift, Drizzle, and core resource outputs stay aligned with the source definitions.

From the repo root:

```bash
bun run types:generate
```

`bun run types:generate` runs:

1. `scripts/generate-types.ts` — Emits TypeScript under `types/generated/ts/` and Swift under `types/generated/swift/` from `*.schema.json`. It generates stable Swift filenames from nested and hyphenated schema paths, includes `types/schema/files/file.schema.json`, and runs `scripts/generate-swift-sdui.ts` for Swift UI shapes from `evy.schema.json` plus `types/schema/sdui/definitions/*.schema.json`.
2. `scripts/generate-drizzle.ts` — Emits `types/generated/ts/db/schema.generated.ts` from `data.schema.json` and `drizzle.config.json`. Every `DATA_EVY_*` `$def` must have a table entry in `drizzle.config.json`, or be listed there under `nonTableDefs` if it is a nested value object with no table of its own; otherwise generation fails.
3. `scripts/generate-core-resources.ts` — Emits generated evy core resource compile-time constants for core API validation, sync's core-resource loop, and the core portion of the aggregated `resources` catalog.
4. `scripts/generate-procedures.ts` — Emits the RPC procedure registry from `types/schema/resources/procedures.json` (see [Procedures](#procedures)).

`scripts/generate-types.ts` additionally invokes `scripts/generate-sdui-definitions.ts`, which emits the embedded SDUI row schemas and trigger specs consumed by `validateUiFlow` and the web builder.

## Outputs (do not edit by hand)

- `types/generated/ts/` — TypeScript types, Drizzle schema, validators, RPC helpers, and generated evy core resource registry inputs. The API, web app, and marketplace service import these via the `evy-types` path alias.
- `types/generated/swift/` — Swift types. The iOS app references generated SDUI, core resource, OS, and file API models while keeping transport and UI models handwritten where needed.

After changing any schema, `drizzle.config.json`, or SDUI row definition schema, run `bun run types:generate`. Output under `types/generated/` is gitignored; regenerate locally and do not hand-edit generated files.

## Procedures

A procedure is an RPC call that runs code rather than reading or writing a resource — reached as `api{service, method, data}`, and written `{$api:<method>}` in a row source. `types/schema/resources/procedures.json` declares each one:

| Field | Meaning |
| --- | --- |
| `service` | The service slug that owns it (`evy`, `marketplace`, …). Core procedures run in the gateway; anything else is forwarded to that service. |
| `response` | Schema path, relative to `types/schema/`. The generator reads it for the result attributes the builder offers. Request and response are both validated at dispatch, but by handlers wired in code rather than from this file. |

The manifest is the single source of truth for which procedures exist:

- `api/src/procedures/coreApi.ts` refuses to load if its handlers and the registry disagree. A handler with no declaration is the dangerous direction — it would be reachable without a declared contract.
- `api/src/procedures/rpc.ts` will only forward a procedure to the service that declares it.
- The web builder offers a `{$api:<method>}` source's attributes from the registry, derived from the response schema at generation time. Only array-of-object responses have them; `sync` is callable but its envelope is not a bindable source.

Adding one means: write the request/response schemas, add the manifest entry naming the response, `bun run types:generate`, then implement the handler with its validation (in the gateway for a core procedure, or in the owning service).

---

# Data models

This document covers EVY shared data: schema-backed rows stored in the API database (source of truth: [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json)) and reusable value objects used across clients and services. Domain payloads for workers such as marketplace are documented under that service; they are not `DATA_EVY_*` rows in this schema.

## Wire contract vs persisted rows

Clients call the API with JSON-RPC `get`, `sync`, `resources`, `api`, `create`, `update`, and `delete` (see [`types/schema/rpc`](../../../types/schema/rpc)). `get`, `create`, `update`, and `delete` carry a single `resource` field holding a dotted reference (`evy.flows`, `marketplace.items`); `api` carries a `service` slug (`evy`, `marketplace`, …) because procedures route by service, not resource. `sync` and `resources` are top-level methods; `sync` is described on its own below. `resources` returns the aggregated service/resource catalog from the core manifest plus each registered external service's live `resources` RPC response. Resources whose ref prefix is `evy` are dispatched by the API into resource modules under [`api/src/data/resources`](../../../api/src/data/resources) and map to the row types below in the API Postgres schema. Any other prefix is forwarded to the owning service's adapter, which the API resolves from the core `services` table at startup. Each external service owns its resource manifest locally and exposes it through its required `resources` JSON-RPC method; the gateway aggregates those manifests and includes the full catalog on every successful sync as a singleton under the core `resources` key so clients can persist it offline.

Routing in practice: the API reads the service prefix from `resource` (`serviceOfRef`) and routes `evy.*` to core handlers; everything else goes to the matching external adapter.

**`sync` in practice:** Send back the opaque `cursor` from the previous response, or omit it for a full sync. Alongside
the cursor a client sends `owned_resources`: the record ids it owns, grouped by the dotted
resource ref they belong to. Every resource is read the same way: the device gets every public row,
plus the private rows it declared. A device that declares nothing still syncs — it just receives the
public rows only.

A device's ownership set is the union of three sources:

- **records it created**, kept in a small ledger of `(resource, id)` pairs. This is the
  only source that can claim a *public* record, and it is what keeps a seller entitled to messages
  about an item they listed. Anything created on the platform is owned by whoever created it.
- **records it holds privately**, so a private row that arrives stays owned and its later updates
  keep coming. Local singletons share that store but are excluded: they are not records the server
  knows, and their id is not a uuid — which the request schema rejects, failing the whole sync.
- **the `EVY_OWNED_RESOURCES` launch override**, standing in for the account-derived
  ownership that arrives with real auth. Changing that declaration voids the cursor — it makes
  records visible that may have changed long before the cursor was issued — so the client resyncs
  in full. The other two sources cannot: a created record has no messages older than itself, and a
  received private row only entitles the device to that row's own later updates. Nor can the
  response rule, for the same reason: a message cannot answer one that does not exist yet.

## Who validates what

The API validates the RPC envelope on every call, and the payload of every **core** resource against [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json). It does **not** look inside a service-owned payload: a forwarded `create` or `update` is checked for envelope shape, routed, and the owning service decides whether the body is acceptable. Service payload schemas therefore live in that service's own codebase — none of them belong in `types/`, which carries the shared EVY contract only. A service that skips validation is unvalidated end to end; there is no second line of defence in the gateway.

Resource manifests may declare an `attributes` list per resource: the dotted attribute paths that resource's rows can bind to (see [`types/schema/rpc/resources.response.schema.json`](../../../types/schema/rpc/resources.response.schema.json)). The builder uses these for id interpolation. The gateway passes them through untouched — the owning service is the only authority on what its rows contain, and declaring them from the same schema it validates against keeps the two from drifting. A service that declares nothing still works: the builder falls back to reading keys off whatever rows have synced.

## Common date-time fields

Tables that track updates use ISO 8601 / RFC 3339 strings (never numeric Unix timestamps):

- `created_at`: string (date-time)
- `updated_at`: string (date-time)

---

## Schema-backed row types (`DATA_EVY_*`)

Fields, types and which of them are required live in [`types/schema/data/data.schema.json`](../../types/schema/data/data.schema.json) and the generated TypeScript and Swift built from it. That is the reference; the notes below cover only what a schema does not explain — routing, references between records, and how a shape is represented on the wire. Hand-copied field lists here went stale as soon as a column was added.

These are defined in `types/schema/data/data.schema.json`. The API and generated Drizzle schema use them.

### DATA_EVY_Address

### DATA_EVY_Device

### DATA_EVY_Service

### DATA_EVY_Organization

### DATA_EVY_ServiceProvider

### DATA_EVY_Flow

Persisted flow shell. Clients assemble the nested [`UI_Flow`](sdui.md) shape from `flows`, `pages`, and `rows` at the serialization boundary.

On the wire this is accessed with `resource: "evy.flows"`.

### DATA_EVY_Page

Persisted page shell.

On the wire this is accessed with `resource: "evy.pages"`.

### DATA_EVY_Row

Persisted row record. Row-type-specific SDUI fields live in `data`. Nested row relationships are stored by UUID inside `data` and expanded back to nested `sheet`, `child`, and `children` when clients assemble [`UI_Flow`](sdui.md):

| Flat key | SDUI field | Ownership |
| --- | --- | --- |
| `sheet_row_id` | `sheet` | Optional on **every** row type — overlay content for `{show(rowId)}` |
| `child_row_id` | `child` | One result-row template (not a sheet), for example for search row |
| `children_row_ids` | `children` | Container rows with static nested children |

Action branches in `data.actions` are stored as expression strings (`""` or `{fn(…)}`), not
structured objects — see [actions.md](./actions.md) and
[`types/grammar/README.md`](../../types/grammar/README.md).

A Search row may persist both `child_row_id` and `sheet_row_id`. Relationship kind is explicit in storage; do not infer it from row type alone beyond the Search-only rule for `child`.

On the wire this is accessed with `resource: "evy.rows"`.

### DATA_EVY_Transaction

Record of money movement for a marketplace item (`fk` + `resource`). Each payment is an append-only lifecycle ledger: `type` is one of `charge`, `transfer`, or `withdraw`; `status` is one of `intent`, `initiated`, `succeeded`, `failed`, or `completed`. Every state transition is a new row; rows sharing the same `payment_provider_transaction_id` belong to one payment. Fees, payment provider, and signature are fixed placeholder values in v1. `authorization_message_id` points at the buyer's original request message. Full CRUD with tombstone delete.

Payment flows use four core procedures that mirror Stripe's PaymentIntent model (no Stripe integration yet):

1. **`payment_intent`** (`api{service:evy, method:payment_intent}`) — buyer's device calls this before creating a pickup/delivery/shipping request message. Request: `fk`, `resource`, `amount`, `currency`, `authorization_message_id`. Writes a `{type: "charge", status: "intent"}` row. The client carries `payment_provider_transaction_id` as the intent id in message data (a generated uuid now, Stripe's `pi_…` later). Server-side constants: `confirm: true`, `capture_method: "manual"`, `payment_provider: "stripe"`, fees `0`, `signature: "signed"`. Auto-calls `payment_intent.succeeded` on the mock webhook (ack only).
2. **`payment_capture`** (`api{service:evy, method:payment_capture}`) — seller's device calls this before accepting a request. Request: `{ payment_intent_id }`. Writes `{charge, initiated}`; the mock webhook then appends `{charge, succeeded}` (marketplace appends `sold` via the transaction `after_create` hook) and `{charge, completed}`. Rejects unknown intents and duplicate capture. Amount `6.66` (`MOCK_CAPTURE_FAILURE_AMOUNT`) auto-fires `payment_intent.capture_failed` instead.
3. **`payment_transfer`** (`api{service:evy, method:payment_transfer}`) — moves funds to the seller after capture. Request: `{ payment_intent_id }`. Requires a `{charge, succeeded}` row; writes `{transfer, initiated}` then mock webhook appends `{transfer, succeeded}` and `{transfer, completed}`. Amount `7.77` (`MOCK_TRANSFER_FAILURE_AMOUNT`) auto-fires `transfer.failed`.
4. **`payment_webhook`** (`api{service:evy, method:payment_webhook}`) — mock webhook handler for payment lifecycle events. Request: `{ type, payment_intent_id }`. Response: `{ received: true }`. Procedures auto-call it in-process; tests and a future Stripe HTTP adapter call it explicitly. On capture/transfer failure, authors `charge_failed` / `transfer_failed` messages on the item's chain.

#### Visibility

Visibility appears in two places and they are not the same thing.

**Resource (catalog) visibility** is declared on every resource of every service in that service's resource manifest (`core.resources.json` for core, `resources.ts` for external services). It is required on each `ResourceDescriptor` returned by the `resources` discovery method. The three values are:

- `"public"` — full data API: get, sync, create, update, delete.
- `"private"` — same API surface as public; the name reflects the default row visibility for resources whose rows carry a `visibility` column (see below).
- `"internal"` — get and sync only. Create, update, and delete via the data API are rejected. The owning service may still write rows directly (for example marketplace hooks appending `item_status_history`).

**Row visibility** applies only to `DATA_EVY_*` rows that have a `visibility` column in Postgres. Every such create must state `"public"` or `"private"` — nothing fills one in, not the resource module, not the schema, not the database column. A payload without row visibility is rejected.

Each core resource whose rows carry the column declares the value its records are created with in [`core.resources.json`](../../../types/schema/resources/core.resources.json), emitted as `EVY_CORE_RESOURCE_VISIBILITY` in TypeScript and `EVYCoreResource.visibility` in Swift (row default only — catalog `"internal"` and resources without the column are absent). iOS attaches the row default on create; web and seeds state it in their payloads. `formatters` and the virtual `resources` catalog have catalog `"public"` but no row column, so they contribute no row default. External service payloads have no row `visibility` field; catalog visibility still applies to the resource manifest and API mutation policy.

**What row public and private mean for sync:** a public row goes to every device; a private row goes only to the device that owns it. Messages add one case — whoever owns the record a message addresses receives it too, even before they hold it. So `private` is an access rule, not just a storage choice, and flipping a resource to private removes its rows from every device but the owner's. That happens with no error anywhere: the app simply renders less. Before making a resource private, ask who reads it — a public record that reads a private one (as the marketplace item once read its pickup address) has to carry what it needs itself.

On iOS, public rows sync into `publicStore` and private rows into `privateStore`; web keeps a single data path and treats row `visibility` as an ordinary field.

Two limits worth knowing. `get` is **not** an access boundary — it takes no ownership and returns whatever it is asked for; sync is the only path that populates a device, so that is where the row rule lives. External service resources declare catalog visibility like core; the gateway forwards their payloads without inspecting row fields they do not have.

On iOS the private store is also part of what a device declares as owned on sync, which is how a message that arrives for you stays owned and keeps receiving updates. Note what row `visibility` is **not**: it is one global column choosing a store, not an access rule and not ownership. Every device syncs every private row it is sent — every device holds every seeded address privately — so `"private"` means "stored privately on whichever device receives it", never "mine". Ownership of a **public** record therefore cannot be expressed by row visibility at all, and is recorded separately when the device creates it (see [`sync`](#wire-contract-vs-persisted-rows)).

### DATA_EVY_Message

Core message record in [`data.schema.json`](../../../types/schema/data/data.schema.json) (`$defs.DATA_EVY_Message`, Postgres table `Message`). A message always relates to one record of another resource: `fk` is that record's id, and `resource` is the dotted ref of the resource the `fk` belongs to (e.g. `marketplace.items`). `type` and `value` are required root attributes; other use-case-specific fields (e.g. `time`, `postalcode`, address objects) live in the free-form `data` object.

On the wire this is accessed with `resource: "evy.messages"`.

#### A message is write-once

**Nothing in the system updates a message.** A request's whole life is the sequence of messages naming it, ordered by `created_at`: asked, then accepted, rejected or withdrawn. There is no `status` column and no `archivedAt` column; each held part of this before the lifecycle became append-only.

`value` holds the whole vocabulary — `"pending"` on a request, and `"accept"`, `"reject"` or `"cancel"` on the message that settles one. Purchase flows extend this with handshake values (`transaction`, `given`, `sent`, …), fulfillment failures (`failed` on delivery/shipping chains), and payment failure values (`charge_failed`, `transfer_failed` — webhook-authored only). Evy core authors `request_failed` when a `before_create` hook vetoes a message create. The canonical list lives in [`core.resources.json`](../../../types/schema/resources/core.resources.json) under `messages.dataValues`.

**Client rule:** `reject`, `cancel`, `failed`, and every `*_failed` / `*_rejected` value is *negative* — the step named by its `parent_message_id` did not take effect and the chain is back to the state before it. Every SDUI "latest" check must be value-scoped with this rule; `…_initiated` and `…_completed` are equivalent for gating.

A settling message addresses whatever record the request addressed — same `fk` and `resource` — and **carries the request's whole `data` forward**, overriding `value` and setting `parent_message_id` on the row to name what it answers. That duplication is load-bearing rather than sloppy: `findFirst` cannot nest, so a lookup that finds the settling message cannot reach through it to the request. Anything the settled state displays — the agreed time, the address it is going to or being collected from — has to be on the message that says so, or the confirmation row renders empty.

Accepting, rejecting and cancelling are therefore the same operation with a different `value`. They differ only in who says it: the record's owner answers, its asker withdraws.

#### The state of a transfer method is its latest message

The item page reads one thing per transfer method: the **latest** message for that `(fk, type)` pair.

```
findFirst(sort(evy.messages, desc, created_at), fk == <item>.id && type == pickup)
```

`pending` means a request is open (offer to cancel it); `accept` means it is agreed (show the time). `reject`, `cancel` and "no message at all" are the same branch — nothing is in flight, so offer to request again.

Each `(fk, type)` pair is **tracked independently** — a rejected pickup says nothing about delivery — but only one arrangement is live at a time in the UI. The tab container holding the three request controls is gated on *nothing* being live, so while one method is pending or agreed the page shows that one arrangement alone. Requesting another means settling the current one first.

Two things follow that are easy to trip over:

- **`created_at` is the ordering key and has no fallback.** It is written with millisecond precision for exactly this reason. `sort` compares it as a string, so mixing second-resolution and fractional values compares *wrongly* (`.` sorts before `Z`), and equal keys fall back to store order — which would let a request outrank its own answer, since the request was stored first.
- **`findFirst(sort(…), …)` is the whole mechanism.** `sort` accepts a field path and `findFirst`'s collection argument is function-aware, so no client-side special case is involved. See [methods.md](./methods.md#findfirst).

Messages follow the same rule as every other private resource, with two additions:

- as well as the device that owns the message (its creator, declaring the message's own id under `evy.messages`), a message reaches the device that owns the record it **addresses**, which declares that record's id under the message's `resource` ref;
- a message reaches whoever owns the message it **answers** — matched on `parent_message_id`. Without it a response would never reach the party who asked, since they own neither the response nor the record it addresses.

Those two are the only entitlements in the system that are not plain ownership. Everyone else never receives it.

#### Transfer address fields in `data`

Two optional keys carry full address objects inside message `data`:

| key | written by | when |
| --- | --- | --- |
| `pickup_address` | seller's device | on the **accept** of a `pickup` request only |
| `destination_address` | buyer's device | on a `delivery` / `shipping` **request**; forwarded by accept/reject/cancel |

A settling message carries the request's whole `data` forward, so accept/reject/cancel templates
must forward `destination_address` when present. The seller's pickup lookup on accept must be
guarded on `type == pickup`: the item only carries the public pickup location
(`postcode`, `latitude`, `longitude`), and an unguarded `findFirst` over `evy.addresses` would
disclose the seller's private street on every delivery accept.

**An accepted request shows the full address, not the postcode.** Each active-request container on
the item page carries its own address row gated on `value == "accept"`, so the postcode only
ever stands in for an address that is not known yet:

| method | pending / settled | accepted |
| --- | --- | --- |
| pickup | map over the item's public `transfer_options.pickup`, subtitled with its `postcode` | map over the accept's `data.pickup_address`, subtitled `formatAddress(…)` |
| delivery | "Buyer will drop off" | "Delivering to" + `formatAddress(data.destination_address)` |
| shipping | "Delivered to your door" | "Shipping to" + `formatAddress(data.destination_address)` |

Pickup reads the address the **seller** wrote onto the accept, since that is the only message the
buyer's device ever receives it on. Delivery and shipping read the address the **buyer** wrote onto
the request, which the accept forwards — so both render off the one message `findFirst` lands on.
`data.postalcode` is still forwarded on shipping messages but nothing displays it any more.

> **A trap for anything reading `data` in SQL.** The `bun-sql` driver stores a jsonb column by JSON-stringifying its value, so a row written through the API holds a jsonb *string* containing the object rather than the object. Reads are symmetric, so JavaScript never notices — but `data ->> 'key'` is NULL on that shape and `jsonb_set` refuses it outright. Note that the pglite-backed unit tests store jsonb properly, so they will not catch a clause that only works on the normalised shape.

Messages are `private`, so a received one lands in the receiving device's private store and stays owned from then on — it keeps receiving anything that follows without needing to own the record it addresses. A device that is reinstalled, or that never created the record a seeded message addresses, still has no claim on those messages until it declares the ownership explicitly; that resolves when auth lands and ownership can be derived from an account.

---

## Shared value objects (reuse across services)

These shapes are not separate JSON Schema `$defs` in the EVY data schema; they are contracts for JSON embedded in domain payloads (e.g. marketplace item JSON) or in UI state. Worker services and clients validate them at the application layer.

### price

```
currency: string
value: decimal
```

### area

```
id: uuid
value: string
```

### photo

Base model with no extra props (identity may be implied by storage layer).

### calendar_selection (compact calendar / runtime)

```
start_time: string           (HH:mm, 24-hour, e.g. "07:00")
end_time: string             (HH:mm, exclusive, e.g. "19:00")
timeslot_interval_minutes: string    (minutes, e.g. "30")
label_interval_minutes: string       (minutes, e.g. "60")
header_format: string        (date format pattern, e.g. "EEE d")
timeslot_format: string      (time format pattern, e.g. "HH:mm")

Calendar rows use three bindings: `source` supplies the main timeslots to display and anchor columns (same binding as `destination`); `destination` is the main selection array edited when the user taps timeslots; `secondary` is a different binding whose timeslots are rendered greyed-out for read-only context.
```

### transfer_options

```
pickup: {
    selection: [string]   (ISO date-time strings)
    address_id: uuid      (references a core addresses row)
    lead_time_hours: string   (hours of notice required before pickup)
}
delivery: {
    fee: price
    selection: [string]   (ISO date-time strings)
}
ship: {
    postal_code: string
    areas: [area]
}
```

### duration

```
id: uuid
value: string (e.g. "30 minutes")
```

## Naming

Every **serialized** name is `snake_case`. Every **language identifier** is derived mechanically from it and never hand-written.

Serialized surfaces include Postgres table/column/enum-type/index names, Drizzle column keys, JSON Schema property names, JSON Schema enum values and `const` values, generated TypeScript property names, RPC method names, RPC param names, SDUI row `type` values, SDUI row property names, SDUI action param names, SDUI trigger names, row `data` JSON keys, file-resource keys, resource names, and procedure names.

Derived names stay in each language's usual style: TypeScript and Swift type names are PascalCase; Swift enum cases for row types are lowerCamelCase with `= "snake_case"` raw values; TypeScript/Swift source file names and local variables stay in their conventional casing.

| Serialized name | TS type | Swift type | Swift enum case | Drizzle key | PG identifier |
| --- | --- | --- | --- | --- | --- |
| `horizontal_container` (row type) | `HorizontalContainer_Row` | `HorizontalContainerRowViewData` | `horizontalContainer` | — | — |
| `service_provider` (table) | `DATA_EVY_ServiceProvider` | — | — | `service_provider` | `service_provider` |
| `created_at` (prop) | `created_at` | `created_at` | — | `created_at` | `created_at` |
| `swipe_left` (trigger) | `swipe_left` | `swipe_left` | — | — | — |
| `web` (enum value) | `"web"` | `case web = "web"` | `web` | — | `'web'` |
| `selling_reasons` (resource) | — | — | `sellingReasons` | — | — |

Schema `title` fields remain PascalCase (for example `HorizontalContainer_Row`) because `json-schema-to-typescript` uses them verbatim as interface names.
