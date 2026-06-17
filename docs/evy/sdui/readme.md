# Server-driven UI (UI types)

UI flows (`UI_Flow`) only describe structure: `id`, `name`, and `pages`. Reference data (dropdown options, tags, durations, etc.) is not embedded inside the flow JSON.

- Each row declares a required **`source`** string at the row root (next to `destination`) describing where the row **reads** data from. Use a non-empty source only for rows that load source-driven data such as option lists, search results, or calendars. If a row already reads explicit fields like `"{item.title}"` in `view.content`, the row source should be `""` because the binding resolves the resource directly.
	- `"{conditions}"`, `"{selling_reasons}"`, `"{durations}"`, `"{areas}"`, `"{tags}"`, `"{items}"` — plural backend resource or in-memory keys the client resolves to option lists or entity arrays. Search and dynamic ListContainer rows read the resource named by `source`.
	- `"{$local:address}"` — client-local source.
	- `""` — no external read binding (e.g. edit rows whose data is driven by `destination`, display rows using explicit bindings like `"{item.title}"`, pure navigation buttons, static Text, and containers that only group static child rows).
- Edit rows write into a draft via **`destination`**. Draft destinations always start with the singular entity key, for example `"{item.title}"`, `"{item.condition}"`, or `"{buildCurrency(item.price)}"`. The prefix tells the UI which resource draft owns the field.
- Braced `{...}` expressions are used for all SDUI bindings. Prefixed bindings use either dot or colon notation depending on the prefix:
	- `{$datum.field}` — dot notation. Current list/search result item field, used in row `format` strings and Search result templates.
	- `{$local:resource}` — colon notation. Client-local source (resolves to the private data store).
	- `{$api:resource}` — colon notation. Explicit API-sourced data (resolves to the public data store, same as a bare key but explicit about origin).
- Resource/local data is loaded outside the flow document. Clients can inspect the combined service/resource registry with the public JSON-RPC `resources` method, request individual lists with public JSON-RPC `get` (`service` / `resource`) using optional `filter.id` or `filter.updatedAfter`, call method-backed reads with public JSON-RPC `api`, or sync all changed data in batches with protected JSON-RPC `sync`.
- `sync` accepts `{ "lastSyncTime": "ISO-8601 timestamp" }` and returns changed resource arrays as `{ service, resource, value }` rows across SDUI, evy core data, and backend service data. When data changed, it also returns the current resource registry. For startup/cache refresh, the API fetches every syncable resource using `filter.updatedAfter = lastSyncTime`. Auth-only `devices` rows are excluded from sync.
- Clients should store synced rows under service-qualified keys such as `evy:sdui`, `marketplace:items`, and `marketplace:conditions`. The `resources.resourcesByService` registry tells clients which service owns each plural resource. Navigate actions pass query params as the optional third `navigate` argument using a plain-text query object (for example, `{navigate(flowId, pageId, {id: $datum.id})}`). Query values can be scalars (`{key: id}`) or arrays (`{key: [id-1, id-2]}`). Clients parse the query into a `[String: [String]]` dictionary, resolve the first ID for each resource key from the synced collection, and expose the matching entity under the same plural key. A generic `"id"` query key may be used by clients that can infer the resource from synced collections. If no synced collection exists for a query key, clients keep the raw string array under that key.
- iOS draft scope IDs and draft cache keys are internal draft-store identifiers; see [iOS README § Draft scopes and draft cache keys](../../../ios/README.md#draft-scopes-and-draft-cache-keys).
- Collection/list sources remain plural (for example, `{items}`, `{conditions}`, `{tags}`); direct entity/draft attributes use singular keys such as `{item.title}` and `{create(marketplace,item)}`. iOS pluralizes the singular entity key into a backend resource name using Swift inflection. The client data layer resolves collection bindings to synced service data when no exact local key exists. Exact local keys still take precedence for selected entities, drafts, and flow state.
- `evy` resource data uses [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json); marketplace resources are served by the marketplace worker ([`services/marketplace`](../../../services/marketplace/README.md)). Routing and persistence are described in [`api/README`](../../../api/README.md). Clients merge loaded data with flow state when rendering rows (e.g. Dropdown, InlinePicker, Search, InputList).

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
            // Optional array of children rows to display
            "children": [ROW],
            // Optional single child row to display
            "child": ROW,
            ...
        },
        "max_lines": "string"    // optional (e.g. Text)
    },
    // Where the row reads option/list/entity data from (required string; use "" if unused).
    "source": "string",
    // Where input data is stored in a draft. Use singular entity keys such as "{item.title}".
    "destination": "string",

    // Visibility predicate. Use "true" for always shown, or a condition expression to render only when it evaluates to true.
    "visible": "string",

    // Actions are required on every row and default to an empty array
    "actions": [{
        "condition": "{length(title) > 0}",
        "false": "{highlight_required(title)}",
        "true": "{create(marketplace,item)}"
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
	`{count(pickup_selection) > 0 || count(delivery_selection) > 0 || count(shipping_destination_areas) > 0}`
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
| `create(namespace, resource)` | Submit / create domain entity, e.g. `{create(marketplace,item)}` |
| `navigate(flowId, pageId, queryParams?)` | Go to a page within a flow, e.g. `{navigate(flowId, pageId)}`. Pass query params as the optional third argument using a plain-text query object, e.g. `{navigate(flowId, pageId, {id: $datum.id})}`. |
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
	"true": "{navigate(ca47e6c5-da19-4491-8422-adb40d9e8a27,06b21b52-0845-468a-ace1-170a3b05f3a2,{id: $datum.id})}"
}
```

OR condition with navigate on success:

```json
{
	"condition": "{count(pickup_selection) > 0 || count(delivery_selection) > 0 || count(shipping_destination_areas) > 0}",
	"false": "{highlight_required(pickup_selection)}",
	"true": "{navigate(ca47e6c5-da19-4491-8422-adb40d9e8a27,25a3269b-344c-477d-89c8-b2f5426a5d91)}"
}
```

Submit:

```json
{
	"condition": "",
	"false": "",
	"true": "{create(marketplace,item)}"
}
```

The web app’s action editor (`web/app/utils/actionHelpers.ts`, `ActionEditor`, `ActionPopup`) uses the same condition and branch formats for authoring.

#### Row visibility (`visible`)

Required top-level row field. Use `"true"` for rows that should always show, or a condition expression to render only when it evaluates to `true`. Use the same condition syntax as action `condition` fields (`==`, `!=`, `&&`, `||`, parentheses, `count()`, `length()`).

```json
{
	"type": "Text",
	"visible": "{item.payment_methods.cash == true}",
	"view": { "content": { "title": "Cash accepted" } }
}
```

iOS evaluates `visible` reactively when bound data changes. The web builder stores and previews the field (conditional rows appear dimmed when the expression cannot be evaluated without live data).

### Rows

Row types are defined in the schema (`types/schema/sdui/evy.schema.json`) and their content keys in `types/schema/sdui/row-content.spec.json`. Supported types:

| Category   | Row types |
| ---------- | --------- |
| View       | Text, InputList, PhotoGallery, Map |
| Edit       | Calendar, Dropdown, InlinePicker, Input, Search, SelectPhoto, TextArea, TextSelect, TimeslotPicker |
| Action     | Button |
| Container  | ColumnContainer, ListContainer, SelectSegmentContainer |

Each row type’s `view.content` may include type-specific keys (e.g. `label`, `value`, `placeholder`, `format`, `child`, `children`). `Text` supports compact `title`/`subtitle`/`icon` display and longer text display with `text`, `placeholder`, `action`, and `view.max_lines`. See `row-content.spec.json` for the exact keys per type.

For list-backed rows (Dropdown, InlinePicker, InputList, etc.), `format` is evaluated per item from the list resolved via `source`. Use `{$datum.}` as the placeholder for the current item, e.g. `{$datum.value}` or `{$datum.unit} {$datum.street}, {$datum.city}`.

For **Search** rows, iOS reads the data array from `source`, renders each hit using `view.content.child` (typically a `Text` row template) instead of `format`, and filters locally using rendered child display strings (`title`, `subtitle`, `text`, `label`, `placeholder`, and `value`). String fields in that child row are evaluated with `{$datum.}` the same way. Tapping a result runs actions from the rendered child row with that datum in scope. The web builder shows deterministic preview results for the child template, but it does not fetch or filter live data.

For **Map** rows, `view.content.location` must be a string, usually a binding such as `"{address.location}"`. iOS resolves the string binding as data and places a native map pin when the resolved object has required `latitude` and `longitude` numbers, for example `{ "latitude": -33.8688, "longitude": 151.2093 }`. Raw location objects in SDUI, `lat`/`lng`, nested `coordinate` objects, coordinate strings, and geocoded address strings are not part of v1.

```json
{
	"id": "uuid",
	"type": "Map",
	"source": "",
	"destination": "",
	"actions": [],
	"view": {
		"content": {
			"title": "Pickup location",
			"location": "{address.location}",
			"subtitle": "Meet near the main entrance"
		}
	}
}
```

For **SelectPhoto** rows, iOS uploads selected photo data to the evy core `files` resource with file `type` metadata and writes the returned file id into the row's draft destination. Marketplace item flows store those IDs in fields such as `photo_ids`; binary data is loaded separately from `evy:files`.

For **PhotoGallery** rows, `source` resolves to an array of EVY file IDs for photos (e.g. `source: "{item.photo_ids}"`). iOS fetches each binary separately from `evy:files` using those IDs and persists downloaded bytes under `applicationSupportDirectory/Files/`. The web builder shows the EVY logo placeholder.

For **ListContainer** rows, `view.content.children` remains the static list of rows displayed by the container. `view.content.child` is optional and acts as a dynamic template: when the ListContainer `source` resolves to an array, iOS renders one formatted copy of `child` per item before the static `children`. Use `source: ""` when the ListContainer only groups static children. String fields in the dynamic child template are evaluated with `{$datum.}` against the current source item, e.g. `{$datum.title}` or `{$datum.price.value}`. The web builder shows deterministic sample preview rows for the dynamic child template.

For **Calendar** and **TimeslotPicker** rows, selected timeslots are ISO-datetime strings (e.g. `"2024-09-18T09:30:00"`). `Calendar` reads selections from `view.content.primary` and `view.content.secondary`; `TimeslotPicker` reads available timeslots from `source`. Both rows use parser-based datetime format strings. `Calendar` uses `header_format` to format each column header and `timeslot_format` for y-axis labels; recommended values are `"{formatDatetime($datum, \"EEE d\")}"` and `"{formatDatetime($datum, \"HH:mm\")}"`. `TimeslotPicker` uses `header_format` for the primary header line, `header_subtitle` for the secondary header line, and `timeslot_format` for slot labels; recommended values are `"{formatDatetime($datum, \"EEE\")}"`, `"{formatDatetime($datum, \"MMM do\")}"`, and `"{formatDatetime($datum, \"HH:mm\")}"`. TimeslotPicker only shows dates that have at least one entry in `source`.
