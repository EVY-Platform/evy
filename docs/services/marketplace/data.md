# Marketplace data models

Clients talk to marketplace through the EVY api using dotted resource refs: `marketplace.items`, `marketplace.selling_reasons`, `marketplace.conditions`, `marketplace.durations`, and `marketplace.areas`.

Marketplace owns its own payload schemas and validates every `create` and `update` against them: the EVY api forwards these payloads without inspecting them, so anything this service does not check is unchecked everywhere. The schemas live in [`services/marketplace/src/schema/`](../../../services/marketplace/src/schema) and are compiled by [`src/validation.ts`](../../../services/marketplace/src/validation.ts); nothing marketplace-shaped belongs in the shared `types/` package. Resource refs are declared in [`services/marketplace/src/resources.ts`](../../../services/marketplace/src/resources.ts) and exposed through the service's `resources` JSON-RPC method, along with each resource's bindable `attributes` — derived from these same schemas, so what the builder offers and what the service accepts cannot drift apart.

Shared value objects (`location`, `price`, `address`, `area`, `photo`, `timeslot`, `transfer_options`, `duration`) are documented in [EVY data models](../../evy/data.md).

Item requests and seller/buyer messages are core [`DATA_EVY_Message`](../../evy/data.md#data_evy_message) rows (`evy.messages`), not marketplace blobs.

## Simple lookup resources

`marketplace.selling_reasons`, `marketplace.conditions`, `marketplace.durations`, and `marketplace.areas` all share one shape:

```
id: uuid
value: string
```

Source of truth: [`services/marketplace/src/schema/lookup.schema.json`](../../../services/marketplace/src/schema/lookup.schema.json). Unlike items these are closed (`additionalProperties: false`) and both fields are required — nothing merges draft fields into a lookup row, so an unexpected key means the wrong resource was written.

## DATA_MARKETPLACE_Item

A listing aggregate. Field names below follow the marketplace service mock and UI bindings; some keys use `snake_case` in persisted JSON.

Source of truth: [`services/marketplace/src/schema/item.schema.json`](../../../services/marketplace/src/schema/item.schema.json), enforced by the marketplace service on every item `create` and `update`.

Items do **not** embed an address object. A pickup location is referenced by id through `transfer_options.pickup.address_id`, which points at a core [`addresses`](../../evy/data.md) row.

**But the item carries the public part of that location itself** — `transfer_options.pickup` also holds `postcode`, `latitude` and `longitude`, copied from the address when the link is written. It has to: the item is public and the address is private, so a buyer's device never receives the address row and cannot read it. The map and location line render from the item; the unit and street stay on the private record. Anything that writes `address_id` must write those three fields in the same action, and a test in [`scripts/shipped-fixture-action-branches.test.ts`](../../../scripts/shipped-fixture-action-branches.test.ts) fails if a shipped action does not — the failure mode is a page that renders a blank map, which nothing else notices.

**Two shapes.** A seeded item nests its options (`payment_methods.cash`, `transfer_options.delivery.fee`), while an item produced by the create flow also carries the flat draft fields that flow merges on submit (`payment_cash`, `payment_app`, `delivery_fee`, `shipping_fee`, `distance`, `shipping_source_postal_code`, `shipping_destination_areas`). The schema accommodates both: only `id` is required, every known field is type-checked but optional, and `additionalProperties` stays open at the top level so the flat draft fields pass. Nested objects are closed, so a misspelled key inside `transfer_options` or `dimensions` is rejected. The flat draft fields are typed from what the create flow actually persists, not from what their names suggest: a `TextSelect` writes the *string* `"true"`/`"false"` (`EVYSelectItem` assigns text, and SDUI's `{x.payment_cash == true}` compares against an unquoted literal, which matches it), an `Input` writes a string even for a fee, and an `InlinePicker` whose tap selects `$datum` stores the chosen rows' ids rather than the rows.

Field-level detail lives in the schema rather than here; a copy of it went stale as soon as a field changed. What the schema does not say: `photo_ids` references `evy.files` rows, `seller_id` references a core user, and `condition_id` / `selling_reason_id` reference `marketplace.conditions` and `marketplace.selling_reasons`.
