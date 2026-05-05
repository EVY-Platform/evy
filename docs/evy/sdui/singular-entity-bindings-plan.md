# Singular entity bindings follow-up plan

## Goal

Support singular entity/draft bindings end-to-end while keeping backend resources and collection sources plural.

Direct entity/draft attributes should use singular keys:

```json
{
  "type": "Input",
  "source": "",
  "destination": "{item.title}",
  "view": {
    "content": {
      "value": "{item.title}"
    }
  },
  "actions": []
}
```

Create actions should use the singular entity key:

```json
{
  "true": "{create(item)}"
}
```

The runtime should still submit to plural backend resources:

```json
{
  "service": "marketplace",
  "resource": "items",
  "data": {
    "title": "Example item"
  }
}
```

## Naming convention

### Singular: direct entity/draft attributes

Use singular entity keys whenever reading or writing one entity/draft:

- `{item.title}`
- `{item.price}`
- `{item.condition}`
- `{buildCurrency(item.price)}`
- `{item.photo_ids}`

### Plural: resources and collections

Use plural names when the value represents a backend resource or collection:

- `source: "{items}"`
- `source: "{conditions}"`
- service-qualified synced keys like `marketplace:items`

### `$datum`: dynamic row templates

Inside search/list item templates, use `$datum` for the current row item:

- `{$datum:title}`
- `{$datum:price.value}`
- `{$datum:id}`

## Key design decision: only singular → plural

Do not implement reverse plural-to-singular mapping.

The runtime should store and reason about selected entities/drafts with singular keys, then pluralize the singular key only when it needs a backend resource name.

Examples:

- `item` → `items`
- `condition` → `conditions`
- `duration` → `durations`
- `area` → `areas`
- `provider` → `providers`
- `organisation` → `organisations`
- `selling_reason` → `selling_reasons`

## 1. Add a Swift singular → plural resource helper

### Suggested location

Either:

- `ios/evy/EVY.swift`, if kept near create/query logic
- `ios/evy/Utils/EVYResourceNames.swift`, if split into a small helper

### Behavior

Add a helper that converts a singular entity key into a backend resource name.

Swift has built-in localized inflection APIs. Use those instead of a hard-coded reverse map.

A wrapper may be needed for snake_case keys. The safest shape is to inflect only the last underscore-separated segment:

```swift
static func resourceName(forEntityKey entityKey: String) -> String {
  let parts = entityKey.split(separator: "_").map(String.init)
  guard let lastPart = parts.last else { return entityKey }

  let pluralLastPart = lastPart.inflect(.init(number: .plural))
  return (parts.dropLast() + [pluralLastPart]).joined(separator: "_")
}
```

Verify the exact `inflect` API signature against the project Xcode/Swift toolchain before committing. Add tests for every supported resource key.

Expected test cases:

- `item` → `items`
- `condition` → `conditions`
- `duration` → `durations`
- `area` → `areas`
- `provider` → `providers`
- `organisation` → `organisations`
- `selling_reason` → `selling_reasons`

## 2. Update `EVY.create` to accept singular entity keys

### File

`ios/evy/EVY.swift`

### Current model

The create path currently behaves as if `create(items)` and `items.*` are the draft/resource key.

### Target model

`create(item)` should:

1. Use `item` as the local draft/entity key.
2. Build the payload from the `item` draft.
3. Pluralize `item` to `items`.
4. Send the backend upsert to `resource: "items"`.

### Implementation notes

Inside `EVY.create(key:)` or equivalent:

```swift
let entityKey = key
let resource = EVY.resourceName(forEntityKey: entityKey)
```

Use `entityKey` for:

- draft lookup
- active draft scope
- local entity cache
- reading/writing field data

Use `resource` for:

- `UpsertParams.resource`
- backend requests
- synced resource cache lookup, if needed

Do not singularize `items` anywhere.

## 3. Update draft scope resolution to singular entity keys

### Files to inspect/update

- `ios/evy/ContentView.swift`
- `ios/evy/EVY.swift`
- `ios/evy/Data/EVYStores.swift`
- any `EVYFlowDraftScopeResolver`
- any `EVYDraft.scopeEntityKey` / `EVYDraft.createMergeScopeId`

### Desired behavior

For a create flow:

- `{create(item)}` produces draft scope `<flowId>:item`.
- `{item.title}`, `{item.price}`, and `{buildCurrency(item.price)}` bootstrap/write into the same `item` scope.

The destination root and create-action entity key should agree naturally because both are singular.

## 4. Update create-key extraction tests

### Files

- `ios/evyTests/ContentViewTests.swift`

### Update expectations

- Create actions should use `{create(item)}`.
- `extractCreateKeys` should find `item`.
- Draft scope should be `create-flow:item`.

Add or update a test proving `create(item)` ultimately targets backend resource `items` through Swift inflection.

## 5. Update iOS e2e fixtures and assertions

### File

`ios/e2e/e2e.swift`

### Replace direct attributes

- `textField_{items.title}` → `textField_{item.title}`
- `textField_{items.price}` → `textField_{item.price}`
- `textField_{buildCurrency(items.price)}` → `textField_{buildCurrency(item.price)}`
- `textField_{items.width}` → `textField_{item.width}`

### Update fixture data

In create-item fixture flows:

- `{items.title}` → `{item.title}`
- `{buildCurrency(items.price)}` → `{buildCurrency(item.price)}`
- `{items.width}` → `{item.width}`
- `{create(items)}` → `{create(item)}`

The e2e assertion should still verify the marketplace `items` resource contains the created row with title, price, and width.

## 6. Update iOS previews/sample JSON

### Files

- `ios/evy/UI/Rows/Edit/EVYDropdownRow.swift`
- `ios/evy/UI/Rows/Edit/EVYInlinePickerRow.swift`
- `ios/evy/UI/Rows/Edit/EVYInputRow.swift`
- `ios/evy/UI/Rows/Edit/EVYSelectPhotoRow.swift`
- `ios/evy/UI/Rows/Edit/EVYTextAreaRow.swift`
- `ios/evy/UI/Rows/Edit/EVYTextSelectRow.swift`
- `ios/evy/UI/Views/EVYDropdown.swift`
- `ios/evy/UI/Views/EVYInlinePicker.swift`
- `ios/evy/UI/Views/EVYSelectItem.swift`
- `ios/evy/UI/Views/EVYSelectList.swift`

Replace `items.*` with `item.*` in destinations and value bindings.

Also update `EVYPreviewMockData.seedCommon()` so previews have a singular `item` key:

```swift
seed(key: "item", json: item)
```

Keep plural collection seeds such as `items`, `conditions`, `durations`, and `areas` for source/list previews.

## 7. Update web test fixtures if needed

The web palette defaults and docs have already moved toward singular direct attributes.

Audit and update any remaining direct attributes in:

- `web/tests/**/*.ts`
- `web/e2e/**/*.ts`
- `web/app/**/*.test.ts`

Keep these plural:

- `source: "{items}"`
- navigate resource query examples if they still intentionally represent a collection

## 8. Update API service sync behavior

### Files

- `api/src/serviceDataSync.ts`
- `api/src/tests/serviceDataSync.test.ts`

### Parser behavior

The expression parser can continue extracting literal candidates:

- `item.title` → `item`
- `formatCurrency(item.price)` → `item`
- `create(item)` → `item`

### Service discovery behavior

`resolveCandidateToService` should map singular candidates to plural backend resources before checking known resources.

Since current resource names are simple, an API-side helper can try exact match first and then append `s`:

```ts
function resourceCandidateFor(candidate: string): string[] {
  return candidate.endsWith("s") ? [candidate] : [candidate, `${candidate}s`];
}
```

This handles current resources:

- `item` → `items`
- `condition` → `conditions`
- `duration` → `durations`
- `area` → `areas`
- `selling_reason` → `selling_reasons`

The API only needs enough pluralization to discover the syncable service. iOS is the source of truth for runtime backend resource names.

### Tests

Update tests so:

- `extractCandidatesFromBinding("item.title")` returns `["item"]`
- `extractCandidatesFromBinding("formatCurrency(item.price)")` returns `["item"]`
- `extractCandidatesFromBinding("create(item)")` returns `["item"]`
- `resolveCandidateToService("item")` returns `marketplace`
- `discoverReferencedServices(...)` still finds `marketplace` when a flow uses singular direct bindings and `create(item)`

## 9. Update docs after runtime support lands

Docs were partially updated, but after runtime support lands, remove any temporary/follow-up wording.

Docs should state:

- Direct entity attributes are singular.
- `create` takes a singular entity key.
- iOS pluralizes singular entity keys into backend resources using Swift inflection.
- Query param keys that represent selected entities should be singular, for example `{"item": [$datum.id]}`.
- Collection/list sources remain plural, for example `source: "{items}"`.

Files:

- `README.md`
- `ios/README.md`
- `docs/evy/sdui/readme.md`
- `docs/evy/sddata/functions.md`
- `docs/services/service_sdui.json`

## 10. Validation checklist

Run:

```sh
bun run format
bun run types:generate
bun run --cwd api build
bun run --cwd api lint
bun run --cwd api test
bun run --cwd web build
bun run --cwd web lint
bun run --cwd web test
bun run --cwd services/marketplace build
bun run --cwd services/marketplace lint
bun run --cwd services/marketplace test
```

Run iOS build/tests targeting iPhone 17 / iOS 26.4.1:

```sh
cd ios
xcodebuild -project evy.xcodeproj -scheme evy -destination "platform=iOS Simulator,name=iPhone 17,OS=26.4.1" build
xcodebuild -project evy.xcodeproj -scheme evy -destination "platform=iOS Simulator,name=iPhone 17,OS=26.4.1" -only-testing:evyTests test
```

Run the full e2e suite:

```sh
./run-e2e.sh
```

## Safe implementation order

1. Add the iOS singular → plural helper and tests.
2. Update `EVY.create` to pluralize singular entity keys for backend resources.
3. Update draft scope/create-key tests to singular `item`.
4. Update iOS e2e fixtures to singular `item.*`.
5. Update iOS previews to singular `item.*` and seed `item`.
6. Update API service sync candidate pluralization and tests.
7. Update docs to final wording.
8. Run the full validation checklist.
