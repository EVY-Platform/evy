# Server-driven UI

All UI in EVY is server-driven. On the API service we store the SDUI "flows" (see below) for all services and UX.

All attributes in SDUI are strings, and most are required.

## Flow

Flows represent a full user journey (eg: creating an item, placing an order, etc). They are needed to correctly submit data from a set of pages with a single end state.

The canonical shape matches `types/schema/sdui/evy.schema.json`:

```
{
    "id": "uuid",
    "name": "string",
    "pages": [PAGE]
}
```

## Page

A page is an single screen in a flow, for example step 1 in a booking flow.

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

-   All attributes can include:
    -   variables surrounded with curly braces: "Hello {name}, how are you?"
    -   inline icons as [Lucide](https://lucide.dev/icons) names in kebab-case, wrapped in double colons: "EVY ::image-plus:: is the best!"
-   [ x ]
    -   Denotes a type array of x
-   Objects and arrays
    -   When objects or arrays are interpolated (e.g. `{[resource_id].tags}`), the UI runtime resolves the binding to structured data (e.g. a JSON array of tag objects) before rendering—use the schema and client behavior for the exact shape, not a hand-written JSON fragment in the flow string.

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
        "max_lines": "string"    // optional (e.g. TextExpand)
    },
    // Where the row reads option/list/entity data from (required string; use "" if unused).
    "source": "string",
    // Where input data is stored in a draft. Use canonical resource IDs such as "{[resource_id].title}".
    "destination": "string",

    // Visibility predicate. Use "true" for always shown, or a condition expression to render only when it evaluates to true.
    "visible": "string",

    // Actions are required on every row and default to an empty array
    "actions": [{
        "condition": "{length(title) > 0}",
        "false": "{highlight_required(title)}",
        "true": "{create([service_id],[resource_id])}"
    }]
}
```

### Actions

Each row has an `actions` attribute which is an array of `UI_RowAction` objects that can trigger various actions if a condition is met or not met.



#### Conditions

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
| `create(service_id, resource_id)` | Submit / create domain entity, e.g. `{create([service_id],[resource_id])}` |
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
	"true": "{navigate([flow_id],[page_id])}"
}
```

Navigate with query params (selects an entity from synced data):

```json
{
	"condition": "",
	"false": "",
	"true": "{navigate([flow_id],[page_id],{id: $datum.id})}"
}
```

OR condition with navigate on success:

```json
{
	"condition": "{count(pickup_selection) > 0 || count(delivery_selection) > 0 || count(shipping_destination_areas) > 0}",
	"false": "{highlight_required(pickup_selection)}",
	"true": "{navigate([flow_id],[another_page_id])}"
}
```

Submit:

```json
{
	"condition": "",
	"false": "",
	"true": "{create([service_id],[resource_id])}"
}
```

The web app’s action editor (`web/app/utils/actionHelpers.ts`, `ActionEditor`, `ActionPopup`) uses the same condition and branch formats for authoring.

#### Row visibility (`visible`)

Required top-level row field. Use `"true"` for rows that should always show, or a condition expression to render only when it evaluates to `true`. Use the same condition syntax as action `condition` fields (`==`, `!=`, `&&`, `||`, parentheses, `count()`, `length()`).

```json
{
	"type": "Text",
	"visible": "{[resource_id].payment_methods.cash == true}",
	"view": { "content": { "title": "Cash accepted" } }
}
```

iOS evaluates `visible` reactively when bound data changes. The web builder stores and previews the field (conditional rows appear dimmed when the expression cannot be evaluated without live data).

### Rows

Row types are defined in the schema (`types/schema/sdui/evy.schema.json`) and their content keys in `types/schema/sdui/row-content.spec.json`. Supported types:

| Category   | Row types |
| ---------- | --------- |
| View       | Text, TextAction, TextExpand, InputList, ListItem, PhotoGallery, Map |
| Edit       | Calendar, Dropdown, InlinePicker, Input, Search, SelectPhoto, TextArea, TextSelect, TimeslotPicker |
| Action     | Button |
| Container  | ColumnContainer, ListContainer, SelectSegmentContainer |

Each row type’s `view.content` may include type-specific keys (e.g. `label`, `value`, `placeholder`, `format`, `child`, `children`). `Text` supports compact `title`/`subtitle`/`label` display, `TextAction` supports `title`/`subtitle`/`action`, and `TextExpand` supports `title`/`text`/`expandLabel` with `view.max_lines`. See `row-content.spec.json` for the exact keys per type.

For list-backed rows (Dropdown, InlinePicker, InputList, etc.), `format` is evaluated per item from the list resolved via `source`. Use `{$datum.}` as the placeholder for the current item, e.g. `{$datum.value}` or `{$datum.unit} {$datum.street}, {$datum.city}`.

For **ListItem** rows, `view.content.image` must be a string expression that resolves to an EVY file ID (e.g. `"{[resource_id].photo_ids.0}"`). iOS fetches the binary from `evy:files` using `EVYRemoteFile` and clips it to a rounded square. `title` and `subtitle` are displayed beside the image. The web builder renders a gray placeholder in place of the image.

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

For **PhotoGallery** rows, `source` resolves to an array of EVY file IDs for photos (e.g. `source: "{[resource_id].photo_ids}"`). iOS fetches each binary separately from `evy:files` using those IDs and persists downloaded bytes under `applicationSupportDirectory/Files/`. The web builder shows the EVY logo placeholder.

For **ListContainer** rows, `view.content.children` remains the static list of rows displayed by the container. `view.content.child` is optional and acts as a dynamic template: when the ListContainer `source` resolves to an array, iOS renders one formatted copy of `child` per item before the static `children`. Use `source: ""` when the ListContainer only groups static children. String fields in the dynamic child template are evaluated with `{$datum.}` against the current source item, e.g. `{$datum.title}` or `{$datum.price.value}`. The web builder shows deterministic sample preview rows for the dynamic child template.

For **Calendar** and **TimeslotPicker** rows, selected timeslots are ISO-datetime strings (e.g. `"2024-09-18T09:30:00"`). `Calendar` reads selections from `view.content.primary` and `view.content.secondary`; `TimeslotPicker` reads available timeslots from `source`. Both rows use parser-based datetime format strings. `Calendar` uses `header_format` to format each column header and `timeslot_format` for y-axis labels; recommended values are `"{formatDatetime($datum, \"EEE d\")}"` and `"{formatDatetime($datum, \"HH:mm\")}"`. `TimeslotPicker` uses `header_format` for the primary header line, `header_subtitle` for the secondary header line, and `timeslot_format` for slot labels; recommended values are `"{formatDatetime($datum, \"EEE\")}"`, `"{formatDatetime($datum, \"MMM do\")}"`, and `"{formatDatetime($datum, \"HH:mm\")}"`. TimeslotPicker only shows dates that have at least one entry in `source`.






-----



- Each row declares a **`source`** string at the row root (next to `destination`) describing where the row **reads** data from. Use a non-empty source only for rows that load source-driven data such as option lists, search results, or calendars. If a row already reads explicit fields like `"{[resource_id].title}"` in `view.content`, the row source should be `""` because the binding resolves the resource directly.
	- `"{[resource_id]}"`, `"{tags}"` — plural backend resource or in-memory keys the client resolves to option lists or entity arrays. Search and dynamic ListContainer rows read the resource named by `source`.
	- `"{$local:address}"` — client-local source.
	- `""` — no external read binding (e.g. edit rows whose data is driven by `destination`, display rows using explicit bindings like `"{[resource_id].title}"`, pure navigation buttons, static Text, and containers that only group static child rows).
- Edit rows write into a draft via **`destination`**. Draft destinations start with the canonical resource ID, for example `"{[resource_id].title}"`, `"{[resource_id].condition}"`, or `"{buildCurrency([resource_id].price)}"`. The prefix tells the UI which resource draft owns the field.
- Braced `{...}` expressions are used for all SDUI bindings. Prefixed bindings use either dot or colon notation depending on the prefix:
	- `{$datum.field}` — dot notation. Current list/search result item field, used in row `format` strings and Search result templates.
	- `{$local:resource}` — colon notation. Client-local source (resolves to the private data store).
	- `{$api:resource}` — colon notation. Explicit API-sourced data (resolves to the public data store, same as a bare key but explicit about origin).
- Resource/local data is loaded outside the flow document. Clients request individual lists with public JSON-RPC `get` (`service` / `resource`) using optional `filter.id` or `filter.updatedAfter`, call method-backed reads with public JSON-RPC `api`, or sync changed data in batches with protected JSON-RPC `sync`.
- `sync` accepts a `lastSyncTime` ISO-8601 timestamp and returns changed resource arrays as `{ service, resource, value }` rows across SDUI, evy core data, and backend service data. For startup/cache refresh, the API fetches every syncable resource using `filter.updatedAfter = lastSyncTime`. Auth-only `devices` rows are excluded from sync.
- Clients should store synced rows under service-qualified keys such as `[evy_service_id]:sdui`, `[marketplace_service_id]:[items_resource_id]`, and `[marketplace_service_id]:[conditions_resource_id]`. External runtime resource references use `serviceResources.id`; `serviceResources.name` is display-only metadata for human-friendly web builder labels. Web may derive plural labels with pluralizeJS at display time, but stored names are never routing keys. Navigate actions pass query params as the optional third `navigate` argument using a plain-text query object (for example, `{navigate(flowId, pageId, {id: $datum.id})}`). Query values can be scalars (`{key: id}`) or arrays (`{key: [id-1, id-2]}`). Clients parse the query into a `[String: [String]]` dictionary, resolve the first ID for each resource key from the synced collection, and expose the matching entity under the same resource key. A generic `"id"` query key may be used by clients that can infer the resource from synced collections. If no synced collection exists for a query key, clients keep the raw string array under that key.
- iOS draft scope IDs and draft cache keys are internal draft-store identifiers; see [iOS README § Draft scopes and draft cache keys](../../../ios/README.md#draft-scopes-and-draft-cache-keys).
- Collection/list sources and direct entity/draft attributes use canonical resource IDs (for example, `{[resource_id]}` and `{[resource_id].title}`). iOS and runtime clients resolve those IDs directly from synced data. The web builder keeps those canonical IDs in stored SDUI, but renders them with display-only resource labels from `serviceResources` (for example, `item.title`) when previewing or editing text. Legacy plural and singular resource names may still resolve for local data backwards compatibility, but new SDUI should use resource IDs.
- `evy` resource data uses [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json); marketplace resources are served by the marketplace worker ([`services/marketplace`](../../../services/marketplace/README.md)). Routing and persistence are described in [`api/README`](../../../api/README.md). Clients merge loaded data with flow state when rendering rows (e.g. Dropdown, InlinePicker, Search, InputList).

So a flow might reference “10 min, 20 min, 30 min” options via `source: "{[resource_id]}"` while the selected value is written to `destination: "{[resource_id].distance}"`; the actual list of options lives in the data layer the app fetches, not inside the flow document.
