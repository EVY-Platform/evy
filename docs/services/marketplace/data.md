# Marketplace data models

Clients talk to marketplace through the EVY api, in order to access the `items`, `selling_reasons`, `conditions`, and `requests` resources.

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

## DATA_MARKETPLACE_PickupRequest

```
id: uuid
type: "pickup"
item_id: uuid
time: string (local ISO time, `YYYY-MM-DDTHH:mm:ss`)
archived: boolean
createdAt: string (date-time, optional)
updatedAt: string (date-time, optional)
```

Cancelling a request sets `archived: true` via an update — records are not hard-deleted.

## DATA_MARKETPLACE_DeliveryRequest

```
id: uuid
type: "delivery"
item_id: uuid
time: string (local ISO time, `YYYY-MM-DDTHH:mm:ss`)
archived: boolean
createdAt: string (date-time, optional)
updatedAt: string (date-time, optional)
```

## DATA_MARKETPLACE_ShippingRequest

```
id: uuid
type: "shipping"
item_id: uuid
postalcode: string (1–10 characters)
archived: boolean
createdAt: string (date-time, optional)
updatedAt: string (date-time, optional)
```

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
