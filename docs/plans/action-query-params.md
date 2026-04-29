# Plan: Navigate Query Params as JSON Third Argument

## Summary

`navigate` actions use function-call syntax. Query params are represented as the optional third argument to `navigate`, and the third argument must be a JSON object.

Canonical forms:

- `{navigate(flowId, pageId)}`
- `{navigate(flowId, pageId, {"items": [$datum.id]})}`
- `{navigate(flowId, pageId, {"items": ["id-1", "id-2"]})}`

Non-canonical formats such as colon-separated actions, page-id query strings, and URL-style query pairs are not supported.

## Runtime contract

`navigate(flowId, pageId, queryParams?)`

- `flowId`: required flow identifier.
- `pageId`: required page identifier.
- `queryParams`: optional JSON object mapping plural resource keys to a string or an array of strings.
- `$datum.field` values are allowed in query arrays and are resolved by clients that execute actions with a datum context.

The parsed query shape is `[String: [String]]` on iOS.

## Implementation notes

- iOS executes only brace-wrapped function-call action branches.
- The web builder emits brace-wrapped function-call action branches.
- The API stores action strings without executing them, but service-sync discovery parses braced expressions and extracts resource keys from JSON query object arguments.
- Seed data and test fixtures should use only canonical function-call action syntax.

## Examples

```json
{
  "condition": "",
  "false": "",
  "true": "{navigate(ca47e6c5-da19-4491-8422-adb40d9e8a27,306ed62c-c2af-4652-a873-26c7a388972d)}"
}
```

```json
{
  "condition": "",
  "false": "",
  "true": "{navigate(ca47e6c5-da19-4491-8422-adb40d9e8a27,306ed62c-c2af-4652-a873-26c7a388972d,{\"items\": [$datum.id]})}"
}
```
