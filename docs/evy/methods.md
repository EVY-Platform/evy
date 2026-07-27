# Methods in EVY

> The normative behavioural reference is the conformance corpus at
> [`types/grammar/conformance.json`](../../types/grammar/conformance.json)
> (see its [README](../../types/grammar/README.md)). It is executed by both the
> Swift and TypeScript test suites, and records current behaviour — including
> known warts — as runnable vectors. Where this document and the corpus
> disagree, the corpus is what the clients actually do.

Methods are functions available to the user inside `{…}` expressions to compute data (as
opposed to [formatting functions](./formatting.md), which convert a value for display, or
[actions](./actions.md), which run side effects). Canonical implementations:
[`ios/evy/Utils/functions.swift`](../../ios/evy/Utils/functions.swift) and
[`web/app/utils/functions.ts`](../../web/app/utils/functions.ts).

Operand and path resolution rules used inside these functions' arguments are documented once,
in [comparisons.md](./comparisons.md#operand-resolution).

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

Returns the number of characters in a string argument. `length` is string-only: missing paths,
JSON `null`, arrays, and numbers all count as `0` — use [`count`](#count) for collections.

```
length({_variable_type_string_})
Variable: "Hello"
Output: 5
```

#### sort

Returns a new array sorted from a collection. Direction is `asc` or `desc`. With an optional
field path, sorts record arrays by that field; omit the field for scalar arrays (strings,
numbers). Sorting is stable. Missing or null keyed values are always placed last. Numeric
values compare numerically; strings compare lexicographically.

```
sort({_collection_}, asc)
sort({_collection_}, desc)
sort({_collection_}, asc, {_field_})
sort({_collection_}, desc, {_nested.field_})
```

Collection: `["2026-06-04T09:30:00", "2026-06-03T09:00:00"]`

`sort(collection, asc)` → `["2026-06-03T09:00:00", "2026-06-04T09:30:00"]`

ISO datetime strings in `yyyy-MM-ddTHH:mm:ss` form sort chronologically via lexicographic
comparison.

#### now

Returns the current date-time as an ISO 8601 UTC string. Use it to stamp date-time fields from
action data, e.g. `{archivedAt: now()}` in `update` changes (see [actions.md](./actions.md)).

```
now()
Output: 2026-07-17T03:12:45Z
```

#### findFirst

Finds the first datum in a collection. With one argument, returns the first element. With two
arguments and no comparison operators in the second, matches on the record `id` field (id
shorthand). With a boolean expression as the second argument, evaluates that expression against
each record and returns the first match. The returned datum can be chained with a property
accessor (`.value`, `.fk`, `.data.time`, …). Operand resolution and `null` handling inside the
expression form follow the [same rules as any other comparison](./comparisons.md).

```
findFirst({_collection_})
findFirst({_collection_}, {_id_})
findFirst({_collection_}, {_expression_})
```

Earliest timeslot from a scalar datetime array:

```
{findFirst(sort(item.pickup_selection, asc))}
```

Collection: `cc2e6c74-a53a-4ed1-97a7-14aa9b9a3e3f` = `[{ "id": "c1", "value": "Excellent" }, ...]`

Id match: `{findFirst(cc2e6c74-a53a-4ed1-97a7-14aa9b9a3e3f, item.condition_id).value}` → `"Excellent"`

Expression match (active message exists for an item — self-comparison idiom):

```
{findFirst(messages, fk == item.id && archivedAt == null).fk == item.id}
```

Active match → its `fk` equals the item's id → `true`. No match (or all archived) → `""` →
`false`.

#### if

Inline conditional expression. Evaluates `condition` as a [comparison](./comparisons.md), then
resolves and returns the `true` or `false` branch. A branch is either a quoted string literal
(returned verbatim, never resolved as a path) or an expression resolved the same way as any
other operand. An empty branch resolves to `""`.

```
if({_condition_}, {_true_branch_}, {_false_branch_})
if(item.status == "pending", "Awaiting pickup", item.status)
```

See [`evyIf`](../../ios/evy/Utils/functions.swift) for the reference implementation. Not yet
covered by the conformance corpus beyond an incidental note on quoted-operand handling
(`types/grammar/conformance.json`, comparison category) — treat detailed edge-case behaviour as
unverified until vectors are added.
