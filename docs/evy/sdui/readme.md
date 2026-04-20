# Server-driven UI (UI types)

**See also:** [Repository README](../../README.md) (architecture, setup), [API](../../api/README.md) (JSON-RPC and gRPC routing), [Types](../types.md) (codegen, schema layout).

## Data

UI flows (`UI_Flow`) only describe structure: `id`, `name`, and `pages`. Reference data (dropdown options, tags, durations, etc.) is not embedded inside the flow JSON.

- Each row declares a required **`source`** string at the row root (next to `destination`) describing where the row **reads** data from when rendering or editing:
	- `"{item}"` — bind to the current flow entity / draft (e.g. listing fields, `{formatWeight(weight)}`, `{item.title}`).
	- `"{conditions}"`, `"{selling_reasons}"`, `"{durations}"`, `"{areas}"`, `"{tags}"` — catalog or in-memory keys the client resolves to option lists.
	- `"{api:tags}"` — remote search / API-backed data.
	- `"local:address"` — client-local data source.
	- `""` — no external read binding (e.g. pure navigation buttons, static Info).
- That catalog/API/local data is loaded separately via JSON-RPC `get` (`service` / `resource`); routing and persistence are described in [`api/README`](../../api/README.md). `evy` catalog data uses [`types/schema/data/data.schema.json`](../../../types/schema/data/data.schema.json); marketplace resources are served by the marketplace worker ([`services/marketplace`](../../services/marketplace/README.md)). Clients merge loaded data with flow state when rendering rows (e.g. Dropdown, InlinePicker, Search, InputList).

So a flow might reference “10 min, 20 min, 30 min” options via `source: "{durations}"` while the selected value is still written to a field via `destination`; the actual list of options lives in the data layer the app fetches, not inside the flow document.

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

Each row has an `actions` array of `UI_RowAction` objects (`condition`, `false`, `true` are strings). The web builder persists them; execution is client-specific (see **Evaluation** below for iOS).

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
| `navigate(flowId, pageId)` | Go to a page within a flow (UUIDs as in `docs/services/service_sdui.json`). iOS also accepts a colon-separated form (e.g. `navigate:flowId:pageId`)—see `EVYActionRunner` tests. |
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

For list-backed rows (Dropdown, InlinePicker, Search, InputList, etc.), `format` is evaluated per item from the list resolved via `source`. Use `datum` as the placeholder for the current item in expressions, e.g. `{datum.value}` or `{datum.unit} {datum.street}, {datum.city}`.
