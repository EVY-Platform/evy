# Server-driven UI (UI types)

**See also:** [Repository README](../../../README.md) (architecture, setup), [API](../../../api/README.md) (JSON-RPC and gRPC routing), [Types](../types.md) (codegen, schema layout).

## Data

UI flows (`UI_Flow`) only describe structure: `id`, `name`, and `pages`. Reference data (dropdown options, tags, durations, etc.) is not embedded inside the flow JSON.

- Each row declares a required **`source`** string at the row root (next to `destination`) describing where the row **reads** data from. Use a non-empty source only for rows that load source-driven data such as option lists, search results, or calendars. If a row already reads explicit fields like `"{item.title}"` in `view.content`, the row source should be `""` because the binding resolves the resource directly.
	- `"{conditions}"`, `"{selling_reasons}"`, `"{durations}"`, `"{areas}"`, `"{tags}"`, `"{items}"` — plural backend/catalog or in-memory keys the client resolves to option lists or entity arrays. Search and dynamic ListContainer rows read the resource named by `source`.
	- `"{$local:address}"` — client-local source.
	- `""` — no external read binding (e.g. edit rows whose data is driven by `destination`, display rows using explicit bindings like `"{item.title}"`, pure navigation buttons, static Info, and containers that only group static child rows).
- Edit rows write into a draft via **`destination`**. Draft destinations always start with the plural resource name, for example `"{item.title}"`, `"{item.condition}"`, or `"{buildCurrency(item.price)}"`. The prefix tells the UI which resource draft owns the field.
- Braced `{...}` expressions are used for all SDUI bindings. Prefixed `{$...:...}` bindings identify data that does not belong to backend flow state:
	- `{$datum:value}` — current list/search result item field, used in row `format` strings and Search result templates.
	- `{$local:resource}` — client-local source.
- Catalog/local data is loaded outside the flow document. Clients can request individual lists with JSON-RPC `get` (`service` / `resource`) using optional `filter.id` or `filter.updatedAfter`, or sync service data in batches with `syncServiceData`.
- `syncServiceData` accepts `{ "service": "marketplace", "lastSyncTime": "ISO-8601 timestamp" }` and returns changed resource arrays as `{ service, resource, value }` rows. Clients get all service resources changed since `lastSyncTime`.
- Clients should store synced rows under service-qualified keys such as `marketplace:items` and `marketplace:conditions`. Navigate actions pass query params as the optional third `navigate` argument (for example, `{navigate(flowId, pageId, {"items": [$datum.id]})}`). Query values must use a JSON object (`{"key": ["id"]}`). Clients parse the query into a `[String: [String]]` dictionary, resolve the first ID for each resource key from the synced collection, and expose the matching entity under the same plural key. If no synced collection exists for a query key, clients keep the raw string array under that key.
- iOS draft scope IDs and draft cache keys are internal draft-store identifiers; see [iOS README § Draft scopes and draft cache keys](../../../ios/README.md#draft-scopes-and-draft-cache-keys).
- Flow bindings use the plural resource name without the service prefix (`{items}`, `{conditions}`, `{tags}`). The client data layer resolves those bindings to synced service data when no exact local key exists. Exact local keys still take precedence for selected entities, drafts, and flow state.
- `evy` catalog data uses [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json); marketplace resources are served by the marketplace worker ([`services/marketplace`](../../../services/marketplace/README.md)). Routing and persistence are described in [`api/README`](../../../api/README.md). Clients merge loaded data with flow state when rendering rows (e.g. Dropdown, InlinePicker, Search, InputList).

So a flow might reference “10 min, 20 min, 30 min” options via `source: "{durations}"` while the selected value is written to `destination: "{item.distance}"`; the actual list of options lives in the data layer the app fetches, not inside the flow document.

## Flow

Flows are not visually used in the UI but represent a full user journey (eg: creating an item)
They are needed in order to submit all fields of all pages of a flow at the end upon clicking a single button on a page

The canonical shape matches `types/schema/sdui/evy.schema.json`:

```
{
    "id": "uuid",
    "name": "string",
    "pages": [PAGE]
}
```

## Page

```
{
    "id": "uuid",
    "title": "string",   // Shown in the navbar
    "rows": [ROW],
    "footer": ROW        // Optional; shown as sticky footer
}
```

## Row

Rows are what are put into pages. They are the building block of the EVY server-driven UI framework

### Base features

-   All values are strings, there are no types as this is dynamic on the apps
    -   eg: "title": "My title", could also be "title": "{item.title}"
-   All strings can include:
    -   variables surrounded with curly braces: "Hello {name}, how are you?"
    -   inline icons as [Lucide](https://lucide.dev/icons) names in kebab-case, wrapped in double colons: "EVY ::image-plus:: is the best!" (iOS and web parse `::icon-name::` only; they do not expand Slack-style `:emoji:` shortcodes)
-   [ x ]
    -   Denotes a type array of x
-   Objects and arrays
    -   When objects or arrays are interpolated (e.g. `{item.tags}`), the UI runtime resolves the binding to structured data (e.g. a JSON array of tag objects) before rendering—use the schema and client behavior for the exact shape, not a hand-written JSON fragment in the flow string.

### Row schema explained

```
{
    "id": "uuid",
    "type": "Button" | "Calendar" | "ColumnContainer" | ... ,

    "view": {
        "content": {
            // Required. Header of the row; empty string means no header.
            "title": "string",
            // Layout: "children" (array of rows), "child" (single row), "segments" (array of strings).
            "children": [ROW],  // optional
            "child": ROW,        // optional
            "segments": ["string"],
            // Additional keys per row type (label, value, placeholder, format, etc.)
            // See types/schema/sdui/row-content.spec.json for the full list per type.
        },
        "max_lines": "string"    // optional (e.g. Text)
    },
    // Where the row reads option/list/entity data from (required string; use "" if unused).
    "source": "string",
    // Where input data is stored in a draft. Use plural resource paths such as "{item.title}".
    "destination": "string",

    // Actions are required on every row and default to an empty array
    "actions": [{
        "condition": "{length(title) > 0}",
        "false": "{highlight_required(title)}",
        "true": "{create(item)}"
    }]
}
```

### Actions

Each row has an `actions` array of `UI_RowAction` objects (`condition`, `false`, `true` are strings). The web builder persists them; execution is client-specific (see **Evaluation** below for iOS).

#### Conditions

- Wrap the whole condition in curly braces: `{ ... }`.
- Empty `condition` — treated as always true (the `true` branch is taken unless you rely on client-specific rules).
- Single comparison: `{left op right}`
	Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`
	Left and right operands are usually variable names or literals (client interprets values). Both sides are resolved as data bindings when possible; if both resolve to numbers the comparison is numeric, otherwise lexicographic string comparison is used.
- AND: join comparisons with `&&` inside the braces:
	`{length(title) > 0 && price.value >= 1}`
- OR: join comparisons with `||` inside the braces:
	`{count(pickup_timeslots) > 0 || count(delivery_timeslots) > 0 || count(shipping_destination_areas) > 0}`
- Grouping: use parentheses to control precedence:
	`{(length(title) > 0 && price.value >= 1) || override == true}`
- Boolean literals `true` and `false` are valid as standalone conditions or operands.
- Condition helpers (used like functions in the expression):
	- `count(var)` — number of elements in a list/array, e.g. `{count(photo_ids) > 0}`
	- `length(var)` — number of characters in a string, e.g. `{length(title) > 0}`

#### Branches (`true` / `false`)

Each branch is a string. Empty string means "do nothing" for that branch.

Action branches **must** be wrapped in curly braces to be executed: `{functionName(arg1, arg2, ...)}`. A bare function name without braces (e.g. `close` or `close()`) is treated as inert text and will not trigger any action.

Supported action functions:

| Function | Meaning |
| -------- | ------- |
| `close()` | Close current UI, e.g. `{close()}` |
| `create(model)` | Submit / create domain entity, e.g. `{create(item)}` |
| `navigate(flowId, pageId, queryParams?)` | Go to a page within a flow, e.g. `{navigate(flowId, pageId)}`. Pass query params as the optional third argument using a JSON object, e.g. `{navigate(flowId, pageId, {"items": [$datum.id]})}`. |
| `highlight_required(field)` | Mark a field as required / show validation, e.g. `{highlight_required(title)}` |

#### Evaluation (iOS reference)

1. For each action in order, evaluate `condition` (empty condition is treated as true).
2. If the condition is false, execute the `false` branch if non-empty, then **stop** (no further actions in the array run).
3. If the condition is true, execute the `true` branch if non-empty, then **continue** to the next action.

The web builder does not execute actions; it only stores these strings. For other runtimes, treat stopping rules as implementation-defined unless documented.

#### Examples (from `docs/services/service_sdui.json`)

Validate several fields with empty `true` steps, then navigate:

```json
{
	"condition": "{length(title) > 0}",
	"false": "{highlight_required(title)}",
	"true": ""
}
```

Final “Next” after validations:

```json
{
	"condition": "",
	"false": "",
	"true": "{navigate(ca47e6c5-da19-4491-8422-adb40d9e8a27,06b21b52-0845-468a-ace1-170a3b05f3a2)}"
}
```

Navigate with query params (selects an entity from synced data):

```json
{
	"condition": "",
	"false": "",
	"true": "{navigate(ca47e6c5-da19-4491-8422-adb40d9e8a27,06b21b52-0845-468a-ace1-170a3b05f3a2,{\"items\": [$datum.id]})}"
}
```

OR condition with navigate on success:

```json
{
	"condition": "{count(pickup_timeslots) > 0 || count(delivery_timeslots) > 0 || count(shipping_destination_areas) > 0}",
	"false": "{highlight_required(pickup_timeslots)}",
	"true": "{navigate(ca47e6c5-da19-4491-8422-adb40d9e8a27,25a3269b-344c-477d-89c8-b2f5426a5d91)}"
}
```

Submit:

```json
{
	"condition": "",
	"false": "",
	"true": "{create(item)}"
}
```

The web app’s action editor (`web/app/utils/actionHelpers.ts`, `ActionEditor`, `ActionPopup`) uses the same condition and branch formats for authoring.

### Rows

Row types are defined in the schema (`types/schema/sdui/evy.schema.json`) and their content keys in `types/schema/sdui/row-content.spec.json`. Supported types:

| Category   | Row types |
| ---------- | --------- |
| View       | Info, Text, InputList |
| Edit       | Input, TextArea, TextSelect, Dropdown, InlinePicker, Search, SelectPhoto, Calendar |
| Action     | Button, TextAction |
| Container  | ColumnContainer, ListContainer, SheetContainer, SelectSegmentContainer |

Each row type’s `view.content` may include type-specific keys (e.g. `label`, `value`, `placeholder`, `format`, `child`, `children`). See `row-content.spec.json` for the exact keys per type.

For list-backed rows (Dropdown, InlinePicker, InputList, etc.), `format` is evaluated per item from the list resolved via `source`. Use `{$datum:...}` as the placeholder for the current item, e.g. `{$datum:value}` or `{$datum:unit} {$datum:street}, {$datum:city}`.

For **Search** rows, iOS reads the data array from `source`, renders each hit using `view.content.child` (typically an `Info` row template) instead of `format`, and filters locally using rendered child display strings (`title`, `subtitle`, `text`, `label`, `placeholder`, and `value`). String fields in that child row are evaluated with `{$datum:...}` the same way. Tapping a result runs actions from the rendered child row with that datum in scope. The web builder shows deterministic preview results for the child template, but it does not fetch or filter live data.

For **ListContainer** rows, `view.content.children` remains the static list of rows displayed by the container. `view.content.child` is optional and acts as a dynamic template: when the ListContainer `source` resolves to an array, iOS renders one formatted copy of `child` per item before the static `children`. Use `source: ""` when the ListContainer only groups static children. String fields in the dynamic child template are evaluated with `{$datum:...}` against the current source item, e.g. `{$datum:title}` or `{$datum:price.value}`. The web builder shows deterministic sample preview rows for the dynamic child template.
