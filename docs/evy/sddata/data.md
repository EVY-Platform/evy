# Data models

This document covers **EVY shared data**: schema-backed rows (source of truth: [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json)) and **reusable value objects** used across app EVY services. Domain payloads for a specific service (e.g. marketplace) may add `DATA_MARKETPLACE_*` types documented under that service.

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
defaultWeightKg: number (optional)
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

### DATA_EVY_Flow and DATA_EVY_Data

- **DATA_EVY_Flow**: `id`, `data` ([`UI_Flow`](../sdui/readme.md) JSON), `createdAt`, `updatedAt`.
- **DATA_EVY_Data**: `id`, `namespace`, `resource`, `data` (arbitrary JSON per resource; namespaced service payloads), `createdAt`, `updatedAt`.

---

## Shared value objects (reuse across services)

These shapes are not separate JSON Schema `$defs` in the data schema; they are **contracts** for JSON stored under service namespaces (e.g. `marketplace`) or embedded in listings. Services validate them at the application layer.

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

### timeslot (calendar grid / runtime)

Used by calendar pickers and listing availability. Cells use grid coordinates and labels, not ISO intervals at the leaf level.

```
x: integer
y: integer
header: string
start_label: string
end_label: string
selected: boolean
```

Optional `id: uuid` when slots are materialized as standalone resources (e.g. top-level `timeslots` lists).

### transfer_options

```
pickup: {
    timeslots: [timeslot]
    address: address
}
delivery: {
    fee: price
    timeslots: [timeslot]
}
ship: {
    postal_code: string
    areas: [area]
}
```

### duration

Reference option for delivery distance / duration pickers (matches RPC resources like `durations`).

```
id: uuid
value: string
```
