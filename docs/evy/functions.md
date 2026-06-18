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

#### length

Returns the number of characters in a string argument. Non-strings fall through to the raw argument text (no numeric “length”).

```
length({_variable_type_string_})
Variable: "Hello"
Output: 5
```

#### findFirst

Finds the first datum in a collection whose `id` field matches the given identifier. For external service data, pass the service resource ID as the collection key. The returned datum can be chained with a property accessor.

```
findFirst({_variable_type_string_collection_}, {_variable_type_string_id_})
Collection: cc2e6c74-a53a-4ed1-97a7-14aa9b9a3e3f = [{ "id": "c1", "value": "Excellent" }, ...]
Id variable: "c1"
Output: {findFirst(cc2e6c74-a53a-4ed1-97a7-14aa9b9a3e3f, item.condition_id).value} → "Excellent"
```

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

Input is an ISO 8601 / RFC 3339 string or a local ISO datetime string without a timezone (e.g. `"2024-01-19T12:42:52"`). Calendar and TimeslotPicker row content use this through parser format strings such as `{formatDatetime($datum, "EEE d")}` and `{formatDatetime($datum, "HH:mm")}`.

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
Outputs: 23-25 Rosebery Avenue, 2018 Rosebery NSW
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
            "au": "{input.city} {input.postcode} {input.state}",
            "us": "{input.city} {input.state} {input.postcode}"
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
