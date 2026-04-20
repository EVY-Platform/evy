# Server-driven UI (UI types)

## Data

UI flows (`UI_Flow`) only describe structure: `id`, `name`, and `pages`. Reference data (dropdown options, tags, durations, etc.) is not embedded inside the flow JSON.

- Rows that need a data source set `view.data` to a string that typically references a variable or API/local source, for example:
	- `"{conditions}"` — bind to data the client already has under that key
	- `"{api:tags}"` — remote search / API-backed data
	- `"local:address"` — client-local data source
- That data is loaded separately: clients call JSON-RPC `get` with `service` and `resource` (e.g. `service: "evy"`, `resource: "sdui"` for flows; catalog lists use `service: "marketplace"` and plural resources like `conditions`, `items`). The API serves `evy` data from typed `DATA_EVY_*` persistence (see [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json)); marketplace rows live in the marketplace worker behind gRPC. Clients merge loaded data with flow state when rendering rows (e.g. Dropdown, InlinePicker, Search, InputList).

So a flow might reference “10 min, 20 min, 30 min” options via `view.data` and a variable like `{durations}`; the actual list of options lives in the data layer the app fetches, not inside the flow document.

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
    -   variables surrounded with curley braces: "Hello {name}, how are you?"
    -   icons surrounded with double colons ([Lucide](https://lucide.dev/icons) names in kebab-case): "EVY ::image-plus:: is the best!"
    -   emojis prefixed with a colon: "I like :dog a lot"
-   [ x ]
    -   Denotes a type array of x
-   Objects and arrays
    -   When objects or arrays are passed into a prop of content, they are parsed fully by the UI runtime. Eg: "{item.tags}" will become "[{id": a, "value": "Furniture"}, {id": a, "value": "Chair"}]"

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
        // Optional. A string (e.g. template or data reference) for rows that need data (dropdowns, search).
        "data": "string",
        "max_lines": "string"    // optional
    },
    // Where the input data is stored (optional, used by edit rows)
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

Each row has an `actions` array of `UI_RowAction` objects: `condition`, `false`, and `true` are all strings. On the client (e.g. iOS), actions are evaluated in order until a branch runs that does something non-trivial; the web builder edits the same strings and persists them on the row.

#### Conditions

- Wrap the whole condition in curly braces: `{ ... }`.
- Empty `condition` — treated as always true (the `true` branch is taken unless you rely on client-specific rules).
- Single comparison: `{left op right}`  
	Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`  
	Left and right operands are usually variable names or literals (client interprets values).
- OR: join comparisons with `||` inside the braces:  
	`{count(pickup_timeslots) > 0 || count(delivery_timeslots) > 0 || count(shipping_destination_areas) > 0}`
- Condition helpers (used like functions in the expression):
	- `count(var)` — e.g. `{count(photo_ids) > 0}`
	- `length(var)` — e.g. `{length(title) > 0}`

#### Branches (`true` / `false`)

Each branch is a string. Empty string means “do nothing” for that branch.

- Literal `close` — no braces — closes the current screen/flow step.
- Function call form: `{functionName(arg1, arg2, ...)}`

Supported action functions:

| Function | Meaning |
| -------- | ------- |
| `close` | Close current UI (same as bare `close` in simple cases) |
| `create(model)` | Submit / create domain entity, e.g. `{create(item)}` |
| `navigate(flowId, pageId)` | Go to a page within a flow (UUIDs as in `docs/services/service_sdui.json`) |
| `highlight_required(field)` | Mark a field as required / show validation, e.g. `{highlight_required(title)}` |

#### Evaluation (typical client behavior)

1. For each action in order, evaluate `condition`.
2. If the condition is false, run the `false` branch (if non-empty).
3. If the condition is true, run the `true` branch (if non-empty).
4. Stop when the client has applied a meaningful outcome (exact stopping rules are client-specific; the builder uses the same strings for storage).

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

Each row type’s `view.content` may include type-specific keys (e.g. `label`, `value`, `placeholder`, `format`). See `row-content.spec.json` for the exact keys per type.

For list-backed rows (Dropdown, InlinePicker, Search, InputList, etc.), `format` is evaluated per item from `view.data`. Use `datum` as the placeholder for the current item in expressions, e.g. `{datum.value}` or `{datum.unit} {datum.street}, {datum.city}`.
