# Plan: smoother swipe UX for `EVYSwipeableRow`

**Status:** implemented
**Branch:** build on `feat/new-actions`
**Depends on:** `docs/plans/slide-left-trigger.md` (implemented) — that plan built the swipe container this plan refines.
**Reference:** [Hacking with Swift — Adding custom row swipe actions to a List](https://www.hackingwithswift.com/books/ios-swiftui/adding-custom-row-swipe-actions-to-a-list)

---

## 1. Goal

Make the row swipe gesture feel like native iOS swipe actions (Mail / `List.swipeActions`): the row should track the finger, springs should carry the finger's velocity, a flick should open the row, the action button should stretch under an over-drag, and a full swipe should commit with haptic + visual feedback.

### Why we can't literally adopt the guide's approach

The referenced guide uses the `.swipeActions(edge:allowsFullSwipe:)` modifier, which **only works on rows inside a SwiftUI `List`**. EVY pages render rows in `ScrollView { VStack { ForEach { EVYRow } } }` (`ios/evy/UI/EVYPage.swift:99`), and search results render `EVYRow` inside their own stack (`ios/evy/UI/Views/EVYSearch.swift:88`). Migrating the SDUI page renderer to `List` would impose List's row chrome (separators, insets, selection background), break heterogeneous rows (calendar's horizontal scrolling, containers, the footer layout) and is out of scope. This was already the call made in `docs/plans/slide-left-trigger.md` §1.

Instead we use the guide's **native behavior as the parity checklist** and close the gap in our custom container:

| Native behavior (`.swipeActions` / Mail) | Current custom container |
| --- | --- |
| Release animates with a spring that inherits finger velocity | Release **jump-cuts** with no animation at all (bug, §2 P1) |
| A quick flick opens the actions even over a short distance | Decision is distance-only; flicks under 36pt snap back (§2 P2) |
| Button stretches to fill the revealed area on over-drag | Button is fixed 72pt; over-drag reveals blank page background (§2 P4) |
| `allowsFullSwipe` commits with a haptic and the button sweeping across | Full swipe executes silently with no commit feedback (§2 P5/P6) |

---

## 2. Current defects (verified in code)

All in `ios/evy/UI/EVYSwipeableRow.swift` unless noted.

- **P1 — releases are not animated.** `contentOffset` (lines 116–121) switches source the instant `isDragging` flips false: while dragging it returns `dragOffset`; afterwards it returns `isOpen ? -revealWidth : 0`. In `onEnded` (168–183), `isDragging = false` and the `coordinator` mutation both happen **outside** any animation transaction, while `withAnimation { dragOffset = ... }` in `openWithAnimation`/`closeWithAnimation` (213–225) animates a value that is no longer being displayed. Net effect: every release — snap-open, snap-closed, tap-to-close (140–147), and cross-row auto-close (157–160) — is an instantaneous jump cut. This is the single biggest source of the "not smooth" feel.
- **P2 — no velocity input.** `EVYSwipeGeometry.endState(translation:isOpen:rowWidth:)` (39–55) decides purely on distance. A natural quick flick travels < `revealSnapThreshold` (36pt) and snaps back closed. The pan recognizer already has `velocity(in:)` (used only for the begin gate at 307–317) but it is never passed to the geometry.
- **P3 — springs can't inherit velocity.** Even once P1 is fixed, `withAnimation(.spring(response:dampingFraction:))` starts from zero velocity, so a fast drag decelerates unnaturally at release.
- **P4 — button doesn't stretch.** The trailing button has a fixed `frame(width: revealWidth)` (126). During a drag past −72 (rubber band and full swipe both go further) the extra revealed area shows the page background instead of the action color.
- **P5 — no haptics.** Native full-swipe fires an impact when the drag crosses the commit threshold. We have none.
- **P6 — no commit animation.** On `.execute` the row just spring-closes (`executeAndClose`, 227–230); nothing communicates "the action fired".
- **P7 — dead code.** `engagementMinimumDistance` (16) is never referenced. The `onChange(of: coordinator.openRowId)` handler (189–194) animates `dragOffset`, which is not displayed when `isDragging == false` — dead path today, but it becomes the real animation path after the refactor.

---

## 3. Design

### 3.1 Geometry additions (`EVYSwipeGeometry` — pure, unit-testable)

Keep every decision in the pure enum so `ios/evyTests/EVYSwipeGeometryTests.swift` covers it without SwiftUI. New/changed API:

```swift
enum EVYSwipeGeometry {
  // existing constants unchanged: revealWidth 72, revealSnapThreshold 36,
  // fullSwipeThresholdFraction 0.55, rubberBandFactor 0.35
  // engagementMinimumDistance: REMOVED (dead, P7)

  /// UIScrollView-style projection: where the finger would coast to.
  /// projected = rawOffset + velocityX * decel/(1 - decel) / 1000, decel = .normal (0.998)
  static func projectedOffset(rawOffset: CGFloat, velocityX: CGFloat) -> CGFloat

  /// BREAKING SIGNATURE CHANGE: adds `velocity`.
  /// - .execute if rawOffset passes the full-swipe threshold, OR the projected
  ///   offset passes it AND |velocityX| >= executeFlickVelocity (1000 pt/s) —
  ///   so a deliberate hard flick commits like native allowsFullSwipe, but a
  ///   slow drag must physically cross the threshold.
  /// - .open / .closed decided on projectedOffset vs revealSnapThreshold
  ///   (falls back to today's displayOffset rule when velocity is zero).
  static func endState(translation: CGSize, velocity: CGSize, isOpen: Bool, rowWidth: CGFloat) -> EVYSwipeEndState

  /// Button background width during drag: max(revealWidth, -offset), min 0.
  static func revealButtonWidth(for offset: CGFloat) -> CGFloat

  /// Did this drag step cross the full-swipe commit threshold (either direction)?
  /// Drives the haptic. Pure function of (previousOffset, currentOffset, rowWidth).
  static func crossedExecuteThreshold(previousOffset: CGFloat, currentOffset: CGFloat, rowWidth: CGFloat) -> Bool

  /// Normalized initial velocity for an interpolating spring:
  /// velocityX / (targetOffset - currentOffset), clamped to a sane range,
  /// 0 when the distance is ~0.
  static func springInitialVelocity(velocityX: CGFloat, currentOffset: CGFloat, targetOffset: CGFloat) -> CGFloat
}
```

Constants to add: `executeFlickVelocity: CGFloat = 1000`, `decelerationRate: CGFloat = 0.998` (i.e. projection factor ≈ 0.499s).

### 3.2 View refactor (`EVYSwipeableRow`)

**Single source of truth for position.** Replace the dual `dragOffset` / `contentOffset` scheme with one `@State private var offset: CGFloat` that always drives `.offset(x:)`:

- `onChanged`: write `offset` directly inside `var transaction = Transaction(); transaction.disablesAnimations = true` (finger-tracking, never animated).
- `onEnded`: compute `endState` with translation **and velocity** (the pan overlay's `onEnded` closure gains a `velocity: CGSize` parameter, read from `recognizer.velocity(in:)`), then settle:
  ```swift
  withAnimation(.interpolatingSpring(stiffness: 320, damping: 30,
      initialVelocity: EVYSwipeGeometry.springInitialVelocity(...))) {
    offset = target   // 0 or -revealWidth
  }
  ```
- `onChange(of: coordinator.openRowId)` becomes the *real* close/open path for non-dragging rows (tap-to-close, cross-row auto-close): `withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) { offset = ... }` — fixes P1 for those paths with the existing guard `!isDragging`.
- `openWithAnimation`/`closeWithAnimation` collapse into a `settle(to:velocityX:)` helper; coordinator mutations stay, but the onChange handler must not double-animate a row already at target (guard `offset != target`).

**Button stretch (P4).** The trailing button's background gets `.frame(width: EVYSwipeGeometry.revealButtonWidth(for: offset))`; the ellipsis icon stays in a fixed trailing 72pt slot (`.frame(width: revealWidth)` inside, aligned trailing) so it doesn't drift during over-drag. Keep the existing `opacity`/`allowsHitTesting` gates keyed on `offset`.

**Haptics (P5).** Track `@State private var isPastExecuteThreshold = false`. In `onChanged`, when `EVYSwipeGeometry.crossedExecuteThreshold(...)` reports a crossing, flip the flag and fire `UIImpactFeedbackGenerator(style: .medium).impactOccurred()` (generator held in a `@State` and `.prepare()`d in `onBegan`). Fires on entering *and* leaving the commit zone, matching native.

**Commit animation (P6).** On `.execute`: animate `offset` to `-rowWidth` with a quick ease-out (~0.15s) so the button sweeps across, call `onExecute()`, then reset `offset` to 0 *without* animation once the sweep completes (use `withAnimation(_:completionCriteria:)` — deployment target is iOS 17+; CI runs iOS 26 sims). The reset is invisible behind the pushed page/sheet; if the action fails to navigate, the row is simply closed again.

**Unchanged surface.** `swipeIdentity`/`EVYSwipeRowIdentity`, `EVYSwipeCoordinator`, the accessibility identifier `slideLeft_<identity>` (e2e depends on it), the begin-gate logic in `gestureRecognizerShouldBegin`, and the `EVYRow.renderedRow` call site (`ios/evy/UI/EVYRow.swift:327-339`) all stay as-is.

---

## 4. File map

| File | Change |
| --- | --- |
| `ios/evy/UI/EVYSwipeableRow.swift` | Geometry: add velocity projection, `endState` velocity param, `revealButtonWidth`, `crossedExecuteThreshold`, `springInitialVelocity`; remove dead `engagementMinimumDistance`. View: single `offset` state, velocity-seeded springs, button stretch, haptics, commit animation. Stays one file — geometry + view change together. |
| `ios/evyTests/EVYSwipeGeometryTests.swift` | Update existing `endState` tests for the new signature (pass `velocity: .zero` — behavior with zero velocity must be unchanged); add tests for projection, flick-open, flick-execute, button width, threshold crossing, spring velocity normalization. |
| `ios/e2e/e2e.swift` | **No planned change.** `E2ESlideLeftTests` (line 2956) must pass as-is: it uses `swipeLeft(velocity: .slow)` expecting reveal-then-tap, with a built-in fast-full-swipe fallback that auto-executes. If the slow swipe now projects past the execute threshold, that's a signal the flick-velocity gate (1000 pt/s) is too low — fix the constant, don't loosen the test. |

No schema, web, or service changes — this is purely iOS presentation.

---

## 5. Tasks

### Phase A — geometry (TDD, pure functions)

1. In `EVYSwipeGeometryTests.swift`, update every existing `endState(...)` call to the new signature with `velocity: .zero`, and add new failing tests:
   - `projectedOffset` at zero velocity returns the raw offset; leftward velocity projects further left (assert the 0.499 factor within accuracy).
   - Short leftward translation (−20) + fast leftward flick (−800 pt/s), closed, row 320 → `.open` (today this is `.closed`).
   - Same translation, velocity `.zero` → `.closed` (regression guard).
   - Raw offset past the full-swipe threshold, velocity `.zero` → `.execute` (unchanged behavior).
   - Translation −100 + flick −1200 pt/s on a 320 row → `.execute` (projected past threshold AND above `executeFlickVelocity`).
   - Translation −100 + velocity −600 pt/s on a 320 row → `.open`, **not** `.execute` (projection alone must not commit).
   - Open row + rightward flick (+600 pt/s) with small translation → `.closed`.
   - `revealButtonWidth`: offset 0 → 72; −40 → 72; −120 → 120.
   - `crossedExecuteThreshold`: crossing in (−170 → −180 on row 320, threshold −176) → true; crossing out → true; no crossing → false.
   - `springInitialVelocity`: velocityX −500, current −22, target −72 → 10 (i.e. −500 / −50); zero distance → 0.
2. Run the geometry tests, confirm they fail to compile/pass:
   `cd ios && xcodebuild test -project evy.xcodeproj -scheme evy -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:evyTests/EVYSwipeGeometryTests`
   (Unit tests in this bundle can hit the live API — have `docker compose up` running from repo root and reseed after, per the usual workflow.)
3. Implement the geometry changes in `EVYSwipeGeometry` (constants, `projectedOffset`, new `endState`, `revealButtonWidth`, `crossedExecuteThreshold`, `springInitialVelocity`; delete `engagementMinimumDistance`).
4. Re-run the geometry tests; all green.
5. Commit (`swipe geometry: velocity-aware end state`).

### Phase B — view refactor

6. Thread velocity through `EVYSwipePanOverlay`: `onEnded` closure becomes `(_ translation: CGSize, _ velocity: CGSize) -> Void`, reading `recognizer.velocity(in: recognizer.view)` in `handlePan`.
7. Refactor `EVYSwipeableRow` to the single-`offset` model (§3.2): direct writes in `onChanged` with animations disabled, velocity-seeded `interpolatingSpring` settle in `onEnded`, animated `onChange(of: openRowId)` for tap-to-close and cross-row close, `settle(to:velocityX:)` replacing `openWithAnimation`/`closeWithAnimation`.
8. Build to verify no other call sites break: `xcodebuild build -project evy.xcodeproj -scheme evy -destination 'platform=iOS Simulator,name=iPhone 17'`.
9. Add the button stretch (`revealButtonWidth`, icon fixed in trailing 72pt slot).
10. Add haptics (threshold-crossing flag + `UIImpactFeedbackGenerator`, prepared in `onBegan`).
11. Add the `.execute` commit sweep (animate to `-rowWidth`, `onExecute()`, non-animated reset via `withAnimation(_:completionCriteria:)`).
12. Run the full unit-test bundle: `xcodebuild test ... -only-testing:evyTests`. Reseed the dev DB afterwards.
13. Commit (`swipeable row: velocity springs, stretch, haptics, commit sweep`).

### Phase C — validation

14. Manual feel-check in the simulator (launch the app against the local stack): slow drag tracks the finger 1:1; release under 36pt springs closed *smoothly* (no jump cut); a short fast flick opens; drag past ~55% row width stretches the button and ticks a haptic; releasing there sweeps the button across and fires the action; tapping elsewhere / swiping another row animates the open row closed.
15. Run the slide-left e2e class only (full e2e is slow):
    `bash run-e2e.sh` is the CI path; locally follow the docker-compose + seed workflow and run `xcodebuild test ... -only-testing:e2e/E2ESlideLeftTests` from `ios/`. Both assertions in `testSlideLeftButtonNavigatesToDestinationPage` must pass without loosening the test (see §4 note about the flick-velocity constant).
16. Final commit if anything changed in validation; reseed the dev DB.

---

## 6. Out of scope / follow-ups

- Leading (left-edge) swipe actions, multiple buttons per row, author-configurable button label/icon — unchanged from `slide-left-trigger.md` §6.
- Migrating pages to `List` to use native `.swipeActions` — rejected (§1).
- Scroll-to-dismiss (closing an open row when the page scrolls) — nice-to-have; the coordinator makes it easy later (call `closeAll()` from a scroll-position `onChange` in `EVYPage`), but it's not part of the smoothness fix.
