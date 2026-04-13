# Data models

These types are defined in `types/schema/data/data.schema.json`. The API and generated Drizzle schema use them.

## Common date-time fields

Tables that track updates use ISO 8601 / RFC 3339 strings (never numeric Unix timestamps):

- `createdAt`: string (date-time)
- `updatedAt`: string (date-time)

## DATA_Device

Primary key: `token`.

```
token: string (maxLength 256)
os: "ios" | "android" | "Web"
createdAt: string (date-time)
```

## DATA_Service

```
id: uuid
name: string (maxLength 50)
description: string
createdAt: string (date-time)
updatedAt: string (date-time)
```

## DATA_Organization

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

## DATA_ServiceProvider

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

## DATA_Flow and DATA_Data

- **DATA_Flow**: `id`, `data` (SDUI_Flow JSON), `createdAt`, `updatedAt`.
- **DATA_Data**: `id`, `data` (NamespacedData: `evy` and `marketplace` namespaces), `createdAt`, `updatedAt`.
