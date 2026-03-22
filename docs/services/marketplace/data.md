# Marketplace data models

These shapes are **domain models** used by the marketplace service. They are not defined in the repo’s JSON Schema; they are stored as JSON under `NamespacedData.marketplace` and validated at the application layer. See [EVY data models](../evy/sddata/data.md) for the API persistence schema and the distinction between schema-defined types and domain models.

---

#### seller

```
reliability_rate: float
items_sold: int
```

#### dimension

```
width: int
height: int
length: int
weight: int
```

#### condition

```
value: string
```

#### selling_reason

```
value: string
```

#### duration

```
id: uuid
value: string
```

#### timeslot (marketplace UI)

Used for calendar/grid UI (e.g. picker cells). For the EVY API timeslot shape (start/end **ISO date-time strings**, availability), see [EVY data models](../evy/sddata/data.md#timeslot).

```
x: int
y: int
header: string
start_label: string
end_label: string
selected: boolean
```

#### item

```
title: string
description: string
createdAt: string (date-time, ISO 8601)
seller_id: uuid
condition_id: uuid
selling_reason_id: uuid
tag_ids: [uuid]
tags: [tag]
payment_methods: {
    cash: boolean
    app: boolean
}
photo_ids: [string]
address: address
price: price
dimension: dimension
transfer_options: transfer_options
```
