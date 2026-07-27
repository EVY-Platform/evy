# Marketplace data models

Clients talk to marketplace through the EVY api, in order to access the `items`, `selling_reasons`, `conditions`, and `durations` resources.

Marketplace owns its own payload schemas and validates every `create` and `update` against them: the EVY api forwards these payloads without inspecting them, so anything this service does not check is unchecked everywhere. The schemas live in [`services/marketplace/src/schema/`](../../../services/marketplace/src/schema) and are compiled by [`src/validation.ts`](../../../services/marketplace/src/validation.ts); nothing marketplace-shaped belongs in the shared `types/` package. Resource ids are declared in [`services/marketplace/src/resources.ts`](../../../services/marketplace/src/resources.ts) and exposed through the service's `resources` JSON-RPC method, along with each resource's bindable `attributes` — derived from these same schemas, so what the builder offers and what the service accepts cannot drift apart.

Shared value objects (`location`, `price`, `address`, `area`, `photo`, `timeslot`, `transfer_options`, `duration`) are documented in [EVY data models](../../evy/data.md).

Item requests and seller/buyer messages are core [`DATA_EVY_Message`](../../evy/data.md#data_evy_message) rows (resource `messages` on the EVY core service), not marketplace blobs.

## Simple lookup resources

`selling_reasons`, `conditions`, `durations`, and `areas` all share one shape:

```
id: uuid
value: string
```

Source of truth: [`services/marketplace/src/schema/lookup.schema.json`](../../../services/marketplace/src/schema/lookup.schema.json). Unlike items these are closed (`additionalProperties: false`) and both fields are required — nothing merges draft fields into a lookup row, so an unexpected key means the wrong resource was written.

## DATA_MARKETPLACE_Item

A listing aggregate. Field names below follow the marketplace service mock and UI bindings; some keys use `snake_case` in persisted JSON.

Source of truth: [`services/marketplace/src/schema/item.schema.json`](../../../services/marketplace/src/schema/item.schema.json), enforced by the marketplace service on every item `create` and `update`.

Items do **not** embed an address object. A pickup location is referenced by id through `transfer_options.pickup.address_id`, which points at a core [`addresses`](../../evy/data.md) row; SDUI reads it with `findFirst(addresses, <item>.transfer_options.pickup.address_id)`.

**Two shapes.** A seeded item nests its options (`payment_methods.cash`, `transfer_options.delivery.fee`), while an item produced by the create flow also carries the flat draft fields that flow merges on submit (`payment_cash`, `payment_app`, `delivery_fee`, `shipping_fee`, `distance`, `shipping_source_postal_code`, `shipping_destination_areas`). The schema accommodates both: only `id` is required, every known field is type-checked but optional, and `additionalProperties` stays open at the top level so the flat draft fields pass. Nested objects are closed, so a misspelled key inside `transfer_options` or `dimensions` is rejected. The flat draft fields are typed from what the create flow actually persists, not from what their names suggest: a `TextSelect` writes the *string* `"true"`/`"false"` (`EVYSelectItem` assigns text, and SDUI's `{x.payment_cash == true}` compares against an unquoted literal, which matches it), an `Input` writes a string even for a fee, and an `InlinePicker` whose tap selects `$datum` stores the chosen rows' ids rather than the rows.

Field-level detail lives in the schema rather than here; a copy of it went stale as soon as a field changed. What the schema does not say: `photo_ids` references `evy:files` rows, `seller_id` references a core user, and `condition_id` / `selling_reason_id` reference the marketplace `conditions` and `selling_reasons` resources.
