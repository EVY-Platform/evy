# Marketplace data models

The main `api` owns all SDUI (flows) and evy core resources in its database. The marketplace service is data-only (resource rows such as conditions, items, etc.) with service UUID `66b092ae-7cd8-4d67-95b7-30b03568fd90`: it implements the shared gRPC contract at [`types/schema/service.proto`](../../../types/schema/service.proto) (`evy.Service`). Clients still talk only to the API over WebSocket JSON-RPC; supported plural marketplace resources (e.g. `items`, `selling_reasons`, `conditions`) are represented by normal core `serviceResources` seed rows / core CRUD. The API forwards marketplace calls to the marketplace process using `MARKETPLACE_GRPC_HOST` and `MARKETPLACE_GRPC_PORT`.

These shapes are marketplace domain models. They are not defined as top-level `$defs` in `types/schema/data/data.schema.json`; payloads are JSON documents stored in the marketplace database as generic `data` rows keyed by the same plural `resource` strings used on the wire (e.g. `items`, `conditions`, `selling_reasons`). They are not duplicated as generic `DATA_EVY_*` rows in the API database.

Shared value objects (`location`, `price`, `address`, `area`, `photo`, `timeslot`, `transfer_options`, `duration`) are documented in [EVY data models](../../evy/data.md).

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
photo_ids: [uuid] (references `evy:files` rows)
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

`photo_ids` reference binary file rows from the evy core `files` resource. `condition_id` / `selling_reason_id` reference option rows (`DATA_MARKETPLACE_Condition` / `DATA_MARKETPLACE_SellingReason`) loaded like other reference data.
