# Data models

## API persistence schema (DATA_*)

These types are defined in `types/schema/data/data.schema.json`. The API and generated Drizzle schema use them.

### Common timestamp fields

Tables that track updates use:

- `createdAt`: string (date-time)
- `updatedAt`: string (date-time)

### DATA_Device

Primary key: `token`.

```
token: string (maxLength 256)
os: "ios" | "android" | "Web"
createdAt: string (date-time)
```

### DATA_Service

```
id: uuid
name: string (maxLength 50)
description: string
createdAt: string (date-time)
updatedAt: string (date-time)
```

### DATA_Organization

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

### DATA_ServiceProvider

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

### DATA_Flow and DATA_Data

- **DATA_Flow**: `id`, `data` (SDUI_Flow JSON), `createdAt`, `updatedAt`.
- **DATA_Data**: `id`, `data` (NamespacedData: `evy` and `marketplace` namespaces), `createdAt`, `updatedAt`.

---

## Domain models (NamespacedData)

The following shapes are used in app and service logic and stored as JSON under `NamespacedData.evy` or `NamespacedData.marketplace`. They are not defined in the JSON Schema; validation is application-level.

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

### tag

```
value: string
```

### photo

Base model with no extra props.

### logo

Base model with no extra props.

### timeslot

```
start_timestamp: string
end_timestamp: string
available: boolean
type: string
```

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
