# Marketplace data models

Clients talk to marketplace through the EVY api, in order to access the `items`, `selling_reasons`, `conditions`, and `messages` resources.

Shared value objects (`location`, `price`, `address`, `area`, `photo`, `timeslot`, `transfer_options`, `duration`) are documented in [EVY data models](../../evy/data.md).

## DATA_MARKETPLACE_Tag

```
id: uuid
value: string
```

## DATA_MARKETPLACE_SellingReason

```
id: uuid
value: string
```

## DATA_MARKETPLACE_Condition

```
id: uuid
value: string
```

## Messages

Rows of the `messages` resource are core [`DATA_EVY_Message`](../../evy/data.md#data_evy_message) objects — the marketplace API persists them without payload validation. For item requests, `fk` is the item id and `service` / `resource` are the marketplace service and `items` resource ids. The free-form `data` object carries the transfer specifics:

```
data.type: "pickup" | "delivery" | "shipping"
data.time: string (local ISO time, `YYYY-MM-DDTHH:mm:ss`; pickup/delivery)
data.postalcode: string (shipping)
```

Cancelling a message sets `archivedAt` via an update — records are not hard-deleted.

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
