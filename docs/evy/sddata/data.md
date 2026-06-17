# Data models

This document covers EVY shared data: schema-backed rows stored in the API database (source of truth: [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json)) and reusable value objects used across clients and services. Domain payloads for workers such as marketplace are documented under that service; they are not `DATA_EVY_*` rows in this schema.

## Wire contract vs persisted rows

Clients call the API with JSON-RPC `resources`, `sync`, `get`, `api`, `create`, `update`, and `delete` using `service` and `resource` where applicable (see [`types/schema/rpc`](../../../types/schema/rpc)). `service: "evy"` is dispatched by the API into resource modules under [`api/src/data/resources`](../../../api/src/data/resources) and maps to the row types below in the API’s Postgres schema. `service: "marketplace"` (and future workers) is discovered through `ListResources` and proxied over gRPC; payloads are validated in those services and stored in their own databases—not as a generic “namespace row” in the EVY data schema.

## Common date-time fields

Tables that track updates use ISO 8601 / RFC 3339 strings (never numeric Unix timestamps):

- `createdAt`: string (date-time)
- `updatedAt`: string (date-time)

---

## Schema-backed row types (`DATA_EVY_*`)

These are defined in `types/schema/data/data.schema.json`. The API and generated Drizzle schema use them.

### DATA_EVY_Device

Primary key: `token`.

```
token: string (maxLength 256)
os: "ios" | "android" | "Web"
createdAt: string (date-time)
```

### DATA_EVY_Service

```
id: uuid
name: string (maxLength 50)
description: string
sortOrder: integer (optional)
createdAt: string (date-time)
updatedAt: string (date-time)
```

### DATA_EVY_Organization

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

### DATA_EVY_ServiceProvider

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

### DATA_EVY_Flow

Row shape: `id`, `data` ([`UI_Flow`](../sdui/readme.md) JSON), `createdAt`, `updatedAt`. On the wire this is accessed with `service: "evy"` and `resource: "sdui"`.

There is no `DATA_EVY_Data` type in [`data.schema.json`](../../../types/schema/data/data.schema.json). Core non-SDUI EVY data uses typed tables and `DATA_EVY_Service`, `DATA_EVY_Organization`, `DATA_EVY_ServiceProvider`, and `DATA_EVY_Device` as above (`resource` values `services`, `organisations`, `providers`, `devices` on `get`, `create`, or `update`).

---

## Shared value objects (reuse across services)

These shapes are not separate JSON Schema `$defs` in the EVY data schema; they are contracts for JSON embedded in domain payloads (e.g. marketplace item JSON) or in UI state. Worker services and clients validate them at the application layer.

### location

```
latitude: decimal
longitude: decimal
```

### price

```
currency: string
value: decimal
```

### address

```
unit: string
street: string
city: string
postcode: string
state: string
country: string
location: location
instructions: string
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
timeslot_interval_minutes: integer   (e.g. 30)
label_interval_minutes: integer      (e.g. 60)
header_format: string        (date format pattern, e.g. "EEE d")
primary: string              (binding to primary selection array)
secondary: string            (binding to read-only secondary context array)
```

### transfer_options

```
pickup: {
    selection: [string]   (ISO date-time strings)
    address: address
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
