# Marketplace data models

The main `api` owns all SDUI (flows) in its database. The marketplace service is **data-only** (catalog rows such as conditions, items, etc.): it implements the shared gRPC contract at [`types/schema/service.proto`](../../../types/schema/service.proto) (`evy.Service`). The `api` routes non-SDUI `marketplace` namespace requests to that service via `MARKETPLACE_GRPC_HOST` and `MARKETPLACE_GRPC_PORT`; clients still use WebSockets only to the main API.

These shapes are **marketplace domain models**. They are not defined as top-level `$defs` in `types/schema/data/data.schema.json`; payloads live as JSON under the `marketplace` namespace (and/or in `DATA_EVY_Data` rows) and are validated at the application layer.

Shared value objects (`location`, `price`, `address`, `area`, `photo`, `timeslot`, `transfer_options`, `duration`) are documented in [EVY data models](../../evy/sddata/data.md).

---

## DATA_MARKETPLACE_Tag

```
id: uuid
value: string
```

---

## DATA_MARKETPLACE_SellingReason

```
id: uuid
value: string
```

---

## DATA_MARKETPLACE_Condition

```
id: uuid
value: string
```

---

## DATA_MARKETPLACE_Item

A listing aggregate. Field names below follow the marketplace service mock and UI bindings; some keys use `snake_case` in persisted JSON.

```
id: uuid
title: string
photo_ids: [uuid]
price: price
seller_id: uuid
address: address
createdAt: string (date-time)
transfer_options: transfer_options
description: string
condition_id: uuid (optional; selected condition)
selling_reason_id: uuid (optional; selected selling reason)
dimensions: {
    width: number
    height: number
    length: number
    weight: number
}
tags: [DATA_MARKETPLACE_Tag]
payment_methods: {
    cash: boolean
    app: boolean
}
```

`condition_id` / `selling_reason_id` reference option rows (`DATA_MARKETPLACE_Condition` / `DATA_MARKETPLACE_SellingReason`) loaded like other reference data.
