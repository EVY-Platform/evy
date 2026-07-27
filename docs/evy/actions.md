# Actions in EVY

Actions are what run on the client when a row's trigger fires (`tap`, `submit`, `delete`,
`tap-row`, `tap-column`, `swipe-left`). See [sdui.md](./sdui.md#actions) for the trigger model,
sequencing, and conditions; this document is the reference for each action function itself.

Every action invocation is a structured object naming a function (`fn`) and its arguments — see
[`action.schema.json`](../../types/schema/sdui/action.schema.json) for the authoritative shape
of each variant, enforced by the API on every row `create`/`update`. Legacy `{functionName(arg1,
arg2)}` strings are not accepted; clients cannot decode them.

Value expressions inside `data`, `filter`, `changes`, and `query` remain strings and resolve as
a data path, `$datum`, a quoted literal, or a bare word — see
[comparisons.md](./comparisons.md#operand-resolution) for the resolution order.

| `fn` | Fields | Meaning |
| --- | --- | --- |
| `close` | — | Close the current UI. Inside a sheet overlay, dismisses the sheet only. |
| `select_photo` | — | Ask the triggering `SelectPhoto` row to present the photo picker. Does not upload by itself — upload runs after the user picks photos. |
| `delete_photo` | — | Ask the triggering `SelectPhoto` row to delete the photo tile the user tapped. Typically wired to the row's `delete` trigger. |
| `expand_photo` | — | Present the current `PhotoGallery` photo full screen. |
| `expand_text` | `rowId` | Expand the `TextExpand` row with that id, wherever it is on screen. Requires exactly one non-empty row id. |
| `show` | `rowId` | Present that row in a sheet overlay. The target may be on any synced page. Requires exactly one non-empty id; unresolved ids are errors. |
| `highlight_required` | `field` | Mark a field as required / show validation. |
| `select` | `value` | Ask the triggering row to select `value`, usually `$datum`. Each row type defines what select means (toggle, write scalar, switch segment); unsupported on rows without a select handler. When the resolved value is an **array**, Calendar treats it as a batch toggle-all (see below). |
| `navigate` | `flowId`, `pageId`, `query` (optional) | Go to a page within a flow. `query` is a map of value expressions. |
| `create` | `service`, `resource`, `mode`, plus mode fields | Create a domain entity. **Never changes routes** — follow with `close` to dismiss. See **create** below. |
| `update` | `service`, `resource`, `mode`, `filter`, `changes` \| `changesPath` | Update matching domain entities. See **update** below. |

The web builder does not execute actions; it edits these structured invocations and displays
mocks.

## select

```
{select(value)}
```

Usually `{select($datum)}` with the tapped unit as datum. When the resolved value is an
**array**, Calendar treats it as a batch toggle-all: if every item is already in the destination
selection, remove them all; otherwise add every missing item (one destination write). Axis taps
(`tap-row` / `tap-column`) pass `$datum` as the array of ISO datetime strings for that row or
column, e.g. `{select($datum)}` on `tap-column` selects or clears an entire day.

## create

`mode: "submit"` merges the active flow's create drafts into the entity and cleans them up. In
the web builder, `submit` is chosen automatically when the flow has row **destinations** or
**draft** `update` actions targeting that service and resource; otherwise the builder configures
inline data only.

`mode: "inline"` takes a `data` map: its values resolve as data paths or `$datum`, unresolved
bare words stay literals (bare `true`/`false` become booleans, bare `null` becomes JSON null,
quoted `"…"` stays a literal string, and `{…}` values resolve as nested objects).

`mode: "fromPath"` takes a `dataPath` and sends the whole resolved object from drafts or synced
data.

Both non-submit modes accept an optional `idDestination`, a draft-aware write path; after
create, the client writes the generated uuid string there (typically `pickup_address.id` on
address pick). Use it in **create flows** where the target record does not exist yet. When the
target already exists, link it with a follow-up store-mode `update` instead of writing onto the
live record path (see the Address save pattern below).

```json
{ "fn": "create", "service": "core", "resource": "addresses",
  "mode": "fromPath", "dataPath": "pickup_address", "idDestination": "pickup_address.id" }
```

## update

`mode: "store"` (default) requires a non-empty `filter` and updates matching records
immediately. A store-mode update matching no rows is a no-op.

`mode: "draft"` takes no filter (`filter` must be `{}`) and writes into the active create-merge
scope for `resource` via `mergeIntoActiveDraft`.

`changes` is either a `{key: value}` object — whose keys may use dotted nested paths, e.g.
`transfer_options.pickup.address_id` — or `changesPath`, a whole-object data path (with `id`
stripped before merge), never both. Filter and change values resolve like inline `create` data.
A filter value of `null` matches records where the property is absent or JSON `null`. Changes
can call functions, e.g. `{archivedAt: now()}`.

```json
{ "fn": "update", "service": "marketplace", "resource": "items",
  "mode": "store", "filter": { "id": "item.id" },
  "changes": { "status": "accepted" } }
```

For user confirmation before a destructive `update`, attach a `sheet` row to the triggering row
and run `show` on it, with the actual `update` (followed by `close`) wired to the sheet's
confirm button — see [sdui.md](./sdui.md#swipe-left) for the confirmation-sheet pattern.

## Address save pattern (create and edit flows)

Use the same two-action `tap` array on the pickup Search row for create and edit flows, but the
**link** step differs by flow type.

1. **Create or update the address** — if `address_id` is empty, a `create` on `core/addresses`
   with `mode: "fromPath"`, `dataPath: "pickup_address"` and `idDestination: "pickup_address.id"`
   persists the address and writes the generated id to the page-local `pickup_address` buffer;
   otherwise a store-mode `update` on `core/addresses` filtered by `id:
   item.transfer_options.pickup.address_id` with `changesPath: "pickup_address"` updates the
   existing row.
2. **Link the item** — on **edit** flows where the item row already exists: a store-mode
   `update` on `marketplace/items` filtered by `id: item.id`, changing
   `transfer_options.pickup.address_id` to `pickup_address.id`, matches the row and syncs
   immediately. On **create** flows: the same change in `mode: "draft"` writes into the create
   draft (picked up by submit `create`). A page shared across both flow types needs
   condition-branched actions (store vs draft link) because one invocation cannot serve both.

When an address already exists, the first action's `false` branch runs and **stops the action
array** (runner semantics — see [sdui.md](./sdui.md#sequencing)), so the link step does not run
again on re-pick.

```json
{
	"id": "search-row-id",
	"type": "Search",
	"source": "{$api:place_search}",
	"destination": "{pickup_address}",
	"actions": {
		"tap": [
			{
				"condition": "{length(item.transfer_options.pickup.address_id) == 0}",
				"true": { "fn": "create", "service": "core", "resource": "addresses",
				          "mode": "fromPath", "dataPath": "pickup_address",
				          "idDestination": "{pickup_address.id}" },
				"false": { "fn": "update", "service": "core", "resource": "addresses",
				           "mode": "store",
				           "filter": { "id": "item.transfer_options.pickup.address_id" },
				           "changesPath": "pickup_address" }
			},
			{
				"condition": "",
				"true": { "fn": "update", "service": "marketplace", "resource": "items",
				          "mode": "draft",
				          "changes": { "transfer_options.pickup.address_id": "pickup_address.id" } },
				"false": ""
			}
		]
	},
	"child": {
		"id": "387ebe5b-b5b5-4be9-b5db-918bb9db706f",
		"type": "Text",
		"title": "{$datum.unit} {$datum.street}",
		"subtitle": "{$datum.postcode} {$datum.city}, {$datum.state}"
	}
}
```
