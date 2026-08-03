# Marketplace data models

Clients talk to marketplace through the EVY api using dotted resource refs: `marketplace.items`, `marketplace.selling_reasons`, `marketplace.conditions`, `marketplace.durations`, `marketplace.areas`, and `marketplace.item_statuses`.

Marketplace owns its own payload schemas and validates every `create` and `update` against them: the EVY api forwards these payloads without inspecting them, so anything this service does not check is unchecked everywhere. The schemas live in [`services/marketplace/src/schema/`](../../../services/marketplace/src/schema) and are compiled by [`src/validation.ts`](../../../services/marketplace/src/validation.ts); nothing marketplace-shaped belongs in the shared `types/` package. Resource refs are declared in [`services/marketplace/src/resources.ts`](../../../services/marketplace/src/resources.ts) and exposed through the service's `resources` JSON-RPC method, along with each resource's bindable `attributes` — derived from these same schemas, so what the builder offers and what the service accepts cannot drift apart. Every resource declares catalog `visibility`: lookups and items are `public`; `item_statuses` is `internal` (get and sync only).

Shared value objects (`location`, `price`, `address`, `area`, `photo`, `timeslot`, `transfer_options`, `duration`) are documented in [EVY data models](../../evy/data.md).

Item requests and seller/buyer messages are core [`DATA_EVY_Message`](../../evy/data.md#data_evy_message) rows (`evy.messages`), not marketplace blobs — `type` and `value` live on the row root; carried fields such as `time` and addresses live in `data`.

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

## item_status_history

Append-only log of listing status changes. Exposed to clients as the read-only resource `marketplace.item_statuses` (catalog visibility `internal` — get and sync only; marketplace internals write the table directly).

```
id: uuid
item_id: uuid          # marketplace `data.id` for resource marketplace.items
status: item_status    # available | pickup_pending | delivery_pending | shipping_pending | sold
created_at: date-time  # ISO string in a text column
```

Source of truth for the wire shape: [`services/marketplace/src/schema/item_status.schema.json`](../../../services/marketplace/src/schema/item_status.schema.json). Storage: [`services/marketplace/src/schema.ts`](../../../services/marketplace/src/schema.ts). `item_id` is a soft reference (no Postgres FK), matching how core rows point at marketplace items. Incremental `get` maps `filter.updated_after` to `created_at` because rows are append-only.

**Current status** is the latest row for an `item_id`; no rows means `available`. Marketplace hooks append rows on message creates — see [Purchase status machine](#purchase-status-machine) below. Devices filter sold items out of home search via `marketplace.item_statuses`; `*_pending` items remain visible.

## Purchase status machine

Marketplace is the first real hook consumer: every `evy.messages` create targeting `marketplace.items` runs `before_create` validation against current status and `after_create` reactions that append status rows. Transaction creates for marketplace items also run hooks: `before_create` is a no-op; `after_create` reacts to `{type: charge, status: succeeded}` by appending `sold`. The marketplace has no core API client — hook payloads and its own DB are its only inputs.

### Status values

| Status | Meaning |
| --- | --- |
| `available` | No active flow (implicit when history is empty) |
| `pickup_pending` | Seller accepted a pickup request |
| `delivery_pending` | Seller accepted a delivery request |
| `shipping_pending` | Seller accepted a shipping request |
| `sold` | Payment charge succeeded (`{charge, succeeded}` transaction row via hook) |

### `before_create` validation

| Incoming `(type, value)` | Valid when current status is |
| --- | --- |
| `pending` | `available` |
| `accept` | `available` or `sold` |
| `transaction`, `transaction_completed`, `transaction_rejected` | `pickup_pending` or `sold` |
| `given`, `sent`, `received`, `failed` | `sold` |
| `reject`, `cancel`, `request_failed` | any |
| `charge_failed`, `transfer_failed` | not vetoed (webhook-authored) |

Veto = RPC create error; nothing stored. Type/value pairs are sanity-checked (`given` only on `delivery`, `sent` only on `shipping`, etc.).

### `after_create` reactions

| Trigger | Reaction |
| --- | --- |
| message `accept` (when status is `available`) | append `<type>_pending` |
| transaction `{charge, succeeded}` | append `sold` (idempotent when already sold) |
| `transaction_rejected`, `failed`, `charge_failed`, `transfer_failed`, or `cancel` (while pending/sold) | append `available` |
| everything else | nothing |

Reactions run on an in-process per-`fk` queue; `after_create` acknowledges immediately.

Payment lifecycle state lives in `evy.transactions` rows; marketplace learns charge success from the transaction hook and rollbacks from webhook-authored `charge_failed` / `transfer_failed` messages.
