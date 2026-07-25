# EVY expression grammar — conformance corpus

`conformance.json` is the executable reference for the `{…}` expression and
action-string grammar. It is run by both clients:

| Runner | File | Command |
| --- | --- | --- |
| TypeScript | `web/app/utils/grammarConformance.test.ts` | `bun run --cwd web test:unit` |
| Swift | `ios/evyTests/GrammarConformanceTests.swift` | `evyTests` target |

## Why it exists

The grammar has one canonical implementation in Swift
(`ios/evy/Utils/interpreter.swift`) and several partial re-implementations in
TypeScript (`functionArgs.ts`, `actionBranch.ts`, `conditionExpression.ts`,
`interpreter.ts`). Nothing kept them in agreement — parity was maintained by
copying code, including at least one copied regex typo. This corpus is the
shared artefact they are both measured against.

## The rule

**Any change to parser behaviour on either platform must update the vectors in
the same commit.** A vector that has to change is a deliberate grammar decision,
and the diff is where that decision is visible for review.

## Vector format

```jsonc
{
  "id": "comparison-unquoted-literal-eq",  // stable, kebab-case, unique
  "category": "comparison",                 // see below
  "platforms": ["ios", "web"],              // which runners execute it
  "input": "{item.condition == pending}",
  "data": { "item": { "condition": "pending" } },  // seeded roots (ios only)
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
| `split-args` | ios, web | `{ "args": string[] }` | Swift `EVY.splitFunctionArguments`, TS `splitFunctionArguments` |
| `action-branch` | ios, web | `{ "fn": string, "args": string[] }` or `{ "parsed": false }` | Swift `EVY.parseFunctionCall` + arg split, TS `parseBranch` |
| `comparison` | ios | `{ "value": boolean }` or `{ "error": true }` | `EVY.evaluateFromText` |
| `expression` | ios | `{ "text": string }` or `{ "error": true }` | `EVY.getValueFromText(...).toString()` |
| `display` | ios | `{ "text": string }` | `EVY.displayText(fromSource:destination:)` |
| `condition-parse` | web | `{ "ast": … }` (`null` when unparseable) | `parseCondition` |

`expression` is the core resolver and `display` is the rendered-row layer above
it. They are separate categories because they disagree on failure: the core
*throws* on an unresolvable root, while display swallows that into empty text —
which is why one bad token blanks a whole row string.

`comparison` and `expression` are iOS-only because the web interpreter is
deliberately a preview mock that renders doc-shaped placeholders rather than
evaluating real data (see `web/app/utils/functions.ts`).

## Adding a vector

1. Give it a stable, descriptive `id`; ids are asserted unique by both runners.
2. Pick the narrowest category that captures the behaviour.
3. Write down what the implementation *actually does* and run both runners. If
   the result surprises you, that is a finding — record it as a `WART:` vector
   rather than quietly encoding the surprising value as if intended.
