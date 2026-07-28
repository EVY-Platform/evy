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
and resource they belong to. The server uses it to decide which ownership-scoped rows the device
is entitled to — today only `messages` — and a device that declares nothing receives none of them.

A device owns the records it created. Ownership it did not earn that way can be declared through
the `EVY_OWNED_SERVICE_RESOURCES` launch override, which stands in for the account-derived
ownership that arrives with real auth. Changing that declaration voids the cursor — it makes
records visible that may have changed long before the cursor was issued — so the client resyncs
in full.

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

Every `DATA_EVY_*` row carries a required `visibility` attribute: `"public"` or `"private"`. Clients may omit it in create/update payloads; the server defaults omitted values to `"public"` (`"private"` for addresses). On iOS, public rows sync into `publicStore` and private rows into `privateStore`; web keeps a single data path and treats `visibility` as an ordinary field.

### DATA_EVY_Message

Core message record in [`data.schema.json`](../../../types/schema/data/data.schema.json) (`$defs.DATA_EVY_Message`, Postgres table `Message`). A message always relates to one record of another resource: `fk` is that record's id, and `service` / `resource` identify which service and resource the `fk` belongs to. Use-case-specific fields (e.g. `type`, `time`, `postalcode`) live in the free-form `data` object.

On the wire this is accessed with `service: "475731ac-31aa-4d65-94d2-7032782ae359"` and `resource: "messages"`. Cancelling sets `archivedAt`; accepting sets `status` to `accepted` via `{update(...)}`.

Unlike every other core resource, messages are not synced to every device. A message reaches exactly two parties: the device that created it, which declares the message's own id under `evy`/`messages` in `ownedServiceResources`, and the device that owns the record it addresses, which declares that record's id under the message's `service`/`resource`. Everyone else never receives it. Because ownership is only established when a device creates a record, a device that is reinstalled — or that never created the record a seeded message addresses — loses access to those messages until it declares the ownership explicitly; this resolves when auth lands and ownership can be derived from an account.

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
