# EVY expression grammar — conformance corpus

`conformance.json` is the executable reference for value-position resolution,
`{…}` expression evaluation, and inline action expression parsing. It is run by
both clients:

| Runner | File | Command |
| --- | --- | --- |
| TypeScript | `web/app/utils/grammarConformance.test.ts` | `bun run --cwd web test:unit` |
| Swift | `ios/evyTests/GrammarConformanceTests.swift` | `evyTests` target |

## Why it exists

The grammar has one canonical implementation in Swift
(`ios/evy/Utils/interpreter.swift`, `ios/evy/UI/EVYObjectLiteral.swift`,
`ios/evy/UI/EVYActionParser.swift`) and partial re-implementations in
TypeScript (`functionArgs.ts`, `actionBranch.ts`, `conditionExpression.ts`,
`actionAst.ts`). Nothing kept them in agreement — parity is maintained by this
shared artefact.

## The rule

**Any change to parser behaviour on either platform must update the vectors in
the same commit.** A vector that has to change is a deliberate grammar decision,
and the diff is where that decision is visible for review.

## Two evaluation contexts

### Value position

JSON field values and object-literal values (`data`, `filter`, `changes`,
`query` maps, nested maps, destination templates):

| Written | Meaning |
| --- | --- |
| `pending`, `marketplace.items` | literal string, verbatim |
| `"AUD"` (whole value is a quoted string) | string literal (quotes are delimiters, not payload) |
| `{marketplace.items.id}` (whole value is one `{expr}`) | resolve; result keeps its JSON type |
| `Hello {user.name}!` (embedded braces) | string interpolation via the text parser |
| `true` / `false` / `null` / `42` (bare, whole value) | coerced JSON scalar |
| `{$datum.id}` | datum property; unresolved whole-value `{$datum.…}` is omitted from create `data` / update `changes` maps |

### Expression position

Inside `{…}` in conditions, comparisons, `findFirst`, etc.: identifiers are data
paths, `"…"` is a string literal, functions are callable. Row template fields
(`visible`, `title`, `source`, `destination`, …) are already braced templates.

### Action expression grammar

A branch is `""` (no-op) or exactly one `{fn(arg, …)}` call:

| Function | Signature |
| --- | --- |
| `close()`, `select_photo()`, `expand_photo()`, `delete_photo()` | zero args |
| `show(rowId)`, `expand_text(rowId)` | one row id |
| `highlight_required(field)` | one field path |
| `select(value)` | one value-position arg; `$datum` allowed bare |
| `navigate(flowId, pageId, {k: v, …}?)` | ids verbatim; query values are value-position |
| `create(resource, submit)` | resource ref verbatim |
| `create(resource, {map}, idDestination?)` | map values value-position |
| `create(resource, dataPath, idDestination?)` | from-path mode |
| `update(resource, {filter}, {changes}\|changesPath, draft?)` | store needs non-empty filter; draft needs empty filter |

Object-literal args nest braces, e.g.
`{create(evy.messages, {fk: {marketplace.items.id}, resource: marketplace.items, …})}`.

### Rules that die

- Escaped-quote literals in map values (`"\"marketplace.items\""`).
- Bare-word resolve-with-literal-fallback.
- Bare-UUID disambiguation (bare UUIDs are literals).
- Structured `fn` invocation JSON (storage is the expression string).

## Vector format

```jsonc
{
  "id": "comparison-unquoted-literal-eq",  // stable, kebab-case, unique
  "category": "comparison",                 // see below
  "platforms": ["ios", "web"],              // which runners execute it
  "input": "{item.condition == pending}",
  "data": { "item": { "condition": "pending" } },  // seeded roots (ios)
  "datum": { "id": "row-1" },               // optional $datum for ios value-resolution
  "expect": { … },                          // shape depends on category
  "notes": "why this behaviour is what it is"
}
```

`data` maps a root binding name to a JSON value. The Swift runner seeds each
entry as a local singleton record under that name before evaluating. Vectors
with no `data` need no environment.

A vector whose `notes` begin with `WART:` pins **current** behaviour that is
known to be wrong or surprising. It is deliberately not a bug to be fixed by
editing the vector — fix the implementation, then update the vector.

## Categories

| Category | Platforms | `expect` | Runs against |
| --- | --- | --- | --- |
| `split-args` | ios, web | `{ "args": string[] }` | `EVY.splitFunctionArguments`, `splitFunctionArguments` |
| `comparison` | ios | `{ "value": boolean }` or `{ "error": true }` | `EVY.evaluateFromText` |
| `expression` | ios | `{ "text": string }` or `{ "error": true }` | `EVY.getValueFromText(...).toString()` |
| `display` | ios | `{ "text": string }` | `EVY.displayText(fromSource:destination:)` |
| `condition-parse` | web | `{ "ast": … }` (`null` when unparseable) | `parseCondition` |
| `action-parse` | ios, web | `{ "ast": … }` or `{ "error": string }` | `parseActionExpression` |
| `value-resolution` | ios | `{ "json": value }`, `{ "text": string }`, or `{ "omit": true }` | `EVYPlainTextResolution.resolveValue` |

`expression` is the core resolver and `display` is the rendered-row layer above
it. They are separate categories because they disagree on failure: the core
*throws* on an unresolvable root, while display swallows that per token.

`comparison` and `expression` are iOS-only because the web interpreter is
deliberately a preview mock.

`owns` is covered by iOS `interpreterTests` rather than this corpus.

## Adding a vector

1. Give it a stable, descriptive `id`; ids are asserted unique by both runners.
2. Pick the narrowest category that captures the behaviour.
3. Write down what the implementation *actually does* and run both runners. If
   the result surprises you, record it as a `WART:` vector rather than encoding
   the surprise as intended behaviour.
