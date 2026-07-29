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
| `service` | The service UUID that owns it. Core procedures run in the gateway; anything else is forwarded to that service. |
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

Clients call the API with JSON-RPC `get`, `sync`, `resources`, `api`, `create`, `update`, and `delete` using `service` and `resource` where applicable (see [`types/schema/rpc`](../../../types/schema/rpc)). `sync` and `resources` are top-level methods; `sync` is described on its own below. `resources` returns the aggregated service/resource catalog from the core manifest plus each registered external service's live `resources` RPC response. `service: "[evy_core_service_id]"` is dispatched by the API into resource modules under [`api/src/data/resources`](../../../api/src/data/resources) and maps to the row types below in the API Postgres schema. External services such as `service: "[service_id]"` are routed by service ID from normal core `services` rows. Each external service owns its resource manifest locally and exposes it through its required `resources` JSON-RPC method; the gateway aggregates those manifests and includes the full catalog on every successful sync as a singleton under the core `resources` key so clients can persist it offline.

Routing in practice: the API dispatches on `service`, comparing it against the generated core service UUID (`EVY_CORE_SERVICE`). Core resources are addressed by **name** (`flows`, `messages`, …); external resources are addressed by the **resource UUID** declared in the owning service's manifest. Anything that is not the core service is forwarded to the owning service's adapter, which the API resolves from the core `services` table at startup.

**`sync` in practice:** Send back the opaque `cursor` from the previous response, or omit it for a full sync. Alongside
the cursor a client sends `ownedServiceResources`: the record ids it owns, grouped by the service
and resource they belong to. Every resource is read the same way: the device gets every public row,
plus the private rows it declared. A device that declares nothing still syncs — it just receives the
public rows only.

A device's ownership set is the union of three sources:

- **records it created**, kept in a small ledger of `(service, resource, id)` triples. This is the
  only source that can claim a *public* record, and it is what keeps a seller entitled to messages
  about an item they listed. Anything created on the platform is owned by whoever created it.
- **records it holds privately**, so a private row that arrives stays owned and its later updates
  keep coming. Local singletons share that store but are excluded: they are not records the server
  knows, and their id is not a uuid — which the request schema rejects, failing the whole sync.
- **the `EVY_OWNED_SERVICE_RESOURCES` launch override**, standing in for the account-derived
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

- `createdAt`: string (date-time)
- `updatedAt`: string (date-time)

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

On the wire this is accessed with `service: "475731ac-31aa-4d65-94d2-7032782ae359"` and `resource: "flows"`.

### DATA_EVY_Page

Persisted page shell.

On the wire this is accessed with `service: "475731ac-31aa-4d65-94d2-7032782ae359"` and `resource: "pages"`.

### DATA_EVY_Row

Persisted row record. Row-type-specific SDUI fields live in `data`. Nested row relationships are stored by UUID inside `data` and expanded back to nested `sheet`, `child`, and `children` when clients assemble [`UI_Flow`](sdui.md):

| Flat key | SDUI field | Ownership |
| --- | --- | --- |
| `sheet_row_id` | `sheet` | Optional on **every** row type — overlay content for `{show(rowId)}` |
| `child_row_id` | `child` | One result-row template (not a sheet), for example for search row |
| `children_row_ids` | `children` | Container rows with static nested children |

A Search row may persist both `child_row_id` and `sheet_row_id`. Relationship kind is explicit in storage; do not infer it from row type alone beyond the Search-only rule for `child`.

On the wire this is accessed with `service: "475731ac-31aa-4d65-94d2-7032782ae359"` and `resource: "rows"`.

#### Visibility

Every `DATA_EVY_*` row carries a required `visibility` attribute: `"public"` or `"private"`. **Every create states it, and nothing fills one in** — not the resource module, not the schema, not the database column. A payload without a visibility is rejected, because a record whose visibility nobody chose is a bug rather than something to guess at.

Each resource declares the value its records are created with in [`core.resources.json`](../../../types/schema/resources/core.resources.json), which the generator emits for both platforms (`EVY_CORE_RESOURCE_VISIBILITY` in TypeScript, `EVYCoreResource.visibility` in Swift). iOS attaches it on create; web states it where it builds records; seeds and tests state it in their payloads. Resources with no visibility of their own — the `resources` catalog, `formatters`, and every external service resource — declare nothing and get nothing.

**What the two values mean for sync:** a public row goes to every device; a private row goes only to the device that owns it. Messages add one case — whoever owns the record a message addresses receives it too, even before they hold it. So `private` is an access rule, not just a storage choice, and flipping a resource to private removes its rows from every device but the owner's. That happens with no error anywhere: the app simply renders less. Before making a resource private, ask who reads it — a public record that reads a private one (as the marketplace item once read its pickup address) has to carry what it needs itself.

On iOS, public rows sync into `publicStore` and private rows into `privateStore`; web keeps a single data path and treats `visibility` as an ordinary field.

Two limits worth knowing. `get` is **not** an access boundary — it takes no ownership and returns whatever it is asked for; sync is the only path that populates a device, so that is where the rule lives. And external service resources have no `visibility` of their own and the gateway forwards their payloads without inspecting them, so they are public by construction; a service that needs private rows declares and filters them itself.

On iOS the private store is also part of what a device declares as owned on sync, which is how a message that arrives for you stays owned and keeps receiving updates. Note what `visibility` is **not**: it is one global column choosing a store, not an access rule and not ownership. Every device syncs every private row it is sent — every device holds every seeded address privately — so `"private"` means "stored privately on whichever device receives it", never "mine". Ownership of a **public** record therefore cannot be expressed by visibility at all, and is recorded separately when the device creates it (see [`sync`](#wire-contract-vs-persisted-rows)).

### DATA_EVY_Message

Core message record in [`data.schema.json`](../../../types/schema/data/data.schema.json) (`$defs.DATA_EVY_Message`, Postgres table `Message`). A message always relates to one record of another resource: `fk` is that record's id, and `service` / `resource` identify which service and resource the `fk` belongs to. Use-case-specific fields (e.g. `type`, `time`, `postalcode`) live in the free-form `data` object.

On the wire this is accessed with `service: "475731ac-31aa-4d65-94d2-7032782ae359"` and `resource: "messages"`.

#### A message is write-once

**Nothing in the system updates a message.** A request's whole life is the sequence of messages naming it, ordered by `createdAt`: asked, then accepted, rejected or withdrawn. There is no `status` column and no `archivedAt` column; each held part of this before the lifecycle became append-only.

`data.value` holds the whole vocabulary — `"pending"` on a request, and `"accept"`, `"reject"` or `"cancel"` on the message that settles one. A request says `"pending"` outright rather than leaving the key absent, so the predicates read as one state machine and a message kind that carries no state is never mistaken for something to answer.

A settling message addresses whatever record the request addressed — same `fk`, `service` and `resource` — and **carries the request's whole `data` forward**, overriding `value` and adding `data.message_id` to name what it answers. That duplication is load-bearing rather than sloppy: `findFirst` cannot nest, so a lookup that finds the settling message cannot reach through it to the request. Anything the settled state displays — the agreed time, the shipping postcode — has to be on the message that says so, or the confirmation row renders empty.

Accepting, rejecting and cancelling are therefore the same operation with a different `value`. They differ only in who says it: the record's owner answers, its asker withdraws.

#### The state of a transfer method is its latest message

The item page reads one thing per transfer method: the **latest** message for that `(fk, data.type)` pair.

```
findFirst(sort(messages, desc, createdAt), fk == <item>.id && data.type == pickup)
```

`pending` means a request is open (offer to cancel it); `accept` means it is agreed (show the time). `reject`, `cancel` and "no message at all" are the same branch — nothing is in flight, so offer to request again.

Each `(fk, data.type)` pair is **tracked independently** — a rejected pickup says nothing about delivery — but only one arrangement is live at a time in the UI. The tab container holding the three request controls is gated on *nothing* being live, so while one method is pending or agreed the page shows that one arrangement alone. Requesting another means settling the current one first.

Two things follow that are easy to trip over:

- **`createdAt` is the ordering key and has no fallback.** It is written with millisecond precision for exactly this reason. `sort` compares it as a string, so mixing second-resolution and fractional values compares *wrongly* (`.` sorts before `Z`), and equal keys fall back to store order — which would let a request outrank its own answer, since the request was stored first.
- **`findFirst(sort(…), …)` is the whole mechanism.** `sort` accepts a field path and `findFirst`'s collection argument is function-aware, so no client-side special case is involved. See [methods.md](./methods.md#findfirst).

Messages follow the same rule as every other private resource, with two additions:

- as well as the device that owns the message (its creator, declaring the message's own id under `evy`/`messages`), a message reaches the device that owns the record it **addresses**, which declares that record's id under the message's `service`/`resource`;
- a message reaches whoever owns the message it **answers** — matched on `data.message_id`. Without it a response would never reach the party who asked, since they own neither the response nor the record it addresses.

Those two are the only entitlements in the system that are not plain ownership. Everyone else never receives it.

> **A trap for anything reading `data` in SQL.** The `bun-sql` driver stores a jsonb column by JSON-stringifying its value, so a row written through the API holds a jsonb *string* containing the object rather than the object. Reads are symmetric, so JavaScript never notices — but `data ->> 'key'` is NULL on that shape and `jsonb_set` refuses it outright. `messages.ts` unwraps tolerantly for exactly this reason. It affects every jsonb column in the schema, not just this one; normalising the database and fixing the write path is its own change. Note that the pglite-backed unit tests store jsonb properly, so they will not catch a clause that only works on the normalised shape.

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
