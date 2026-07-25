# Architecture Audit — Status and Remaining Work

**Source:** platform architecture audit performed 2026-07-24 on `feat/dynamic-resources` (HEAD `9a1c865b`).

The phase-by-phase execution instructions this file used to carry are done, and
the sequence is recorded in git history on `feat/overhaul`. What follows is the
decision record: what the audit changed, what it deliberately left alone, and
what is still open.

## Context

The audit covered the platform as a whole and each client, looking for pieces
tacked on that no longer fit and older approaches that could be unified. Four
areas were called out up front: the action system and its relationship with
drafts, app↔API communication (sync, procedures, messages), the web builder and
its action/modal editing, and id interpolation.

**Excluded by decision.** Auth, devices and addresses are vestigial on purpose:
they record users and devices and do nothing else yet. Nothing in the audit
treats their emptiness as a defect, and no work should be scheduled against them
until they are meant to do something.

## Completed

| Decision | Where it lives |
| --- | --- |
| Actions are structured invocations, not call strings | [`action.schema.json`](../../types/schema/sdui/action.schema.json), `ios/evy/UI/EVYActionInvocation.swift`, `types/actionAst.ts` |
| A flow declares the entity it submits rather than clients inferring it | `submits` on `DATA_EVY_Flow` / `UI_Flow`, `assertUiFlowSubmitsDeclaration` in `types/validators.ts` |
| Expression grammar is one shared contract, tested from both clients | [`types/grammar/README.md`](../../types/grammar/README.md) |
| Sync resumes from a server-issued cursor and applies tombstones | `api/src/procedures/sync.ts`, `ios/evy/Core/EVY+Sync.swift` |
| One unreachable resource degrades a sync instead of failing it | per-resource errors in `api/src/procedures/sync.ts` |
| Deletes are tombstones, purged after a retention window | `api/src/data/tombstones.ts` |
| Concurrent editors are detected rather than silently overwriting | `filter.expectedUpdatedAt`, `api/src/data/conflicts.ts` |
| Procedures are declared in one registry that dispatch is checked against | [`procedures.json`](../../types/schema/resources/procedures.json), `api/src/procedures/coreApi.ts` |
| Services can own procedures and be forwarded to | `forwardApi` in `api/src/procedures/services.ts` |
| Service endpoints are configuration, with attributed failures and timeouts | `resolveServiceWsEndpoint`, `ServiceForwardError` |
| iOS resolution and mutation carry an explicit scope | `ios/evy/Core/EVYScope.swift` |
| Marketplace validates its own payloads per resource | `services/marketplace/src/data.ts` |
| The builder shares one modal primitive | [`web/app/components/Modal.tsx`](../../web/app/components/Modal.tsx) |

## Remaining

**Retire the ambient iOS scope.** `EVY+Mutations` still reads the active cache
scope ambiently, and SwiftUI initialisers cannot read `@Environment`, so
`EVYScope.ambient` remains the floor. Rows carry an explicit scope for reads and
run their actions inside `withScope`, so nothing on a page depends on it;
finishing the job means threading scope through the mutation API. Done when
`ambient` has no readers.

**Honour `expectedUpdatedAt` in services.** Optimistic locking is implemented in
core only. Marketplace's update is its own implementation, so a forwarded write
is still last-write-wins. Done when a stale precondition is rejected by a service
the same way core rejects it.

**Schedule the tombstone purge.** `bun run --cwd api purge:tombstones` exists and
is verified, but nothing runs it. Done when it runs on a schedule in every
environment that holds data.

**Delete the action migration script.** `scripts/migrate-actions-to-ast.ts` is a
one-off for environments still holding legacy branches. Done when every
environment reports zero conversions; the fixture regression test stays.

**Make the web build typecheck.** `tsc -p web/tsconfig.json` reports errors, some
of them in generated types, where `json-schema-to-typescript` emits an index
signature alongside optional properties. This gap is why `notification.record` —
a field the protocol does not have — shipped. Done when a typecheck step runs in
CI; needs a decision on the generated-output errors first, since hand-editing
generated files is not an option.

## Deferred by decision

- Auth enforcement, identity, server-side visibility filtering, devices,
  addresses — see Excluded above.
- serviceKit extraction and DB driver unification.
- iOS Observation-native invalidation in place of notification-driven recompute.
