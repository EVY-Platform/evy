# Functions in EVY

Functions are used to convert an input into a different output. For example formatting a date.

-   Some default functions are available (eg `formatDecimal`) and some are composed and sent via JSON config to the clients.
-   We need to avoid defining custom coded formatting functions in mobile clients as much as possible due to the constraints of mobile release cycles
-   `length`, `formatDimension`, `formatWeight`, and the Builder functions (`buildCurrency`, `buildAddress`) below describe behavior as implemented in the iOS client today ([`ios/evy/Utils/Functions.swift`](../../../ios/evy/Utils/Functions.swift)). Earlier sections in this file are the broader target model; web may still use stubs for some functions.

## Methods

These are methods available to the user to compute data

#### count

```
count({_variable_type_list_})
```

| Input type | Example input | Output | Behavior |
|-|-|-|-|
| Array | `[image1, image2]` | `2` | Counts elements |
| String | `"Hello"` | `5` | Character count |
| Int | `42` | `42` | Returns the number itself |
| Decimal | `3.14` | `3.14` | Returns the decimal itself |
| Missing / unresolvable path | `missing.key` | `0` | Strict resolution; `null` values also count as `0` |

#### length

Returns the number of characters in a string argument. Missing paths and JSON `null` count as `0`; other non-strings count as `0` (no raw-argument echo).

```
length({_variable_type_string_})
Variable: "Hello"
Output: 5
```

#### earliestDatetime

Returns the chronologically earliest local ISO datetime string from an array of timeslot strings. Sorts lexicographically (valid for `yyyy-MM-ddTHH:mm:ss` values). Empty or missing arrays return an empty string.

```
earliestDatetime({_variable_type_string_collection_})
Collection: ["2026-06-04T09:30:00", "2026-06-03T09:00:00"]
Output: 2026-06-03T09:00:00
```

#### now

Returns the current date-time as an ISO 8601 UTC string. Use it to stamp date-time fields from action data, e.g. `{archivedAt: now()}` in `update` changes.

```
now()
Output: 2026-07-17T03:12:45Z
```

#### findFirst

Finds the first datum in a collection that matches. With two arguments and no comparison operators in the second, matches on the record `id` field (id shorthand). With a boolean expression as the second argument, evaluates that expression against each record and returns the first match. The returned datum can be chained with a property accessor (`.value`, `.fk`, `.data.time`, …).

```
findFirst({_collection_}, {_id_})
findFirst({_collection_}, {_expression_})
```

**Operand resolution** (each side of an atomic comparison, first match wins):

1. **Record path** — property on the candidate record, including nested paths (`data.type`)
2. **Global data path** — `item.id`, resource UUIDs, etc.
3. **Unquoted literal** — bare words like `pending` / `accepted` (quotes are forbidden inside `{…}` blocks)

**`null`:** `archivedAt == null` / `archivedAt != null` match records where the path is **absent or JSON null**. Only `==` and `!=` are allowed with `null`. `null == null` is true.

**Limitations:** string literals in expressions must be unquoted; grouping parentheses may nest only one level inside the `findFirst(...)` call (same as other functions); use `==` not `=`.

Collection: `cc2e6c74-a53a-4ed1-97a7-14aa9b9a3e3f` = `[{ "id": "c1", "value": "Excellent" }, ...]`

Id match: `{findFirst(cc2e6c74-a53a-4ed1-97a7-14aa9b9a3e3f, item.condition_id).value}` → `"Excellent"`

Expression match (active message exists for an item — self-comparison idiom):

```
{findFirst(messages, fk == item.id && archivedAt == null).fk == item.id}
```

Active match → its `fk` equals the item's id → `true`. No match (or all archived) → `""` → `false`. Record-prop names that collide with global datum keys are theoretically possible but keys are UUIDs at runtime.

## Comparisons

Comparison expressions resolve to `true` or `false` in display text. They are used for conditional visibility, inline logic, and row filtering.

- **Comparison operators**: `==`, `!=`, `<`, `>`, `<=`, `>=`
- **Boolean combinators**: `||` (OR), `&&` (AND)
- **Grouping**: `()` (parentheses)

Both sides of a comparison are resolved as data paths, string literals, numbers, or nested function calls before comparing. Numeric values compare numerically; strings compare lexicographically.

```
{item.title == "Amazing"}
{count(item.photos) > 0}
{item.price > 100 && item.price < 500}
{(item.width == item.height) || item.type == "square"}
```

The `visible` field on rows uses these expressions natively. A row with `visible: "{item.enabled == true}"` only renders when the condition holds.

## Formatting functions

These are functions that do 3 things:

1. Decide on which mobile keyboard to show
2. Format text from data
3. Format text as the user is typing

Some of them are dynamic and some are built in (see following section)

### Formatting functions built in

Meaning they are hard coded into the clients

#### formatDecimal

```
formatDecimal(_variable_type_number_, 2)
Variable: 20.0423
Outputs: 20.04
```

#### formatMetricLength

```
formatMetricLength(_variable_type_number_) // Takes milimeters
Variable: 23240
Outputs: 23.24m
```

#### formatImperialLength

```
formatImperialLength(_variable_type_number_) // Takes milimeters
Variable: 4231
Outputs: 13.88ft
```

#### formatDuration

```
formatDuration(_variable_type_number_)
Variable: 900000
Outputs: 15 minutes
```

#### formatDatetime

```
formatDatetime(_variable_type_date_time_string_, "MM/dd/yyyy")
Variable: "2024-01-19T12:42:52.000Z"
Outputs: 01/19/2024

formatDatetime(_variable_type_date_time_string_, "HH:mm")
Variable: "2024-01-19T12:42:52.000Z"
Outputs: 12:42

formatDatetime(_variable_type_date_time_string_, "EEE do")
Variable: "2024-01-19T12:42:52.000Z"
Outputs: Sat 19th

formatDatetime(_variable_type_date_time_string_, "MMM")
Variable: "2024-01-19T12:42:52.000Z"
Outputs: Jan
```

Input is an ISO 8601 / RFC 3339 string or a local ISO datetime string without a timezone (e.g. `"2024-01-19T12:42:52"`). TimeslotPicker row content uses parser format strings such as `{formatDatetime($datum, "EEE d")}` and `{formatDatetime($datum, "HH:mm")}`. Calendar row content uses plain date/time patterns such as `EEE d` and `HH:mm`.

Supported format tokens:

| Token | Output | Example |
|-------|--------|---------|
| `yyyy` | 4-digit year | `2024` |
| `MMM` | Abbreviated month | `Jan` |
| `MM` | 2-digit month | `01` |
| `dd` | 2-digit day | `19` |
| `d` | Day without padding | `19` |
| `o` | Ordinal suffix for the day | `st`, `nd`, `rd`, `th` |
| `EEE` | Abbreviated weekday | `Sat` |
| `HH` | 24-hour hour, padded | `09` |
| `H` | 24-hour hour | `9` |
| `hh` | 12-hour hour, padded | `09` |
| `h` | 12-hour hour | `9` |
| `mm` | Minutes, padded | `30` |
| `a` | AM/PM | `AM` |


#### formatDimension

```
formatDimension(_variable_type_number_) // millimetres (int or string that parses as Int)
Variable (display): 23240
Output: 23m

Variable (editing): 23240
Output: 23240
```

Display: `mm` if ≤100, `cm` if 101–1000, `m` if >1000; `m`/`cm` use integer division of mm (e.g. 23240 → `23m`). Editing: plain millimetres, no suffix.

#### formatWeight

```
formatWeight(_variable_type_number_) // milligrams
Variable (display): 1500000
Output: 1.5kg

Variable (editing): 1500000
Output: 1500000
```

Display: `kg` if > 1_000_000 mg, `g` if >1000 mg, else `mg` (e.g. 1_000_000 mg → `1000g`). Input: string, int, or decimal. Editing: trimmed numeric text, no suffix.

### Dynamic formatting functions

These are formats that are configured by passing dynamic JSON, and using region or device configs. The sample code below shows the intended config shape; current clients hardcode the formatting (e.g. `formatCurrency` always uses `$`).

#### formatCurrency

```
formatCurrency(_variable_type_price_)
Variable: { "currency": "AUD", "value": "13.23" }
Outputs: $13.23
```

#### formatAddress

```
formatAddress(_variable_type_address_)
Variable: {
    "unit": "23-25"
    "street": "Rosebery Avenue",
    "city": "Rosebery",
    "postcode": "2018",
    "state": "NSW",
    "country": "Australia",
    "location": ...
}
```
Will render
```
{unit} {street}, {postcode} {city} {state}
```

#### formatAddressLine1

```
{unit} {street}
```

#### formatAddressLine2

```
{city}, {state} {postcode}
```

#### Sample code:

```
{
    "formatCurrency": {
        "input_type": "price",
        "keyboard": "numeric_detailed",
        "formatting_config": "{input.currency}",
        "formatting": {
            "aud": "$ {formatDecimal(input.value, 2)}",
            "eur": "€ {formatDecimal(input.value, 2)}"
        }
    },
    "formatDimension": {
        "input_type": "number",
        "keyboard": "numeric_detailed",
        "formatting_config": "{user.dimensions_system}",
        "formatting": {
            "metric": "{formatMetricLength(input)}",
            "imperial": "{formatImperialLength(input)}"
        }
    },
    "formatAddress": {
        "input_type": "address",
        "keyboard": "text",
        "formatting_config": "{input.country}",
        "formatting": {
            "au": "{input.unit} {input.street}, {input.city} {input.postcode} {input.state}",
            "us": "{input.unit} {input.street}, {input.city} {input.state} {input.postcode}"
        }
    },
    "formatAddressLine1": {
        "input_type": "address",
        "keyboard": "text",
        "formatting_config": "{input.country}",
        "formatting": {
            "au": "{input.unit} {input.street}",
            "us": "{input.unit} {input.street}"
        }
    },
    "formatAddressLine2": {
        "input_type": "address",
        "keyboard": "text",
        "formatting_config": "{input.country}",
        "formatting": {
            "au": "{input.city}, {input.state} {input.postcode}",
            "us": "{input.city}, {input.state} {input.postcode}"
        }
    }
}
```

## Builder functions

Implemented in iOS. These are not used inside `{…}` display strings the same way as formatters. They appear as the destination when persisting typed field text into structured data: the client parses the destination prop (e.g. `{buildCurrency(item.price)}`), passes the first argument as the prop path to the value being updated, and supplies the user’s typed string as the second input when committing the field (see [`ios/evy/EVY.swift`](../../../ios/evy/EVY.swift) `updateValue`).

#### buildCurrency

Builds a price JSON object `{ "currency", "value" }` from the current field text.

-   `currency`: taken from the existing value at the destination path when present; otherwise defaults to `"AUD"`.
-   `value`: parsed from the typed string (empty → empty string; otherwise int, decimal, or string as appropriate).

```
Destination pattern: {buildCurrency(item.price)}
Typed text: "13.50"
Resulting data: { "currency": "AUD", "value": "13.50" }  // shape; actual storage is JSON-encoded
```

#### buildAddress

Builds or updates an address object from multi-line or comma-separated typed text, merging with any existing address at the destination path (missing keys default to empty strings). Parsing supports two-line addresses, single-line comma forms, and simple street-only updates; see `evyAddressFields` / `evyParsedAddressFields` in [`ios/evy/Utils/Functions.swift`](../../../ios/evy/Utils/Functions.swift).

```
Destination pattern: {buildAddress(user.address)}
Typed text (example):
  "23-25 Rosebery Avenue, 2018\nRosebery, NSW"
Result: address dictionary with unit, street, city, postcode, state populated per parser rules
```

## Action functions

These run on the iOS client when a row action branch executes. See [sdui.md](./sdui.md) for the full action model.

#### create

```
{create(service_id, resource_id, data?, id_destination?)}
```

Creates a domain entity immediately. Inline `data` supports nested object values (e.g. `data: {type: pickup, time: selected_pickup_timeslot}`), quoted string literals (never resolved as data paths), bare `true`/`false` booleans, and `null`, or pass a whole-object data path (e.g. `pickup_address`). Optional fourth argument `id_destination` is a draft-aware write path; after create, the client writes the generated uuid string there (typically `{pickup_address.id}` on address pick). Linking the parent entity is a follow-up `update` action — same SDUI in create and edit flows; see the **Address save pattern** in [sdui.md](./sdui.md).

#### update

```
{update(service_id, resource_id, filter, changes)}
```

Updates matching domain entities immediately. Filter and changes values resolve like inline `create` data; `changes` may be a data path (whole draft object, with `id` stripped before merge) or a `{key: value}` object whose keys may use dotted nested paths (e.g. `transfer_options.pickup.address_id`). A filter value of `null` matches records where the property is absent or JSON `null`, and changes can call functions, e.g. `{archivedAt: now()}`. During a **create flow**, an `update` on the entity being created that matches no store row writes its changes into the create draft (picked up by submit `create`) instead of no-oping. For user confirmation, call `{show(a4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d)}` (or another sheet row ID) and run `update` from the sheet's confirm button.

#### show

```
{show(rowId)}
```

Presents the row with ID `rowId` in a sheet overlay. Requires exactly one non-empty ID; targets may live on any synced page. Unresolved IDs are errors. See [sdui.md](./sdui.md) for sheet layout and builder defaults.

#### select

```
{select(value)}
```

Asks the triggering row to select `value`. Usually `{select($datum)}` with the tapped unit as datum. Each row type defines what select means (toggle, write scalar, switch segment).

When the resolved value is an **array**, Calendar treats it as a batch toggle-all: if every item is already in the destination selection, remove them all; otherwise add every missing item (one destination write). Axis taps (`tap-row` / `tap-column`) pass `$datum` as the array of ISO datetime strings for that row or column, e.g. `{select($datum)}` on `tap-column` selects or clears an entire day.

Unsupported on rows without a select handler.

#### select_photo

```
{select_photo()}
```

Asks the triggering `SelectPhoto` row to present the iOS photo picker. Does not upload by itself — upload still runs after the user picks photos.

#### delete_photo

```
{delete_photo()}
```

Asks the triggering `SelectPhoto` row to delete the photo tile the user tapped. Typically wired to the row's `delete` trigger; authors can replace the default with a confirmation sheet before deleting.

#### expand_photo

```
{expand_photo()}
```

Asks the triggering `PhotoGallery` row to present the currently selected photo full screen.

#### expand_text

```
{expand_text(rowId)}
```

Expands the `TextExpand` row with ID `rowId`, wherever it is on screen. Requires exactly one non-empty row ID (same shape as `show`).
