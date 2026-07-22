# Data

## Types used to generate code for all platforms

### Core types

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

### Sources

All `types/schema/**/*.schema.json` files define types for UI flows, RPC, and data models.

`types/schema/sdui/definitions/*.schema.json` files define SDUI row definitions, including row-specific content and view keys.

`types/schema/data/drizzle.config.json` defines the database schema configuration for generated Drizzle tables. Keep it manually in sync with `types/schema/data/data.schema.json`, with AI assistance when useful.

### Command

Run type generation after changing schemas, row definitions, or Drizzle database configuration so TypeScript, Swift, Drizzle, and core resource outputs stay aligned with the source definitions.

From the repo root:

```bash
bun run types:generate
```

`bun run types:generate` runs:

1. `scripts/generate-types.ts` — Emits TypeScript under `types/generated/ts/` and Swift under `types/generated/swift/` from `*.schema.json`. It generates stable Swift filenames from nested and hyphenated schema paths, includes `types/schema/files/file.schema.json`, and runs `scripts/generate-swift-sdui.ts` for Swift UI shapes from `evy.schema.json` plus `types/schema/sdui/definitions/*.schema.json`.
2. `scripts/generate-drizzle.ts` — Emits `types/generated/ts/db/schema.generated.ts` from `data.schema.json` and `drizzle.config.json`.
3. `scripts/generate-core-resources.ts` — Emits generated evy core resource compile-time constants only for core API validation and sync's core-resource loop. Non-evy service/resource ownership is stored in normal core `services` and `serviceResources` rows and can be read through standard `get` CRUD.

### Outputs (do not edit by hand)

- `types/generated/ts/` — TypeScript types, Drizzle schema, validators, RPC helpers, and generated evy core resource registry inputs. The API, web app, and marketplace service import these via the `evy-types` path alias.
- `types/generated/swift/` — Swift types. The iOS app references generated SDUI, core resource, OS, and file API models while keeping transport and UI models handwritten where needed.

After changing any schema, `drizzle.config.json`, or SDUI row definition schema, run `bun run types:generate`. Output under `types/generated/` is gitignored; regenerate locally and do not hand-edit generated files.

---

## Data models

This document covers EVY shared data: schema-backed rows stored in the API database (source of truth: [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json)) and reusable value objects used across clients and services. Domain payloads for workers such as marketplace are documented under that service; they are not `DATA_EVY_*` rows in this schema.

### Wire contract vs persisted rows

Clients call the API with JSON-RPC `sync`, `get`, `api`, `create`, `update`, and `delete` using `service` and `resource` where applicable (see [`types/schema/rpc`](../../../types/schema/rpc)). `service: "[evy_core_service_id]"` is dispatched by the API into resource modules under [`api/src/data/resources`](../../../api/src/data/resources) and maps to the row types below in the API Postgres schema. External services such as `service: "[service_id]"` are routed by service ID from normal core `services` rows. External resource ownership is represented in core `serviceResources` rows, and the runtime `resource` value for an external service is the `serviceResources.id` UUID. `serviceResources.name` is a human-friendly base label only; it is not a routing key. External payloads are validated in those services and stored in their own databases—not as a generic "namespace row" in the EVY data schema. See [`external-service-resource-id-discovery.md`](../plans/external-service-resource-id-discovery.md) for the resource-ID routing details.

### Common date-time fields

Tables that track updates use ISO 8601 / RFC 3339 strings (never numeric Unix timestamps):

- `createdAt`: string (date-time)
- `updatedAt`: string (date-time)

---

### Schema-backed row types (`DATA_EVY_*`)

These are defined in `types/schema/data/data.schema.json`. The API and generated Drizzle schema use them.

#### DATA_EVY_Device

Primary key: `token`.

```
token: string (maxLength 256)
os: "ios" | "android" | "Web"
createdAt: string (date-time)
```

#### DATA_EVY_Service

```
id: uuid
name: string (maxLength 50)
description: string
sortOrder: integer (optional)
createdAt: string (date-time)
updatedAt: string (date-time)
```

#### DATA_EVY_Organization

```
id: uuid
name: string (maxLength 100)
description: string
logo: uuid
url: string (maxLength 50)
supportEmail: string (maxLength 50)
createdAt: string (date-time)
updatedAt: string (date-time)
```

#### DATA_EVY_ServiceProvider

```
id: uuid
fkServiceId: uuid
fkOrganizationId: uuid
name: string (maxLength 100)
description: string
logo: uuid
url: string (maxLength 50)
createdAt: string (date-time)
updatedAt: string (date-time)
retired: boolean (default false)
```

#### DATA_EVY_ServiceResource

```
id: uuid
fkServiceId: uuid
name: string (maxLength 50)
createdAt: string (date-time)
updatedAt: string (date-time)
```

`name` is the display/base name used by the web builder for human-friendly labels. Runtime service/resource references use `id`; clients must not derive API routing or persistence keys from `name`.

#### DATA_EVY_Flow

Persisted flow shell. Clients assemble the nested [`UI_Flow`](sdui.md) shape from `flows`, `pages`, and `rows` at the serialization boundary.

```
id: uuid
name: string
pageIds: uuid[]
createdAt: string (date-time)
updatedAt: string (date-time)
```

On the wire this is accessed with `service: "475731ac-31aa-4d65-94d2-7032782ae359"` and `resource: "flows"`.

#### DATA_EVY_Page

Persisted page shell.

```
id: uuid
name: string
title: string (optional)
rowIds: uuid[]
footerRowId: uuid (optional)
createdAt: string (date-time)
updatedAt: string (date-time)
```

On the wire this is accessed with `service: "475731ac-31aa-4d65-94d2-7032782ae359"` and `resource: "pages"`.

#### DATA_EVY_Row

Persisted row record. Row-type-specific SDUI fields live in `data`. Nested row relationships are stored by UUID inside `data` and expanded back to nested `sheet`, `child`, and `children` when clients assemble [`UI_Flow`](sdui.md):

| Flat key | SDUI field | Ownership |
| --- | --- | --- |
| `sheet_row_id` | `sheet` | Optional on **every** row type — overlay content for `{show(rowId)}` |
| `child_row_id` | `child` | **Search only** — one result-row template (not a sheet) |
| `children_row_ids` | `children` | Container rows with static nested children |

A Search row may persist both `child_row_id` and `sheet_row_id`. Relationship kind is explicit in storage; do not infer it from row type alone beyond the Search-only rule for `child`.

```
id: uuid
name: string
type: string
visible: string
data: object
createdAt: string (date-time)
updatedAt: string (date-time)
```

On the wire this is accessed with `service: "475731ac-31aa-4d65-94d2-7032782ae359"` and `resource: "rows"`.

There is no `DATA_EVY_Data` type in [`data.schema.json`](../../../types/schema/data/data.schema.json). Core non-SDUI EVY data uses typed tables and `DATA_EVY_Service`, `DATA_EVY_Organization`, `DATA_EVY_ServiceProvider`, and `DATA_EVY_Device` as above (`resource` values `services`, `organisations`, `providers`, `devices` on `get`, `create`, or `update`).

#### DATA_EVY_Message

Generic message record, defined in [`message.schema.json`](../../../types/schema/data/message.schema.json). A message always relates to one record of another resource: `fk` is that record's id, and `service` / `resource` identify which service and resource the `fk` belongs to. Use-case-specific fields (e.g. `type`, `time`, `postalcode`, `address`) live in the free-form `data` object; no service validates its contents.

```
id: uuid
fk: uuid (the related record, e.g. a marketplace item id)
service: uuid (service the fk belongs to)
resource: uuid (resource the fk belongs to)
archivedAt: string (date-time) | null (null/absent while active)
status: "pending" | "accepted" (new messages start pending; accept via slide-left `{update(...)}` on the homepage)
createdAt: string (date-time, set by the client at creation)
data: object (free-form, use-case specific)
```

Cancelling a message sets `archivedAt` to the current timestamp via an update — records are not hard-deleted. Accepting a pending message sets `status` to `accepted` (also via `{update(...)}`, often wired to the `slide-left` trigger on message search rows). Message rows are currently stored by the marketplace service under its `messages` resource (see [marketplace data models](../services/marketplace/data.md)).

---

### Shared value objects (reuse across services)

These shapes are not separate JSON Schema `$defs` in the EVY data schema; they are contracts for JSON embedded in domain payloads (e.g. marketplace item JSON) or in UI state. Worker services and clients validate them at the application layer.

#### price

```
currency: string
value: decimal
```

#### address

```
unit: string
street: string
city: string
postcode: string
state: string
country: string
latitude: decimal
longitude: decimal
instructions: string
```

#### area

```
id: uuid
value: string
```

#### photo

Base model with no extra props (identity may be implied by storage layer).

#### calendar_selection (compact calendar / runtime)

```
start_time: string           (HH:mm, 24-hour, e.g. "07:00")
end_time: string             (HH:mm, exclusive, e.g. "19:00")
timeslot_interval_minutes: string    (minutes, e.g. "30")
label_interval_minutes: string       (minutes, e.g. "60")
header_format: string        (date format pattern, e.g. "EEE d")
timeslot_format: string      (time format pattern, e.g. "HH:mm")

Calendar rows use three bindings: `source` supplies the main timeslots to display and anchor columns (same binding as `destination`); `destination` is the main selection array edited when the user taps timeslots; `secondary` is a different binding whose timeslots are rendered greyed-out for read-only context.
```

#### transfer_options

```
pickup: {
    selection: [string]   (ISO date-time strings)
    address: address
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

#### duration

```
id: uuid
value: string (e.g. "30 minutes")
```
