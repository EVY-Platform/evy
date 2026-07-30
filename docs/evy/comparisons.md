# Comparisons in EVY

> The normative behavioural reference is the conformance corpus at
> [`types/grammar/conformance.json`](../../types/grammar/conformance.json)
> (see its [README](../../types/grammar/README.md)). It is executed by both the
> Swift and TypeScript test suites, and records current behaviour — including
> known warts — as runnable vectors. Where this document and the corpus
> disagree, the corpus is what the clients actually do.

Comparison expressions resolve to `true` or `false` in display text. They are used for
conditional visibility, inline logic, and row filtering (`visible`, `actions[].condition`,
[`findFirst`](./methods.md#findfirst) expression matches).

- **Comparison operators**: `==`, `!=`, `<`, `>`, `<=`, `>=`
- **Boolean combinators**: `||` (OR), `&&` (AND)
- **Grouping**: `()` (parentheses) — grouping parentheses may nest only one level deep, same
  as function argument lists.
- Numeric values compare numerically; strings compare lexicographically.

```
{item.title == Amazing}
{item.status == "in progress"}
{count(item.photos) > 0}
{item.price > 100 && item.price < 500}
{(item.width == item.height) || item.type == square}
```

Boolean literals are valid as standalone conditions: `{true}` and `{false}` evaluate directly
without a comparison operator.

The `visible` field on rows uses these expressions natively. A row with
`visible: "{item.enabled == true}"` only renders when the condition holds.

## Operand resolution

Each side of an atomic comparison is resolved in this order, first match wins:

1. **Quoted literal** — `"pending"`; always a string, never resolved as a path.
2. **Record path** — property on the candidate record, including nested paths (`data.type`).
3. **Global data path** — `item.id`, resource UUIDs, etc.
4. **Unquoted literal** — bare words like `pending` / `accepted`.

> **A quoted operand is always a string literal.** `{item.status == "pending"}` compares
> against the text `pending` and never looks up a path called `pending` — the same rule
> `create`/`update` action data (see [actions.md](./actions.md)) and `findFirst` operands
> already follow. Bare words still work (`{item.title == Amazing}`) and are tried as a data
> path first, falling back to the literal. Reach for quotes when the literal contains a space
> or an operator character, which bare words cannot express: `{item.status == "in progress"}`.

> **An operand that resolves to a record compares by its `id`.** `{message.fk == [item_id]}`
> is true when the message's `fk` points at the record bound under `[item_id]` — the same rule
> the two-argument `findFirst(collection, id)` form follows. Without it a record would
> stringify to its whole JSON and could never equal an id. This applies to records only: a
> collection has no single identity, and a record with no usable `id` keeps its rendered form.
> Coercion is scoped to comparison operands — rendering a record (`{item}`) still shows the
> whole record.

**`null`:** `archivedAt == null` / `archivedAt != null` match records where the path is
**absent or JSON null**. Only `==` and `!=` are allowed with `null`. `null == null` is true.

**Ids collide with the resources they name.** Resource ids are UUIDs and so are the binding
keys naming those resources, so a bare UUID is ambiguous: as a comparison operand it resolves
as a data path (which is what makes the identity rule above useful), while in a `create` /
`update` value position it stays the literal id — a payload carries identifiers, and what a
resource key binds is a *record*, whose own id is a different UUID. See
[actions.md](./actions.md#create) for the value-position rule.

See [methods.md](./methods.md) for the `count`/`length`/`sort` helpers usable inside these
expressions, and the [Swift interpreter](../../ios/evy/Utils/interpreter.swift) /
[TS condition parser](../../web/app/utils/conditionExpression.ts) for the canonical
implementations.
