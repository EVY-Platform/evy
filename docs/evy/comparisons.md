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

**`null`:** `archivedAt == null` / `archivedAt != null` match records where the path is
**absent or JSON null**. Only `==` and `!=` are allowed with `null`. `null == null` is true.

Record-prop names that collide with global datum keys are theoretically possible but keys are
UUIDs at runtime.

See [methods.md](./methods.md) for the `count`/`length`/`sort` helpers usable inside these
expressions, and the [Swift interpreter](../../ios/evy/Utils/interpreter.swift) /
[TS condition parser](../../web/app/utils/conditionExpression.ts) for the canonical
implementations.
