# Clean up Builder Assist Playwright integration tests

## Goal

Reduce the current Playwright integration coverage for Builder Assist / ID autocomplete from many narrow UI edge-case specs to a small, high-signal set of end-to-end builder flows.

The retained Playwright tests should prove that Builder Assist works in the places a real builder uses it:

1. Row configuration fields in `ConfigurationPanel`.
2. Source / destination / visibility bindings in `ConfigurationPanel`.
3. Action popup branch arguments in `BranchEditor`.
4. Chip rendering/editing persistence across select, type, save, and reopen interactions.

Low-level matching, token parsing, candidate filtering, and expression-context rules should stay in fast Bun unit tests instead of browser tests.

## Current context

- Integration tests live in `web/integration` and are run by `bun run --cwd web test:integration`.
- Playwright config is `web/integration/pw.config.js`, which matches `*.pw.ts` and starts the web dev server with `bun run dev`.
- Builder Assist is implemented in `web/app/components/BuilderAssist.tsx`.
- Builder Assist is used by:
  - `web/app/components/ConfigurationPanel.tsx` via `ConfigTextField` with `suggestionMode="expression"`.
  - `web/app/components/actionPopup/BranchEditor.tsx` for branch function arguments.
- Existing unit coverage already exists in:
  - `web/app/utils/idCandidates.test.ts`
  - `web/app/utils/idTokenSearch.test.ts`
- Current browser coverage is mostly in `web/integration/idAutocomplete.pw.ts`, with related overlap in `web/integration/configuration.pw.ts` and `web/integration/popoverKeyboard.pw.ts`.

## File structure and responsibilities

### Files to create

#### `web/integration/builderAssistFlow.pw.ts`

New focused Playwright spec containing only the retained full-flow Builder Assist scenarios.

Responsibilities:

- Exercise Builder Assist through actual app UI entry points.
- Use injected flows/resources through `openAppWithFullFlows`.
- Verify that suggestions can be selected, chips render, text can continue around chips, and values persist after app UI state changes.
- Cover both expression mode (`ConfigurationPanel`) and default mode (`BranchEditor` argument fields).

### Files to modify

#### `web/integration/utils.tsx`

Add small reusable helpers only if they make the new flow tests clearer.

Candidate helpers:

- `selectBuilderAssistCandidate(page, field, typedText, optionName)`
- `expectBuilderAssistToken(fieldOrPanel, tokenText)`
- `readBuilderAssistRawValue(locator)` moved from the current `idAutocomplete.pw.ts`
- `openFirstActionEditor(page, rowLabel)` if repeated across retained tests

Keep helpers minimal and specific to repeated behavior in the new spec.

#### `web/integration/idAutocomplete.pw.ts`

Replace with `web/integration/builderAssistFlow.pw.ts` or delete after migrating the few retained scenarios.

Responsibilities after cleanup:

- None, if renamed/replaced.
- Avoid keeping dozens of narrow autocomplete specs in Playwright.

#### `web/integration/configuration.pw.ts`

Trim Builder Assist / action-popup overlap once the new `builderAssistFlow.pw.ts` covers full flows.

Keep only configuration-panel tests that are not primarily Builder Assist behavior, for example:

- Selecting a row displays editable config fields.
- Drilling into child row configuration.
- Non-autocomplete-specific action summary/rendering behavior if still valuable.

Move or remove detailed condition/branch/autocomplete cases that are better covered by:

- `builderAssistFlow.pw.ts` for real user flows.
- `web/app/utils/actionBranch.test.ts` and related unit tests for serialization/logic.

#### `web/integration/popoverKeyboard.pw.ts`

Review after creating the Builder Assist flow spec.

Options:

- Delete if its behavior is already covered by retained action popup flows and unit tests.
- Keep only if PopoverSelect keyboard navigation is considered a distinct integration risk separate from Builder Assist.

#### `web/app/utils/idCandidates.test.ts`

Add unit tests only for candidate filtering/display behavior currently covered only by `idAutocomplete.pw.ts` and still considered important.

Likely already covered:

- Candidate building from flows, pages, resources, row attributes, datum, functions.
- Candidate filtering by query and context.
- Display part resolution for IDs.

#### `web/app/utils/idTokenSearch.test.ts`

Add unit tests only for token/search-context behavior currently covered only by `idAutocomplete.pw.ts` and still considered important.

Likely already covered:

- Root triggers: `{`, `(`, `,`.
- Attribute triggers with `.`.
- Unsupported/no-trigger contexts.
- Replacing the active occurrence.

### Files likely unchanged

- `web/integration/dragAndDrop.pw.ts`
- `web/integration/childPage.pw.ts`
- `web/integration/flowSelector.pw.ts`
- `web/integration/hover.pw.ts`
- `web/integration/offline.pw.ts`
- `web/integration/rowSelection.pw.ts`
- `web/integration/rows.pw.ts`
- `web/integration/websocket.pw.ts`
- `web/integration/pw.config.js`

These are not Builder Assist-specific. Do not delete them as part of this cleanup unless the task scope changes to reducing all integration tests broadly.

## Retained Playwright scenarios

Keep the browser suite to 3-4 high-value tests.

### 1. Configuration field expression flow

Proves Builder Assist works in a row content field.

Flow:

1. Open the app with `openAppWithFullFlows` using:
   - A flow with one page.
   - A row with a configurable text/title field.
   - Service resources including a marketplace item resource.
   - Resource attribute metadata including attributes such as `title` and `price`.
2. Select the row on the canvas.
3. In the `title` Builder Assist field:
   - Type normal text.
   - Trigger root suggestions with `{`.
   - Select a resource candidate by keyboard or click.
   - Type `.` and select an attribute candidate.
   - Continue typing after the chip/expression.
4. Assert:
   - Candidate list appears at the expected points.
   - Resource/attribute chips are visible with display labels.
   - Raw value contains the selected IDs/text in the expected order.
   - The canvas preview updates.
5. Click away and reselect the row.
6. Assert the chip display and raw value persisted.

### 2. Row binding expression flow

Proves Builder Assist works in row root binding fields, including `$datum` and scoped attributes.

Flow:

1. Open a flow with a row whose `source`, `destination`, and `visible` fields are editable in the config panel.
2. Select the row.
3. In `Source`:
   - Trigger suggestions and select the item resource.
4. In `Visible`:
   - Type an expression using `$datum`.
   - Type `.` and select a scoped attribute candidate.
   - Add a simple comparison, for example ` == true` or ` > 0`.
5. In `Destination`:
   - Select a resource/page/attribute candidate if relevant to current product behavior.
6. Assert:
   - Fields display chips where IDs are used.
   - `$datum` attributes are scoped from the current row source.
   - Values persist when another row is selected and this row is reselected.

### 3. Action popup branch argument flow

Proves Builder Assist works inside `BranchEditor`, where it runs in default suggestion mode.

Flow:

1. Open a flow with:
   - A button row with one editable action.
   - At least two pages so `navigate()` has meaningful flow/page arguments.
2. Select the button row and open `Edit action 1`.
3. In the true branch:
   - Select `navigate` from the function popover.
   - Use Builder Assist arg fields to choose a flow and page.
   - Fill the optional navigate query text area with a small expression using Builder Assist-supported syntax if the UI supports it there.
4. In the false branch, optionally select `close` or `create` depending on the intended complete builder flow.
5. Save.
6. Assert:
   - The summary card shows the selected action.
   - Reopening the popup shows the selected function and Builder Assist argument chips/values.

### 4. Chip editing lifecycle flow

Keep only if not naturally covered by scenario 1.

Flow:

1. Insert a resource chip in a config field.
2. Continue typing after the chip.
3. Move the cursor before/after the chip.
4. Delete or clear the field.
5. Select another suggestion after the field returns to plain text.
6. Assert focus is retained and the final raw value is correct.

This replaces many current one-off Playwright tests like cursor movement, typing after chip, clearing, and backspace behavior.

## Coverage moved out of Playwright

Do not keep separate browser tests for each of these unless a real browser integration bug has previously occurred and cannot be caught in unit tests:

- Root suggestions after every individual trigger character.
- Unsupported separators.
- Case-insensitive filtering.
- Prefix sorting.
- Exact resource auto-pick edge cases.
- Attribute scoping matrix.
- Token replacement for active occurrence.
- Low-level cursor/token parsing.
- Popover keyboard navigation permutations.

Use or extend existing unit tests instead:

- `web/app/utils/idCandidates.test.ts`
- `web/app/utils/idTokenSearch.test.ts`
- `web/app/utils/actionBranch.test.ts`

## Bite-sized implementation tasks

### Task 1 — Baseline targeted test run

Run the current Builder Assist-related Playwright tests to establish the starting point.

```bash
bun run --cwd web test:integration -- idAutocomplete.pw.ts configuration.pw.ts popoverKeyboard.pw.ts
```

If failures already exist, record them before changing tests.

### Task 2 — Identify exact tests to retire

Review `web/integration/idAutocomplete.pw.ts` and classify each existing test as:

- Covered by new full-flow Playwright scenario.
- Covered by existing unit tests.
- Needs a new unit test before deleting.
- Still worth keeping as a browser flow.

Expected result: almost all existing `idAutocomplete.pw.ts` tests are retired or moved to unit tests.

### Task 3 — Add any missing unit coverage

If Task 2 finds low-level behavior not already covered, add focused Bun unit tests to:

- `web/app/utils/idCandidates.test.ts`
- `web/app/utils/idTokenSearch.test.ts`

Run:

```bash
bun run --cwd web test:unit
```

### Task 4 — Add Builder Assist Playwright helpers

Add only the repeated helpers needed by the new spec to `web/integration/utils.tsx`.

Keep helper names explicit and behavior small. Avoid broad abstractions that hide the user flow.

### Task 5 — Create `builderAssistFlow.pw.ts`

Implement the 3-4 retained Playwright scenarios listed above.

Prefer clear user-facing assertions:

- Visible labels and chips.
- `aria-label` fields such as `title`, `Row data source`, `Row visibility condition`, and branch argument labels.
- Reopen/persistence checks instead of internal implementation details.

Run only the new spec first:

```bash
bun run --cwd web test:integration -- builderAssistFlow.pw.ts
```

### Task 6 — Delete or rename `idAutocomplete.pw.ts`

Once `builderAssistFlow.pw.ts` is passing:

- Delete `web/integration/idAutocomplete.pw.ts`, or
- Rename it to `builderAssistFlow.pw.ts` if that produces a cleaner diff.

Do not leave both files covering the same behavior.

### Task 7 — Trim overlapping configuration/action specs

Edit `web/integration/configuration.pw.ts` to remove detailed Builder Assist and action-branch cases that are now covered by `builderAssistFlow.pw.ts` or unit tests.

Keep non-overlapping configuration coverage.

Run:

```bash
bun run --cwd web test:integration -- configuration.pw.ts builderAssistFlow.pw.ts
```

### Task 8 — Decide on `popoverKeyboard.pw.ts`

If the retained action popup flow sufficiently covers selecting branch functions, delete `web/integration/popoverKeyboard.pw.ts`.

If keyboard navigation remains a distinct accessibility/integration requirement, keep one test only:

- Open function select.
- ArrowDown / Enter selects a function.
- Escape closes without changing value.

Run:

```bash
bun run --cwd web test:integration -- popoverKeyboard.pw.ts builderAssistFlow.pw.ts
```

Skip this command if `popoverKeyboard.pw.ts` is deleted.

### Task 9 — Run full web validation

Run the required web checks.

```bash
bun run --cwd web build
bun run --cwd web lint
bun run --cwd web test:unit
bun run --cwd web test:integration
```

Fix any failures caused by the cleanup.

### Task 10 — Run root e2e validation

Run the project e2e command from the repo root.

```bash
./run-e2e.sh --skip-ios
```

If this fails for unrelated environment reasons, record the exact command and failure output.

### Task 11 — Final review

Before handing off:

1. Confirm the only deleted Playwright coverage is replaced by either:
   - A retained full Builder Assist flow, or
   - A focused unit test.
2. Confirm no unrelated integration specs were changed.
3. Confirm `web/integration/pw.config.js` still discovers the final `*.pw.ts` files.
4. Confirm the final integration suite has materially fewer Builder Assist browser tests.

## Risks and mitigations

- **Risk: Losing browser coverage for contenteditable/chip cursor bugs.**
  Mitigation: keep one chip lifecycle Playwright flow that exercises insert, continue typing, clear/delete, and select again.

- **Risk: Action popup behavior is trimmed too aggressively.**
  Mitigation: keep one full action branch flow and rely on `actionBranch` unit tests for serialization details.

- **Risk: New flow tests become too long and brittle.**
  Mitigation: cap at 3-4 tests and assert outcomes at major user milestones, not every intermediate DOM detail.

- **Risk: Helpers hide important UX steps.**
  Mitigation: only extract repeated primitives; keep scenario bodies readable as real builder workflows.

## Expected end state

- Builder Assist Playwright coverage is consolidated into `web/integration/builderAssistFlow.pw.ts`.
- `web/integration/idAutocomplete.pw.ts` is removed or renamed.
- `web/integration/configuration.pw.ts` no longer carries granular Builder Assist/action-branch permutations.
- Unit tests cover token/candidate edge cases.
- Full validation passes with Bun commands and root e2e.
