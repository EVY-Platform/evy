# Formatting in EVY

> The normative behavioural reference is the conformance corpus at
> [`types/grammar/conformance.json`](../../types/grammar/conformance.json)
> (see its [README](../../types/grammar/README.md)). It is executed by both the
> Swift and TypeScript test suites, and records current behaviour — including
> known warts — as runnable vectors. Where this document and the corpus
> disagree, the corpus is what the clients actually do.

Formatting functions convert an input into display text. For example formatting a date.

- Some default functions are available (e.g. `formatDecimal`) and some are composed and sent
  via JSON config to the clients.
- We need to avoid defining custom coded formatting functions in mobile clients as much as
  possible due to the constraints of mobile release cycles.
- `length`, `formatDimension`, and `formatWeight` below describe behavior as implemented in the iOS client today
  ([`ios/evy/Utils/functions.swift`](../../ios/evy/Utils/functions.swift)). Formatting
  functions here are the broader target model; web may still use stubs for some functions.

A formatting function does up to three things: decide which mobile keyboard to show, format
text from stored data, and format text as the user is typing.

## Built-in formatting functions

Hard-coded into the clients. Reference implementations:
[`ios/evy/Utils/functions.swift`](../../ios/evy/Utils/functions.swift) (numeric/dimension/weight
formatters) and [`ios/evy/Utils/EVYDatetime.swift`](../../ios/evy/Utils/EVYDatetime.swift) /
[`web/app/utils/datetime.ts`](../../web/app/utils/datetime.ts) (datetime tokens).

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
```

Input is an ISO 8601 / RFC 3339 string or a local ISO datetime string without a timezone (e.g.
`"2024-01-19T12:42:52"`). TimeslotPicker row content uses parser format strings such as
`{formatDatetime($datum, "EEE d")}` and `{formatDatetime($datum, "HH:mm")}`. Calendar row
content uses plain date/time patterns such as `EEE d` and `HH:mm`. Supported format tokens are
defined in [`EVYDatetime.swift`](../../ios/evy/Utils/EVYDatetime.swift) /
[`datetime.ts`](../../web/app/utils/datetime.ts) — do not duplicate the token table here.

#### formatDimension

```
formatDimension(_variable_type_number_) // millimetres (int or string that parses as Int)
Variable (display): 23240
Output: 23m

Variable (editing): 23240
Output: 23240
```

Display uses mm/cm/m thresholds; editing is plain millimetres with no suffix. See
[`functions.swift`](../../ios/evy/Utils/functions.swift) for the exact thresholds.

#### formatWeight

```
formatWeight(_variable_type_number_) // milligrams
Variable (display): 1500000
Output: 1.5kg

Variable (editing): 1500000
Output: 1500000
```

Display uses mg/g/kg thresholds; input accepts string, int, or decimal; editing is trimmed
numeric text with no suffix. See [`functions.swift`](../../ios/evy/Utils/functions.swift) for
the exact thresholds.

## Dynamic formatting functions

These are configured as synced `formatters` core resource rows (one row per function
name) and evaluated at runtime by web and iOS. Each formatter row has:

- `name` — expression function id, e.g. `formatCurrency` or `formatAddress`
- `formatting_config` — template resolved against the input object to choose a map key
  (e.g. `{input.currency}` or `{input.country}`)
- `formatting` — map of region key → display template. Keys are matched
  case-insensitively against the resolved config value. A `default` entry is used
  when the resolved key is missing.

Templates may call built-in formatters such as `{formatDecimal(input.value, 2)}` and
may interpolate `{input.field}` paths. Empty `{input.*}` segments are omitted and
leftover separators are tidied before display.

`formatCurrency` and `formatAddress` are dynamic. `formatAddressLine1` and
`formatAddressLine2` remain hard-coded helpers. While editing a currency field, clients
return the bare `value` string instead of running the display template.

```
formatCurrency(_variable_type_price_)
Variable: { "currency": "AUD", "value": "13.23" }
Outputs: $13.23

formatAddress(_variable_type_address_)
Variable: { "unit": "23-25", "street": "Rosebery Avenue", "city": "Rosebery",
            "postcode": "2018", "state": "NSW", "country": "Australia", "location": ... }
Outputs: 23-25 Rosebery Avenue, 2018 Rosebery NSW
```

`formatAddressLine1` renders `{unit} {street}`; `formatAddressLine2` renders
`{city}, {state} {postcode}`.

<details>
<summary>Sample formatter rows</summary>

```json
[
  {
    "id": "f1e2d3c4-b5a6-4789-8abc-def012345601",
    "name": "formatCurrency",
    "formatting_config": "{input.currency}",
    "formatting": {
      "AUD": "${formatDecimal(input.value, 2)}",
      "EUR": "€{formatDecimal(input.value, 2)}",
      "default": "${formatDecimal(input.value, 2)}"
    }
  },
  {
    "id": "f1e2d3c4-b5a6-4789-8abc-def012345602",
    "name": "formatAddress",
    "formatting_config": "{input.country}",
    "formatting": {
      "Australia": "{input.unit} {input.street}, {input.postcode} {input.city} {input.state}",
      "United States": "{input.unit} {input.street}, {input.city} {input.state} {input.postcode}",
      "default": "{input.unit} {input.street}, {input.postcode} {input.city} {input.state}"
    }
  }
]
```

</details>

## Destination object templates

Implemented in iOS. Row `destination` may be a plain data path or a **path + template**
object literal. On write, the client resolves the template with the user's typed or selected
value bound to `$datum`, then persists the result at the path key.

Template values resolve like nested create/update action values: quoted strings stay literal,
`$datum` is the write payload (coerced to int/decimal/string when appropriate), and bare words
are data paths when they resolve.

```
Destination pattern: {item.price: {value: $datum, currency: "AUD"}}
Typed text: "13.50"
Resulting data at item.price: { "currency": "AUD", "value": 13.50 }
```

The same object-literal syntax works in create/update `data`, `changes`, and `filter` when a
structured object is needed outside a row destination.
