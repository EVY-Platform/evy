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

Expression match (a request of this type exists for an item — self-comparison idiom):

```
{findFirst(messages, fk == item.id && data.value == pending).fk == item.id}
```

**The latest matching record.** The collection argument is function-aware, so it takes a `sort`
rather than only a binding key — which is how you ask for the most recent match rather than the
first stored one. This is what the item page uses to read a transfer method's current state:

```
{findFirst(sort(messages, desc, createdAt), fk == item.id && data.type == pickup).data.value}
```

Two things to know before relying on it. `sort` breaks equal keys by **original order regardless
of direction**, so the field has to be unique enough to order by — a `desc` sort over
second-resolution timestamps can return the older of two records written in the same second.
And a predicate that matches nothing yields an empty value, which compares unequal to every
literal; that is what lets "nothing yet" share a branch with any terminal state instead of
needing a case of its own.

Active match → its `fk` equals the item's id → `true`. No match (or all archived) → `""` →
`false`.

#### filter

Returns every element of a collection for which a predicate is true. Unlike `findFirst`, the
predicate binds the candidate as `$datum` (the same ephemeral-datum mechanism used by
format-with-`$datum`), not as bare fields. Nested `findFirst` / `sort` calls keep their own
bare-field binding for *their* candidates — so inside
`filter(messages, … findFirst(sort(messages, desc, createdAt), fk == $datum.fk && …) …)` the
bare `fk` is the inner `findFirst` candidate and `$datum` is the outer `filter` candidate.

```
filter({_collection_}, {_predicate_})
```

Open requests this device owns (the homepage "For you" tab source):

```
{filter(messages, $datum.data.value == "pending" && owns($datum.service, $datum.resource, $datum.fk) == true && findFirst(sort(messages, desc, createdAt), fk == $datum.fk && data.type == $datum.data.type).id == $datum.id)}
```

A non-collection first argument is an error. An empty match set is an empty array (not an empty
string). Cost note: a predicate that nests `findFirst(sort(…))` re-sorts per candidate; fine at
seed scale, not free at catalogue scale.

#### owns

Whether this device owns a record, as `"true"` / `"false"`. Reads
[`EVY.ownedServiceResources()`](../../ios/evy/Core/EVY+Ownership.swift): the creation ledger,
privately held synced rows, and the `EVY_OWNED_SERVICE_RESOURCES` launch override. There is no
`!` operator, so fixtures write `owns(…) == false`. Web has no ownership concept and stubs this
to `"false"`.

```
owns({_service_}, {_resource_}, {_id_})
```

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
