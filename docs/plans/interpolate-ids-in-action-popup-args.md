# Interpolate resource ids in the action popup's free-text argument boxes

## Problem

In the web builder, opening an action in the popup ([ActionPopup.tsx](../../web/app/components/ActionPopup.tsx)) shows the free-text function arguments as raw strings, so a stored `update()` filter like

```
{fk: dc28ed59-298e-493c-8ff3-3e60f2ebccbd.id, archivedAt: null}
```

displays the service-resource UUID verbatim. Everywhere else in the builder that UUID is already rendered as a human-readable token:

- The action **summary card** ([ActionEditor.tsx:154](../../web/app/components/ActionEditor.tsx)) runs branch/condition text through `getIdDisplayText(...)` and shows `{fk: message.id, archivedAt: null}`.
- The **configuration panel** fields (title, source, destination, visible…) use the `BuilderAssist` contenteditable ([BuilderAssist.tsx](../../web/app/components/BuilderAssist.tsx)), which renders known ids as named chips (via `getIdDisplayParts` + `buildTokenHtml`) while keeping the raw id in `data-value`, and provides autocomplete.

The only place still showing raw UUIDs is the four plain `<textarea>` elements in [BranchEditor.tsx:179-220](../../web/app/components/actionPopup/BranchEditor.tsx):

| aria-label | Function | Arg index |
|---|---|---|
| `{branchId}-navigate-query` | `navigate` | 2 |
| `{branchId}-create-data` | `create` | 2 |
| `{branchId}-update-filter` | `update` | 2 |
| `{branchId}-update-changes` | `update` | 3 |

## Approach

Replace the four plain textareas with the existing `BuilderAssist` component. This reuses the established interpolation mechanism (id → named chip, raw id preserved in `data-value`, edits read back via `readRawValueFromNode`), gives autocomplete for free, and keeps display/serialization lossless — no reverse name→id parsing needed.

Why not "format the textarea value with `getIdDisplayText`": that display transform is lossy (typing back "message.id" can't be reliably mapped to the UUID, resource names aren't unique across services). The token-chip contenteditable was built exactly to avoid this.

### Key background for the implementer

- `dc28ed59-…` in an update/create filter is a **service resource id** (see [sdui.md:204](../../docs/evy/sdui.md): `{update([service_id],[resource_id],{fk: [items_resource].id, archivedAt: null},{archivedAt: now()})}`). Resource ids are covered by `buildIdCandidates(...)` with category `"Resource"`, which `getIdDisplayParts` treats as a display candidate — so no new candidate machinery is needed.
- `BuilderAssist` props: `{ id?, label?, value, candidates, onChange, placeholder?, ariaLabel?, labelClassName?, getAttributeCandidatesForQualifier? }`. It calls `onChange` with the **raw** value (ids, not display names) on each input and on blur.
- `ActionPopup` already has `useFlowsContext()` → `flowsById`, `pagesById`, `serviceResources`, `resourceAttributeMetadata` — everything needed to build candidates. `BranchEditor` already receives `flowsById`/`pagesById`/`serviceResources` as props.
- The candidate set to use mirrors `builderAssistCandidates` in [ConfigurationPanel.tsx:188-196](../../web/app/components/ConfigurationPanel.tsx), minus row-attribute candidates (those are SDUI row config keys, irrelevant inside action args):
  `[...buildIdCandidates(flowsById, pagesById, serviceResources), buildDatumCandidate(), ...buildFunctionCandidates()]` from [idCandidates.ts](../../web/app/utils/idCandidates.ts).
- Attribute autocomplete after a resource chip (`message.` → suggests `fk`, `archivedAt`, …) needs `getAttributeCandidatesForQualifier`. In the popup there is no row `source` to resolve `$datum`, so only handle qualifiers that are themselves resource ids: if `serviceResources.some(r => r.id === qualifier)`, return `buildResourceAttributeCandidatesForResource(resourceAttributeMetadata, qualifier)`, else `[]`. (Do **not** try to import the private `resolveQualifierResourceId` from ConfigurationPanel.)

### Accepted behavior changes (call out in the PR)

- The arg boxes become contenteditable fields instead of 3-row textareas. Literal newlines typed by the user are not preserved (`readRawValueFromNode` skips `<br>`); action arg values are single-line expressions, and the existing single-line BuilderAssist fields (destination, visible) already behave this way.
- Trailing-whitespace trimming on re-serialize already happened with the textareas (`splitFunctionArguments` trims each arg) — unchanged.
- The `navigate` arg-2 guard in `handleArgChange` (rejects text not starting with `{`) keeps working as before: the rejected `onChange` leaves parent state unchanged and BuilderAssist re-syncs the editable back from `value`.

## File map

| File | Change |
|---|---|
| [web/app/components/BuilderAssist.tsx](../../web/app/components/BuilderAssist.tsx) | Add optional `multiline?: boolean` prop → `evy-id-autocomplete-field--multiline` modifier class (taller min-height, `align-items: flex-start`) in the injected CSS, so the arg boxes keep a textarea-like footprint |
| [web/app/components/ActionPopup.tsx](../../web/app/components/ActionPopup.tsx) | Build `idCandidates` + `getAttributeCandidatesForQualifier` (useMemo/useCallback from `useFlowsContext` data); pass both to each `BranchEditor` |
| [web/app/components/actionPopup/BranchEditor.tsx](../../web/app/components/actionPopup/BranchEditor.tsx) | New props `idCandidates: IdCandidate[]`, `getAttributeCandidatesForQualifier`; replace the four `<textarea>`s with `<BuilderAssist multiline …>` keeping identical `aria-label`s and placeholders |
| [web/app/globals.css](../../web/app/globals.css) | Remove now-unused `.evy-action-popup-textarea` rules (lines ~822-833). Keep `.evy-action-popup-input` — still used by [OperandEditor.tsx:113](../../web/app/components/actionPopup/OperandEditor.tsx) |
| [web/integration/builderAssistFlow.pw.ts](../../web/integration/builderAssistFlow.pw.ts) | Fix assertions that assume a `<textarea>`; add coverage that a resource id in an `update` filter renders as a named chip |

No iOS/API/types changes — this is display-only in the web builder; the persisted action strings are unchanged.

## Tasks

### Phase 1 — multiline BuilderAssist

1. In `BuilderAssist.tsx`, add the `multiline?: boolean` prop and append `evy-id-autocomplete-field--multiline` to the field div's class when set; add the modifier rules to the `css` string (`min-height: 64px; align-items: flex-start;`).
2. Run `bun run lint` from `web/` and fix anything it flags.

### Phase 2 — wire candidates into the popup

3. In `ActionPopup.tsx`, build `idCandidates` with `useMemo`: `[...buildIdCandidates(flowsById, pagesById, serviceResources), buildDatumCandidate(), ...buildFunctionCandidates()]` (add `resourceAttributeMetadata` to the `useFlowsContext()` destructure).
4. In `ActionPopup.tsx`, add a `useCallback` `getAttributeCandidatesForQualifier(qualifier)` that returns `buildResourceAttributeCandidatesForResource(resourceAttributeMetadata, qualifier)` when `qualifier` matches a `serviceResources` id, else `[]`; pass it and `idCandidates` to both `BranchEditor`s.
5. In `BranchEditor.tsx`, add the two new props to `BranchEditorProps` and replace the four textareas with `BuilderAssist` — e.g. for the update filter:
   ```tsx
   <BuilderAssist
       ariaLabel={`${branchId}-update-filter`}
       value={args[2] ?? ""}
       onChange={(v) => handleArgChange(2, v)}
       candidates={idCandidates}
       getAttributeCandidatesForQualifier={getAttributeCandidatesForQualifier}
       placeholder="Filter, e.g. {fk: $datum.id, archivedAt: null}"
       multiline
   />
   ```
   (same pattern for `navigate-query` arg 2, `create-data` arg 2, `update-changes` arg 3; keep the existing `aria-label` strings exactly).
6. Delete the `.evy-action-popup-textarea` rules from `globals.css`.
7. Run the web unit tests: `cd web && bun run test:unit` — confirm green (no unit tests target BranchEditor, this is a regression check).
8. Manually verify in the browser (`cd web && bun run dev`, or the preview tooling): open a row with an `update()` action whose filter contains a resource UUID → the popup filter box shows the resource-name chip, editing and saving round-trips the raw id (check the summary card and re-open the popup).
9. Commit: `[BUG] Action popup interpolates resource ids in function arg inputs` (branch off `dev` if not already on a feature branch).

### Phase 3 — integration tests

10. In `builderAssistFlow.pw.ts`, fix the existing test `"configures action branches with PopoverSelect arguments and persists them"`: the final `await expect(reopenedPopup.getByLabel("true-0-navigate-query")).toHaveValue("{items: [$datum.id]}")` fails against a contenteditable — replace with the file's existing helper: `expect(await readBuilderAssistRawValue(reopenedPopup.getByLabel("true-0-navigate-query"))).toBe("{items: [$datum.id]}")`. (`.fill()` on the contenteditable keeps working; leave it. Note `$datum` inserts as plain text — no chip — so the raw text also renders as-is.)
11. Run just that spec to see the current failure mode first, then the fix: `cd web && bun --env-file=../.env run playwright test --config=integration/pw.config.js builderAssistFlow`.
12. Add a new test in the same describe block: seed the fixture's `Open checkout` button action with a saved update branch, e.g. `true: `{update(${MARKETPLACE_SERVICE},${ITEM_RESOURCE_ID},{fk: ${ITEM_RESOURCE_ID}.id, archivedAt: null},{archivedAt: now()})}`` (edit `buildBuilderAssistFlow()` or add a second row), open the popup, and assert:
    - the filter field shows a chip: `getBuilderAssistToken(popup.getByLabel("true-0-update-filter"), "item")` is visible, and the raw UUID text is **not** visible in the field;
    - `readBuilderAssistRawValue(...)` still returns the original string containing `ITEM_RESOURCE_ID`;
    - after Save, the summary card still shows the interpolated form.
13. Run the integration suite for the file again until green.
14. Run `bun run lint` from `web/`, then commit the test changes.

## Verification checklist

- [ ] Popup `update` filter shows `{fk: <resource-name-chip>.id, archivedAt: null}` instead of the UUID (the reported bug).
- [ ] Saving without touching the field persists the identical raw string (no accidental rewrite).
- [ ] Typing a resource name in the field offers autocomplete; selecting inserts the id (renders as chip).
- [ ] `navigate` query, `create` data, and `update` changes boxes behave the same.
- [ ] `cd web && bun run test:unit`, `bun run test:integration`, `bun run lint` all pass.
