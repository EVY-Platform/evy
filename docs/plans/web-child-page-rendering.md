# Web child page rendering plan

## Goal

When a row is selected on web:

1. If the selected row has `view.content.child`, render that child as a secondary page immediately to the right.
2. Render a blank “new child” page immediately to the right of the rendered child page.
3. If the selected row does **not** have a child, render only the blank “new child” page next to the selected row’s page.
4. Stop rendering `Search` row’s child/template preview directly inside the main page.

The target visual sequence is:

```text
[active page] [selected row's child page, if any] [blank new child page]
```

## 1. Add a reusable `ChildPage` component

Create a new component:

- `web/app/components/ChildPage.tsx`

Responsibilities:

- Accept a `childRow: Row`.
- Render a phone-page interior.
- Render the child row via existing draggable row primitives, similar to other row rendering paths.
- Allow clicking the child row so it becomes the active element.
- Do **not** render grandchildren automatically for now. If the user selects the child row, then that child row becomes active and its own child page can appear.

This keeps the “active row → one child page” behavior simple and predictable.

## 2. Compute active leaf row and active child row in `App.tsx`

`App.tsx` already derives the active leaf row ID:

```ts
const activeLeafRowId =
	configStack.length > 0 ? configStack[configStack.length - 1] : activeRowId;
```

Add derived values:

```ts
const activeLeafRow = activeLeafRowId
	? findRowInPages(activeLeafRowId, pages)
	: undefined;
const activeChildRow = activeLeafRow?.config.view.content.child;
```

Then render, in order:

1. active page
2. `ChildPage` if `activeChildRow` exists
3. `BlankChildPage`

## 3. Change what the blank child page targets

The blank child page currently targets `children:${activeLeafRowId}` and drops into `view.content.children`.

For the new singular child model, it should target `child`.

### If the selected row has no child

Target:

```text
activeLeafRowId
```

Dropping a row creates:

```ts
activeLeafRow.view.content.child = droppedRow;
```

### If the selected row already has a child

Target:

```text
activeChildRow.id
```

Dropping a row creates:

```ts
activeChildRow.view.content.child = droppedRow;
```

This makes the chain grow naturally:

```text
row → child → child → child
```

And matches the requirement: show the existing child, then show a new blank child page to the right of that child.

## 4. Update `BlankChildPage` synthetic page ID

Current ID shape:

```text
children:${activeLeafRowId}
```

New ID shape:

```text
child:${parentRowId}
```

Rename the prop from:

```ts
activeLeafRowId
```

to:

```ts
parentRowId
```

This makes the component’s purpose clearer.

## 5. Update `dropHandler.ts`

Current blank page handler detects:

```text
children:
```

and inserts into:

```ts
destinationContainer: { rowId, type: "children" }
```

Change it to detect:

```text
child:
```

and insert into:

```ts
destinationContainer: { rowId, type: "child" }
```

Since this is a blank singular child page, `destinationIndex` can stay `0`.

Cleanup while changing this:

- Keep `handleBlankChildPageDrop` as the named helper.
- Remove `childrenCount`; it is no longer needed for singular child drops.
- Set `destinationIndex: 0` directly.

## 6. Remove direct `Search` child rendering on the main page

Current `SearchRow.tsx` renders the child/template preview directly:

```tsx
<SearchPreviewResults
	templateRow={row.config.view.content.child}
	parentRowId={row.id}
/>
```

Remove that from the main row render.

Then check and remove unused code:

- `SearchPreviewResults` import from `SearchRow.tsx`
- `searchPreview.tsx` if it is no longer imported anywhere
- related unit tests if they only cover the removed direct preview behavior

## 7. Child page row selection

`ChildPage` should render the child row so clicking it dispatches:

```ts
dispatchRow({ type: "SET_ACTIVE_ROW", rowId: childRow.id });
```

This allows:

- clicking the child page row to focus/select the child
- breadcrumbs to update through existing `SET_ACTIVE_ROW` path derivation
- the selected child’s own child to show as the next secondary child page

## 8. Tests

### Unit tests

Add or update coverage for:

1. Dropping into `child:${rowId}` sets `destinationContainer.type` to `"child"`.
2. Dropping into blank child page uses `destinationIndex: 0`.
3. Existing row path validation still accepts `child` chains.

### Integration tests

Add coverage for:

1. Selecting a row with a `child` shows:
   - active page
   - child page
   - blank child page
2. Selecting a row without a `child` shows:
   - active page
   - blank child page only
3. Clicking the row in the child page selects that child row.
4. Dropping a row into the blank child page creates `view.content.child`.
5. `Search` row no longer renders its child/template preview directly on the main page.

## 9. Documentation cleanup

Update web documentation if needed:

- Replace “blank child page adds children” wording with singular child behavior.
- Make it clear child page display is derived from `view.content.child`.

## 10. Validation

Run from `web`:

```bash
bun run build
bun run lint
bun run test:unit
bun run test:integration
```

Then from repo root:

```bash
./run-e2e.sh --skip-ios
```

If seed data changes affect the iOS app too, also run the full e2e suite including iOS.
