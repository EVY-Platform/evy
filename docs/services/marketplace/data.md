# Marketplace data models

Clients talk to marketplace through the EVY api, in order to access the `items`, `selling_reasons`, `conditions`, and `durations` resources.

Service-owned resource payload shapes are conventions defined only in SDUI — there are no code-side JSON schemas or TypeScript types for marketplace data rows. Only resource ids are declared in `marketplace.resources.json`.

Shared value objects (`location`, `price`, `address`, `area`, `photo`, `timeslot`, `transfer_options`, `duration`) are documented in [EVY data models](../../evy/data.md).

Item requests and seller/buyer messages are core [`DATA_EVY_Message`](../../evy/data.md#data_evy_message) rows (resource `messages` on the EVY core service), not marketplace blobs.

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
