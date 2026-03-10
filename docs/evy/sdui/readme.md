# SDUI

## Data

Whenever flows are sent to a client app, any static data that is necessary is also passed. For example, the values of "10 min, 20 min, 30 min" for the distance that someone is willing to travel to to deliver an item is passed in along with the flows for items, along with a UUID which identifies that data within the UI data.

```
{
    _flow1_
        _pages_
            _rows_
    _flow2_
        _pages_
            _rows_
    ...
    _data_: {
        "254190d9-0a99-43d0-a3c2-f222bdec1893": [{
            "id": "68e52916-7a07-4a07-ae0c-52e7800b9b9f",
            "value": "5 min",
        },{
            "id": "8e1cd2bf-d94f-4bb0-bd68-fc74434deabe",
            "value": "10 min",
        },{
            "id": "1eedac33-eb0b-4796-9853-50ad4036179f",
            "value": "15 min",
        },{
            "id": "69f25102-822c-436c-a6c1-3b49f887355e",
            "value": "30 min",
        }]
    }
}
```

## Flow

Flows are not visually used in the UI but represent a full user journey (eg: creating an item)  
They are needed in order to submit all fields of all pages of a flow at the end upon clicking a single button on a page

```
{
    "id": "uuid",
    "name": "string",

    // Which service the flow belongs to, eg "marketplace"
    // This is not used on the client apps, only server-side
    "service",

    // The type of flow: "create" | "read" | "update" | "delete"
    "type",

    // What is the data that the page is acting on, eg "item"
    "data": "model_name",

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

Rows are what are put into pages. They are the building block of the EVY SDUI framework

### Base features

-   All values are strings, there are no types as this is dynamic on the apps
    -   eg: "title": "My title", could also be "title": "{item.title}"
-   All strings can include:
    -   **variables** surrounded with curley braces: "Hello {name}, how are you?"
    -   **icons** surrounded with double colons: "EVY ::evy_icon:: is the best!"
    -   **emojis** prefixed with a colon: "I like :dog a lot"
-   [ x ]
    -   Denotes a type array of x
-   Objects and arrays
    -   When objects or arrays are passed into a prop of content, they are parsed fully by the SDUI framework. Eg: "{item.tags}" will become "[{id": a, "value": "Furniture"}, {id": a, "value": "Chair"}]"

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
    // They are evaluated in order until one executes a non-empty branch
    "actions": [{
        "condition": "{length(title) > 0}",
        "false": "{highlight_required(title)}",
        "true": "{create(item)}"
    }]
}
```

### Rows

Row types are defined in the schema (`types/schema/sdui/evy.schema.json`) and their content keys in `types/schema/sdui/row-content.spec.json`. Supported types:

| Category   | Row types |
| ---------- | --------- |
| View       | Info, Text, InputList |
| Edit       | Input, TextArea, TextSelect, Dropdown, InlinePicker, Search, SelectPhoto, Calendar |
| Action     | Button, TextAction |
| Container  | ColumnContainer, ListContainer, SheetContainer, SelectSegmentContainer |

Each row type’s `view.content` may include type-specific keys (e.g. `label`, `value`, `placeholder`, `format`). See `row-content.spec.json` for the exact keys per type.
