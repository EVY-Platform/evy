# Actions in EVY

Actions are what run on the client when a row's trigger fires (`tap`, `submit`, `delete`,
`tap-row`, `tap-column`, `swipe-left`). See [sdui.md](./sdui.md#actions) for the trigger model,
sequencing, and conditions; this document is the reference for each action function itself.

Each branch in a `UI_RowAction` is stored as a string: the empty string `""` (no-op) or exactly
one inline action expression `{fn(arg, …)}`. The `{condition, true, false}` sequencing shape is
unchanged — only the `true`/`false` payloads are expression strings rather than structured
objects. The grammar is pinned by the conformance corpus in
[`types/grammar/README.md`](../../types/grammar/README.md); [`action.schema.json`](../../types/schema/sdui/action.schema.json)
declares `UI_ActionBranch` as a `string`, and the API validates every non-empty branch with the
shared `parseActionExpression` parser on row `create`/`update`.

The web builder does not execute actions; it edits expression strings directly and displays
mocks.

## Action expression grammar

| Function | Signature |
| --- | --- |
| `close()`, `select_photo()`, `expand_photo()`, `delete_photo()` | zero args |
| `show(rowId)`, `expand_text(rowId)` | one row id |
| `highlight_required(field)` | one field path (label derivation only) |
| `select(value)` | one value-position arg; `$datum` allowed bare |
| `copy_to_clipboard(value)` | one display-text template; formatters allowed |
| `navigate(flowId, pageId, {k: v, …}?)` | ids verbatim; query map values are value-position; `[a, b]` array values kept |
| `create(resource, submit)` | resource ref verbatim |
| `create(resource, {map}, idDestination?)` | map values value-position; `idDestination` is a write path, verbatim |
| `create(resource, dataPath, idDestination?)` | from-path mode |
| `update(resource, {filter}, {changes}\|changesPath, draft?)` | store mode needs non-empty filter; draft mode empty filter |

Object-literal arguments nest braces. A message-create call might look like:

```
{create(evy.messages, {fk: {marketplace.items.id}, resource: marketplace.items, type: delivery, value: pending, data: {time: {selected_delivery_timeslot}}})}
```

| Function | Meaning |
| --- | --- |
| `close` | Close the current UI. Inside a sheet overlay, dismisses the sheet only. |
| `select_photo` | Ask the triggering `SelectPhoto` row to present the photo picker. Does not upload by itself — upload runs after the user picks photos. |
| `delete_photo` | Ask the triggering `SelectPhoto` row to delete the photo tile the user tapped. Typically wired to the row's `delete` trigger. |
| `expand_photo` | Present the current `PhotoGallery` photo full screen. |
| `expand_text` | Expand the `TextExpand` row with that id, wherever it is on screen. Requires exactly one non-empty row id. |
| `show` | Present that row in a sheet overlay. The target may be on any synced page. Requires exactly one non-empty id; unresolved ids are errors. |
| `highlight_required` | Mark a field as required / show validation. |
| `select` | Ask the triggering row to select `value`, usually `$datum`. Each row type defines what select means (toggle, write scalar, switch segment); unsupported on rows without a select handler. When the resolved value is an **array**, Calendar treats it as a batch toggle-all (see below). |
| `copy_to_clipboard` | Copy resolved text to the device clipboard. |
| `navigate` | Go to a page within a flow. Optional third argument is a query map whose values are value-position expressions. |
| `create` | Create a domain entity. **Never changes routes** — follow with `close` to dismiss. See **create** below. |
| `update` | Update matching domain entities. See **update** below. |

## Value position

Map values in `data`, `filter`, `changes`, `query`, and nested object-literal action arguments
follow **value-position** rules (distinct from comparison operands inside `{…}` — see
[comparisons.md](./comparisons.md#operand-resolution)):

| Written | Meaning |
| --- | --- |
| `pending`, `marketplace.items` | literal string, verbatim |
| `"AUD"` (whole value is a quoted string) | string literal (quotes are delimiters; used in destination templates) |
| `{marketplace.items.id}` (whole value is one `{expr}`) | resolve; result keeps its JSON type (string/number/object/array) |
| `Hello {user.name}!` (embedded braces) | string interpolation via the text parser |
| `true` / `false` / `null` / `42` (bare, whole value) | coerced JSON scalar |
| `{$datum.id}` | datum property; a whole-value `{$datum.…}` that does not resolve is **omitted** from create `data` / update `changes` maps |

`$datum` may also appear **nested inside** a function call in `data`, `changes`, `filter`, or `query` values (e.g. `findFirst(marketplace.items, $datum.fk)`). Those expressions are resolved against the triggering datum at execution time.

Bare strings are always literals — no resolve-with-literal-fallback, no escaped quoting, and no
bare-UUID special case. Wrap a binding in braces when you want it resolved:
`fk: {marketplace.items.id}` with `resource: marketplace.items` as a literal ref string.

## select

```
{select($datum)}
```

Usually `{select($datum)}` with the tapped unit as datum. `$datum` is the one value-position
argument where the sigil may appear bare. When the resolved value is an **array**, Calendar
treats it as a batch toggle-all: if every item is already in the destination selection, remove
them all; otherwise add every missing item (one destination write). Axis taps (`tap-row` /
`tap-column`) pass `$datum` as the array of ISO datetime strings for that row or column, e.g.
`{select($datum)}` on `tap-column` selects or clears an entire day.

## copy_to_clipboard

```
{copy_to_clipboard({formatAddress($datum.data.pickup_address)})}
```

`value` is a **display-text template**, not a data path — formatters such as `formatAddress`
are allowed. When the template resolves to an empty string, the action is a deliberate no-op
(the same shared row template can run for request types that carry no address).

## create

`{create(resource, submit)}` merges the active flow's create drafts into the entity and cleans
them up. In the web builder, `submit` is chosen automatically when the flow has row
**destinations** or **draft** `update` actions targeting that resource; otherwise the builder
configures inline data only.

`{create(resource, {map}, idDestination?)}` takes an inline data map whose values follow
value-position rules above.

**Unresolvable `{$datum.…}` keys are omitted.** In create `data` and update `changes` maps, a
whole-value `{$datum.…}` that does not resolve on the triggering datum is dropped from the
payload rather than written as the literal source text. That is what lets a shared response
template carry both `time` (pickup / delivery) and `postalcode` (shipping): whichever the request
lacks is simply absent. Filter and query maps keep the previous behaviour — dropping a filter
key would silently widen a store update.

`{create(resource, dataPath, idDestination?)}` sends the whole resolved object from drafts or
synced data at `dataPath`. Both non-submit modes accept an optional `id_destination` write path;
after create, the client writes the generated uuid string there (typically `pickup_address.id` on
address pick). Use it in **create flows** where the target record does not exist yet. When the
target already exists, link it with a follow-up store-mode `update` instead of writing onto the
live record path (see the Address save pattern below).

```
{create(evy.addresses,pickup_address,{pickup_address.id})}
```

## update

Store mode (default) requires a non-empty filter and updates matching records immediately. A
store-mode update matching no rows is a no-op.

Draft mode passes an empty filter (`{}`) and a fourth `draft` argument; changes write into the
active create-merge scope for `resource` via `mergeIntoActiveDraft`.

`changes` is either a `{key: value}` map — whose keys may use dotted nested paths, e.g.
`transfer_options.pickup.address_id` — or a whole-object data path (with `id` stripped before
merge), never both. Filter and change values follow value-position rules. A filter value of
`null` matches records where the property is absent or JSON `null`. Changes can call functions,
e.g. `{archivedAt: {now()}}`.

```
{update(marketplace.items,{id: {item.id}},{status: accepted})}
```

For user confirmation before a destructive `update`, attach a `sheet` row to the triggering row
and run `show` on it, with the actual `update` (followed by `close`) wired to the sheet's
confirm button — see [sdui.md](./sdui.md#swipe-left) for the confirmation-sheet pattern.

## Address save pattern (create and edit flows)

Use the same two-action `tap` array on the pickup Search row for create and edit flows, but the
**link** step differs by flow type.

1. **Create or update the address** — if `address_id` is empty, a `create` on `evy.addresses`
   from `pickup_address` with `id_destination: pickup_address.id` persists the address and writes
   the generated id to the page-local `pickup_address` buffer; otherwise a store-mode `update` on
   `evy.addresses` filtered by `id: {marketplace.items.transfer_options.pickup.address_id}` with
   `changes_path: pickup_address` updates the existing row.
2. **Link the item** — on **edit** flows where the item row already exists: a store-mode
   `update` on `marketplace.items` filtered by `id: {item.id}`, changing
   `transfer_options.pickup.address_id` to `{pickup_address.id}`, matches the row and syncs
   immediately. On **create** flows: the same change in `draft` mode writes into the create
   draft (picked up by submit `create`). A page shared across both flow types needs
   condition-branched actions (store vs draft link) because one invocation cannot serve both.

When an address already exists, the first action's `false` branch runs and **stops the action
array** (runner semantics — see [sdui.md](./sdui.md#sequencing)), so the link step does not run
again on re-pick.

```json
{
	"id": "search-row-id",
	"type": "search",
	"source": "{$api:place_search}",
	"destination": "{pickup_address}",
	"actions": {
		"tap": [
			{
				"condition": "{length(item.transfer_options.pickup.address_id) == 0}",
				"true": "{create(evy.addresses,pickup_address,{pickup_address.id})}",
				"false": "{update(evy.addresses,{id: {item.transfer_options.pickup.address_id}},pickup_address)}"
			},
			{
				"condition": "",
				"true": "{update(marketplace.items,{},{transfer_options.pickup.address_id: {pickup_address.id}},draft)}",
				"false": ""
			}
		]
	},
	"child": {
		"id": "387ebe5b-b5b5-4be9-b5db-918bb9db706f",
		"type": "text",
		"title": "{$datum.unit} {$datum.street}",
		"subtitle": "{$datum.postcode} {$datum.city}, {$datum.state}"
	}
}
```
