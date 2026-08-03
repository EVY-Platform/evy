# Service hooks

When the API gateway handles a `create` for an enrolled core resource, it can
synchronously call hooks on the **target service** — the service named in the
row's `resource` field (for messages, `data.resource` like `marketplace.items`).

Hooks run on any core create that goes through `hookedCreate` in
[`api/src/procedures/hooks.ts`](../../api/src/procedures/hooks.ts): JSON-RPC
`create` calls, payment procedures appending transaction rows, and payment
webhooks authoring failure messages. Direct data-layer writes that bypass
`hookedCreate` (seeds, unit tests calling `createCore`) do not trigger them.

## Wire contract

Services expose a single JSON-RPC method, `hook`. The hook name travels in the
params:

| Schema | Purpose |
|--------|---------|
| [`types/schema/rpc/hook.request.schema.json`](../../types/schema/rpc/hook.request.schema.json) | `HookRequest` — `hook`, `resource`, `data` |
| [`types/schema/rpc/hook.response.schema.json`](../../types/schema/rpc/hook.response.schema.json) | `HookResponse` — `ok`, optional `reason` |

`hook` is either `before_create` or `after_create`.

- **`before_create`** — `data` is the client-supplied create payload. The service
  may veto the write by returning `{ ok: false, reason: "..." }`.
- **`after_create`** — `data` is the row as written (ids and timestamps final).

## Ordering

For an enrolled resource create:

```
before_create → database write → after_create → return response
```

## Skip rules

Hooks are skipped (create proceeds as today) when:

- The core resource is not enrolled (only `evy.messages` and `evy.transactions` today).
- The message's target `resource` ref is missing, invalid, or points at `evy.*`.
- The target service has no row / adapter in the gateway (unregistered service).
- The service is registered but does not implement `hook` (JSON-RPC `-32601`).

When the target service is not registered, `forwardHook` returns `null` and the
create proceeds (fail-open beside the fail-closed `before_create` veto path).

## Failure semantics

| Hook | Behaviour |
|------|-----------|
| **`before_create`** | Fail closed. `ok: false` rejects the create with the service's reason. Transport errors and timeouts also reject the create. When a **message** create is vetoed, evy core authors a `request_failed` message on the same chain (unless the payload was already `request_failed`, which never recurses). |
| **`after_create`** | Best effort. The row is already durable; failures are logged with `console.error` and the create response is returned normally. |

## Enrolling a core resource

Add the core resource ref to `HOOKED_CORE_RESOURCE_REFS` in
[`api/src/procedures/hooks.ts`](../../api/src/procedures/hooks.ts). The gateway
resolves the target service from `data.resource` via `serviceOfRef`.

## Opting in as a service

Register `hook` on your JSON-RPC server, validate params with
`validateHookRequest`, and return a `HookResponse`. See
[`services/marketplace/src/hooks.ts`](../../services/marketplace/src/hooks.ts)
and [`services/marketplace/src/rpc.ts`](../../services/marketplace/src/rpc.ts).

## Marketplace (first consumer)

Marketplace validates purchase messages in `before_create` against
`item_status_history` and appends status rows in `after_create`. Transaction
hooks on `after_create` drive `sold` when a `{charge, succeeded}` row appears.
Implementation:
[`services/marketplace/src/purchase.ts`](../../services/marketplace/src/purchase.ts),
[`services/marketplace/src/status.ts`](../../services/marketplace/src/status.ts).
Status machine tables and message vocabulary: [marketplace data models](../services/marketplace/data.md#purchase-status-machine).
