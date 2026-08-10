# Plan: Transaction signature trail (proof of payment origin)

Status: implemented on `feat/transaction-signatures`.
Branch: `feat/transaction-signatures`.

## 1. Goal

To prove that a customer authorized a payment (and later received/sent funds), every
transaction ledger row must carry a **client-originated signature** instead of today's
placeholder string `"signed"`. The signature is generated on the buyer's device, travels
to the `payment_intent` procedure, is **verified server-side against the payment method's
real last-4 digits before the Stripe PaymentIntent is created**, and is stored on every
row of that payment's append-only ledger (intent → initiated → succeeded/failed →
completed, for both `charge` and `transfer`).

Wire/storage shape (exactly this, all fields required):

```json
{
  "data": {
    "amount": 250,
    "currency": "AUD",
    "authorization_message_id": "95a6a85b-e289-471c-b7fe-440ec2dfa2dc",
    "created_at": "2026-08-02T00:03:30",
    "payment_provider": "stripe",
    "payment_method_last_4_characters": "4242"
  },
  "hash": "<sha256 hex>"
}
```

- The last-4 is stored **in plaintext** — PCI-DSS treats it as non-sensitive (it appears
  on printed receipts), so no encryption or hash commitment is applied to it (see 3.1.1
  for the decision history).
- `hash` = SHA-256 over the canonical serialization of `data` (§3.1). It binds amount,
  currency, message, timestamp, provider, and last-4 into one tamper-evident value.
- Support flow: if a payment is disputed, the last-4 is right on the row; recomputing
  `hash` from the stored `data` fields proves the row wasn't altered, and asking the
  customer for their last-4 confirms it matches what they authorized.

## 2. Current state (read these before starting)

| What | Where |
| --- | --- |
| Placeholder written today (`signature: "signed"`) | `api/src/procedures/paymentsShared.ts:113` inside `appendTransactionRow`, the single writer for **all** ledger rows |
| `paymentIntent` procedure (calls Stripe `createPaymentIntent` then appends the intent row) | `api/src/procedures/payments.ts:44-68` |
| Webhook-driven rows (succeeded/failed/completed) — all copy fields from the intent row | `api/src/procedures/paymentWebhook.ts` (`WEBHOOK_HANDLERS` + `appendTransactionRow(db, intent, …)`) |
| Stripe gateway interface + real/mock implementations | `api/src/procedures/stripeGateway.ts:29-34`, `api/src/procedures/stripeGatewayMock.ts` |
| Transaction row schema (`signature` is `type: string`, "Always \"signed\" in v1") | `types/schema/data/data.schema.json` `$defs.DATA_EVY_Transaction` |
| `payment_intent` request schema (`additionalProperties: false` — unknown fields are **rejected**) | `types/schema/rpc/payment_intent.request.schema.json` |
| Request/response validation wrap | `api/src/procedures/coreApi.ts:50-55`, validators in `types/validators.ts:814-823` |
| Drizzle column (`signature: text(...)`) | `types/generated/ts/db/schema.generated.ts:154` (generated — never hand-edit) |
| Codegen pipeline | `bun run types:generate` → runs `scripts/generate-types.ts` + `scripts/generate-drizzle.ts` (jsonb columns come from object `$defs` listed in `types/schema/data/drizzle.config.json` `nonTableDefs`, cf. `DATA_EVY_RowData`) |
| DB migrations | `api/drizzle/0000_baseline.sql`; `bun run --cwd api db:generate` (drizzle-kit) |
| **Who actually calls `payment_intent`**: no device does. The marketplace service calls it from message `after_create` hooks | `services/marketplace/src/payments.ts:112-132` (`runPaymentIntent`), hook wiring `services/marketplace/src/hooks.ts:47-51`, trigger table `paymentActionForMessage` at `services/marketplace/src/payments.ts:23-51` |
| Messages that trigger `payment_intent`: `delivery`/`shipping` + `pending`, `pickup` + `transaction` | same file; the buyer's device creates these messages via SDUI `create(evy.messages, {…})` actions |
| Fixture create-actions for those messages | `scripts/fixtures/services/service_sdui.json` lines ~321 (delivery/pending), ~457 (shipping/pending), ~1023 (pickup/transaction) |
| iOS create pipeline — client generates the message id (`UUID().uuidString.lowercased()`) and `created_at` **after** the data map is resolved | `ios/evy/Core/EVY+Mutations.swift:178-215` (`createWithGeneratedId`) |
| iOS interpreter functions (string-output only: `EVYFunctionOutput.value: String`) | `ios/evy/Utils/interpreter.swift:530-575`, `ios/evy/Utils/functions.swift:10` |
| Grammar parity rule: any parser/function change must add conformance vectors in the same commit | `types/grammar/README.md`, `types/grammar/conformance.json`; TS runner `web/app/utils/grammarConformance.test.ts`, Swift runner `ios/evyTests/GrammarConformanceTests.swift` |
| iOS has **zero crypto today** (no CryptoKit import anywhere) | — |
| Tests asserting the `"signed"` placeholder | `api/src/tests/payments.test.ts:52`, `api/src/tests/wsTestHelpers.ts:132` (`types/wsTestHelpers.ts` is the actual file — the api test helpers re-export from there; check both), `api/src/tests/hooks.test.ts:181` |
| Docs describing the placeholder | `docs/evy/data.md` §DATA_EVY_Transaction (~lines 164-172), `types/schema/rpc/payment_intent.request.schema.json` description |

**No `last4` / payment-method concept exists anywhere.** v1 hardcodes Stripe's test card
`pm_card_visa` (last-4 `4242`) at `api/src/procedures/stripeGateway.ts:100`.

## 3. Design decisions (locked for this plan)

### 3.1 Signature spec (implemented identically in TS and Swift)

Canonical string — the 6 values joined with `\n`, UTF-8 encoded:

```
evy-txn-sig-v1
<amount formatted with exactly 2 decimals, e.g. "250.00">
<currency, uppercase, e.g. "AUD">
<authorization_message_id, lowercase uuid>
<created_at, verbatim as carried in data>
<payment_provider, e.g. "stripe">
<last4-field-value>
```

- `hash` = lowercase hex SHA-256 of the canonical string, with the **plaintext** last-4
  in the final position.
- Amount is formatted with `.toFixed(2)` (TS) / `String(format: "%.2f", …)` (Swift).
  Documented limitation: assumes 2-decimal currencies; fine for AUD-only v1.

The sample hashes in the task description are 40-hex placeholders; we standardize on
SHA-256 (64 hex). The `evy-txn-sig-v1` prefix versions the scheme.

### 3.1.1 Why plaintext last-4 and a single hash (decision history)

Two stronger schemes were considered and rejected, in order:

1. **Asymmetric encryption of the last-4** (X25519 + HKDF + AES-256-GCM; no new deps on
   either platform): rejected because it requires key management, and this platform has
   none by design — servers and their databases are created and destroyed at any time,
   so there is no durable home for a private key, and losing it would orphan every
   stored signature.
2. **Keyless salted-hash commitment + dual hashes** (`hash_encrypted`/`hash_decrypted`):
   without a key, a hash over a 4-digit space (10⁴ candidates, salt public in the same
   object) is trivially brute-forceable, so it never provided real confidentiality —
   only complexity.

Since PCI-DSS treats the last-4 as non-sensitive (it appears in plaintext on receipts),
pretending to protect it buys nothing. Storing it in plaintext with **one** hash keeps
every property that matters: the hash still proves the row wasn't altered and binds the
last-4 to the amount/message/timestamp, the server still verifies it against Stripe
before creating the intent, and the dispute flow gets simpler (the value is readable on
the row). The `evy-txn-sig-v1` version prefix leaves room for a keyed scheme if the
ephemerality constraint ever changes.

### 3.2 Transport path (how the client's signature reaches the procedure)

Devices do not call `payment_intent`; the marketplace service does, from message hooks.
So the signature rides on the payment-triggering message:

1. Buyer's device creates the `evy.messages` row (delivery/shipping `pending`, or pickup
   `transaction`) with the full signature object embedded at `message.data.signature`.
2. Marketplace `before_create` hook rejects a payment-triggering message without a
   structurally valid signature (buyer sees the standard `request_failed` flow).
3. Marketplace `after_create` → `runPaymentIntent` forwards `message.data.signature` as
   the new required `signature` param of `payment_intent`.
4. `paymentIntent` verifies it (see 3.3) **before** `getStripeGateway().createPaymentIntent`,
   and stores it on the intent row.
5. Every subsequent ledger row (capture/cancel/webhook/transfer paths) copies the intent's
   signature via `appendTransactionRow`'s `TransactionRowSource` — one payer signature per
   payment, present on the whole trail. Seller-side actions do not get their own
   signatures in this iteration (out of scope, note in docs).

`signature.data.authorization_message_id` is the id of the message that carries it —
self-referential, which works because iOS generates message ids client-side *before*
dispatching the create (`createWithGeneratedId`).

### 3.3 Server verification (inside `paymentIntent`, before any Stripe/db write)

1. Cross-check `signature.data` against request params: `amount` (compare as 2-decimal
   strings), `currency`, `authorization_message_id`, and `payment_provider === "stripe"`.
2. Recompute `hash` from `signature.data` as given → must equal `signature.hash`
   (integrity; no Stripe call needed).
3. `last4 = await gateway.getPaymentMethodLast4()` (new gateway method — the "get payment
   methods" API). Require
   `signature.data.payment_method_last_4_characters === last4`.
4. Any mismatch → `throw new Error("invalid payment signature: <which check>")`. The RPC
   fails, **no Stripe PaymentIntent is created and no transaction row is written**.

### 3.4 Client generation (iOS)

- New CryptoKit-based util mirrors 3.1.
- New interpreter function `payment_signature(<amountExpr>, <currencyExpr>)` usable in
  fixture data maps. Because interpreter functions output strings only
  (`EVYFunctionOutput.value: String`), it returns a JSON **marker string**:
  `{"evy_pending_payment_signature":{"amount":250,"currency":"AUD"}}`.
- `createWithGeneratedId` (which alone knows the new message id and `created_at`) detects
  the marker at `payload.data.signature` on `evy.messages` creates and replaces it with
  the finalized signature object (fills `authorization_message_id` = new id, `created_at`,
  `payment_provider: "stripe"`, the plaintext last-4, and computes `hash`).
- Plaintext last-4 on the device: constant `"4242"` (matches the server's hardcoded
  `pm_card_visa`) in one named placeholder, to be replaced when real payment-method
  collection lands.
- This is the "declarative fixture opts in, runtime completes what only it knows" split:
  same pattern as `id` / `created_at` / `visibility`, which the create pipeline already
  fills (`EVY+Mutations.swift:183-194`).

### 3.5 Storage

`signature` column changes `text` → `jsonb` holding the full object. New object `$def`
`DATA_EVY_TransactionSignature` in `data.schema.json`, listed in `drizzle.config.json`
`nonTableDefs` (the existing `DATA_EVY_RowData` pattern produces
`jsonb(...).$type<...>()`). The `payment_intent` request schema `$ref`s the same def
(cross-file refs are established practice: `payment_intent.response.schema.json` already
refs `../data/data.schema.json#/$defs/DATA_EVY_Transaction`).

## 4. File map

### New files

| File | Responsibility |
| --- | --- |
| `types/paymentSignature.ts` (+ export in `types/package.json`) | Canonical string, SHA-256 helper (`node:crypto`), `computeSignatureHash`, `buildTransactionSignature` (test/tooling helper), `verifyTransactionSignature(signature, params, last4)` returning `{ok} | {ok:false, reason}`. Pure functions, no I/O, **no keys** — server verification and test fixture-building both use it |
| `api/src/tests/paymentSignature.test.ts` | Unit tests for the util (golden vectors, tamper cases) |
| `ios/evy/Utils/EVYPaymentSignature.swift` | Swift mirror: CryptoKit SHA-256, canonical string, marker parsing, `finalize(marker:messageId:createdAt:) -> EVYJson` + `PLACEHOLDER_CARD_LAST4 = "4242"` |
| `ios/evyTests/EVYPaymentSignatureTests.swift` | Swift unit tests incl. the **same golden vectors** as the TS tests (cross-platform determinism proof) |
| `api/drizzle/000X_transaction_signature_jsonb.sql` | Generated migration (reviewed/adjusted by hand) |
| `docs/plans/transaction-signature-trail.md` | This plan |

### Modified files

| File | Change |
| --- | --- |
| `types/schema/data/data.schema.json` | Add `$defs.DATA_EVY_TransactionSignature`; change `DATA_EVY_Transaction.signature` to `$ref` it; update description |
| `types/schema/data/drizzle.config.json` | Add `DATA_EVY_TransactionSignature` to `nonTableDefs` |
| `types/schema/rpc/payment_intent.request.schema.json` | Add required `signature` property (`$ref` the def); rewrite the "signature=\"signed\"" description |
| `types/generated/**` | Regenerated, never hand-edited |
| `api/src/procedures/stripeGateway.ts` | Add `getPaymentMethodLast4(): Promise<string>` to the interface + real impl (`stripe.paymentMethods.retrieve` — see Risks) |
| `api/src/procedures/stripeGatewayMock.ts` | Mock `getPaymentMethodLast4` → `"4242"` |
| `api/src/procedures/payments.ts` | `paymentIntent`: verify signature (3.3) before `createPaymentIntent`; thread `signature` into the row source |
| `api/src/procedures/paymentsShared.ts` | `TransactionRowSource` gains `signature`; `appendTransactionRow` writes `source.signature` instead of `"signed"` |
| `types/wsTestHelpers.ts` + `api/src/tests/wsTestHelpers.ts` | `validPaymentIntentRequest` builds a real signature via `types/paymentSignature.ts` |
| `api/src/tests/payments.test.ts`, `api/src/tests/hooks.test.ts` | Replace `"signed"` assertions; add verification-failure tests |
| `services/marketplace/src/purchase.ts` | `MessagePayload` picks `data` too |
| `services/marketplace/src/payments.ts` | `validatePaymentPreconditions` requires a structurally valid `data.signature` for `payment_intent` actions; `runPaymentIntent` forwards it |
| `services/marketplace/src/tests/payments.test.ts` | Cover forwarding + missing-signature veto |
| `ios/evy/Utils/interpreter.swift` + `ios/evy/Utils/functions.swift` | Register `payment_signature` function returning the marker JSON string |
| `ios/evy/Core/EVY+Mutations.swift` | `createWithGeneratedId`: finalize marker for `evy.messages` payloads |
| `types/grammar/conformance.json` | Vectors for `payment_signature` in value position |
| `web/app/utils/functions.ts` (wherever the TS function registry lives) | TS parity for the marker-producing function so the conformance suite passes |
| `scripts/fixtures/services/service_sdui.json` | Add `signature: {payment_signature(...)}` to the 3 payment-triggering message creates |
| `docs/evy/data.md` | Rewrite §DATA_EVY_Transaction signature paragraphs + procedure list; add the support/dispute flow note |

## 5. Tasks

Run all commands from the repo root unless noted. After every phase: `bunx biome check --write .`
for TS, `xcrun swift-format format --in-place --recursive ios` for Swift (or `bun run format`).

### Phase 0 — branch

1. `git checkout -b feat/transaction-signatures dev` (branch off the PR base, `dev`).

### Phase 1 — shared signature utility (TS), test-first

2. Write `api/src/tests/paymentSignature.test.ts` against the not-yet-existing
   `evy-types/paymentSignature` API: golden vector (fixed inputs → exact 64-hex `hash`,
   copy the expected value into the test once computed), tampered amount/currency/
   created_at/last4 → specific `{ok:false, reason}` values, amount `250` vs `250.0`
   canonicalize identically.
3. Run it, confirm it fails to resolve the module:
   `bun run --cwd api test:unit src/tests/paymentSignature.test.ts` (this repo's api unit
   test entry; expect module-not-found).
4. Implement `types/paymentSignature.ts` per §3.1/§3.3 (pure functions, `node:crypto`
   `createHash("sha256")` — no new deps, nothing to add to root `package.json`). Also
   export the `DATA_EVY_TransactionSignature` TS type by re-exporting from generated types
   *after Phase 2*; until then type the shape locally in the module.
5. Add `"./paymentSignature": "./paymentSignature.ts"` to `types/package.json` exports.
6. Re-run step 3's command; make it pass. Record the golden-vector hash — the Swift
   tests (Phase 5) must reproduce it byte-for-byte.
7. Commit (`feat: shared transaction signature hashing util`).

### Phase 2 — schemas, codegen, migration

8. In `types/schema/data/data.schema.json`: add `$defs.DATA_EVY_TransactionSignature`
   (object, `additionalProperties: false`; required `data`, `hash`; `data` object with
   the 6 required fields — `amount` number ≥ 0, `currency` minLength 1,
   `authorization_message_id` uuid, `created_at` string, `payment_provider` enum
   `["stripe"]`, `payment_method_last_4_characters` pattern `^[0-9]{4}$`; `hash`
   pattern `^[0-9a-f]{64}$`). Change
   `DATA_EVY_Transaction.properties.signature` to `{"$ref": "#/$defs/DATA_EVY_TransactionSignature", "description": "Buyer-generated proof of payment origin; verified against the payment method's last-4 before the Stripe intent is created. Copied to every row of the payment's ledger."}`.
9. Add `"DATA_EVY_TransactionSignature"` to `nonTableDefs` in
   `types/schema/data/drizzle.config.json`.
10. In `types/schema/rpc/payment_intent.request.schema.json`: add `signature` to
    `required` + `properties` (`$ref: "../data/data.schema.json#/$defs/DATA_EVY_TransactionSignature"`),
    and rewrite the top-level `description` (drop `signature="signed"` from the
    server-side-constants sentence; describe verification failing the call).
11. `bun run types:generate` — regenerates TS types, validators' schemas, and
    `schema.generated.ts`. Confirm `types/generated/ts/db/schema.generated.ts` now has
    `signature: jsonb("signature").$type<DATA_EVY_TransactionSignature>().notNull()` and
    `types/generated/ts/rpc/payment_intent.request.ts` carries the new field. If the
    drizzle generator does not emit jsonb for the ref, extend `scripts/generate-drizzle.ts`
    following the existing `DATA_EVY_RowData` handling.
12. Replace the local type in `types/paymentSignature.ts` with the generated one.
13. Generate the migration: `bun run --cwd api db:generate`. **Review the SQL** — dev rows
    contain the literal `signed`, which does not cast to jsonb. Hand-adjust to
    `ALTER TABLE "transaction" ALTER COLUMN "signature" TYPE jsonb USING to_jsonb("signature"::text);`
    (dev/e2e data is reseeded anyway; there is no production data to preserve — servers
    and databases are ephemeral by design).
14. Verify migration applies cleanly: `docker compose up --wait postgres && bun run --cwd api db:migrate && bun run db:seed`.
15. Typecheck the workspaces that consume the types (`bunx biome check` + let each
    package's tests compile in later phases). Commit
    (`feat: transaction signature schema + jsonb column`).

### Phase 3 — API: gateway last-4 + verification in payment_intent

16. Add `getPaymentMethodLast4(): Promise<string>` to the `StripeGateway` interface
    (`api/src/procedures/stripeGateway.ts`). Real impl: extract the hardcoded
    `"pm_card_visa"` into a `STRIPE_PAYMENT_METHOD` constant, then
    `stripe.paymentMethods.retrieve(STRIPE_PAYMENT_METHOD)` → `paymentMethod.card?.last4`;
    throw a descriptive error when absent. (See Risks §7.1 — verify against the sandbox
    key during implementation.)
17. Mock impl (`api/src/procedures/stripeGatewayMock.ts`): return `"4242"`.
18. Update test helpers first: in `types/wsTestHelpers.ts` (and the api-local
    `api/src/tests/wsTestHelpers.ts` re-exports if present), make
    `validPaymentIntentRequest` build a real signature with
    `evy-types/paymentSignature` (`last4: "4242"`, `created_at: nowIso`), and fix the
    `signature: "signed"` expectation at `types/wsTestHelpers.ts` / `api/src/tests/wsTestHelpers.ts:132`.
    Any inline `StripeGateway` test doubles in `api/src/tests/payments.test.ts` gain the
    new method.
19. Write the new failing tests in `api/src/tests/payments.test.ts`:
    - valid signature → intent row's `signature` deep-equals the request's;
    - subsequent rows (capture → succeeded → completed, transfer rows) carry the same
      signature object (extend the existing lifecycle tests);
    - tampered `hash` → `payment_intent` rejects, **`createPaymentIntent` was never
      called** (spy on the test gateway), no row written;
    - `signature.data.payment_method_last_4_characters` ≠ the gateway's last-4 (e.g.
      `"1234"` with a consistent hash) → same;
    - `signature.data.amount` ≠ request amount → same;
    - update the `"signed"` assertions at `payments.test.ts:52` and `hooks.test.ts:181`.
20. Run: `bun run --cwd api test:unit` — new tests fail, old ones compile.
21. Implement: extend `TransactionRowSource` in `api/src/procedures/paymentsShared.ts`
    with `signature`, write `source.signature` in `appendTransactionRow` (drop the
    `"signed"` literal); in `api/src/procedures/payments.ts` `paymentIntent`, run the §3.3
    verification via `verifyTransactionSignature` + `gateway.getPaymentMethodLast4()`
    before `createPaymentIntent`, and pass `signature: params.signature` into the row
    source. `paymentCapture` / `paymentCancel` / `paymentTransfer` / webhook handlers need
    no changes — they already pass the intent row as source.
22. `bun run --cwd api test:unit` → green. Also `bun run --cwd api test:e2e` (needs
    postgres up + seeded).
23. Commit (`feat: verify transaction signature before creating payment intent`).

### Phase 4 — marketplace: require + forward the signature

24. Write failing tests in `services/marketplace/src/tests/payments.test.ts`:
    - `runPaymentReaction` for a delivery/`pending` message with `data.signature` →
      recorded `coreApiCalls` entry for `payment_intent` includes that exact signature;
    - `validatePaymentPreconditions` for a payment-intent-triggering message **without**
      `data.signature` (or with one missing `hash`) → `{ok:false, reason: "Missing payment signature"}`;
    - non-payment messages unaffected.
    Note the runner is serial with a shared DB: `bun run --cwd services/marketplace test:unit`.
25. Implement: add `"data"` to the `Pick` in `services/marketplace/src/purchase.ts`
    `MessagePayload`; in `services/marketplace/src/payments.ts` add a
    `signatureFromMessage(message)` helper (shape-check only — structural presence of
    `data` and `hash`; deep verification is the API's job), use it in
    `validatePaymentPreconditions` (payment_intent branch) and pass the object through in
    `runPaymentIntent`'s `callCoreApi("payment_intent", {…, signature})`.
26. `bun run --cwd services/marketplace test:unit` → green. Commit
    (`feat: marketplace requires and forwards buyer payment signature`).

### Phase 5 — iOS: signature generation

27. Add `ios/evy/Utils/EVYPaymentSignature.swift`: CryptoKit SHA-256 hex helper; canonical
    string builder identical to §3.1 (`String(format: "%.2f", amount)`); marker constant
    `evy_pending_payment_signature`; `PLACEHOLDER_CARD_LAST4 = "4242"`;
    `finalize(marker: EVYJson, messageId: String, createdAt: String) -> EVYJson` producing
    the full signature dictionary.
28. Add `ios/evyTests/EVYPaymentSignatureTests.swift` reproducing the Phase-1 golden
    vector byte-for-byte (same inputs → same `hash`), plus a
    marker→finalize test. These are pure unit tests — no live API involved. Run the unit
    test target from `ios/` (`xcodebuild test -scheme evy -only-testing:evyTests/EVYPaymentSignatureTests …`
    matching the project's existing invocation; see `ios/README.md`).
29. Register the interpreter function: in `ios/evy/Utils/functions.swift` add
    `evyPaymentSignature(_ args: String)` returning the marker JSON string built from the
    two resolved args (amount, currency); wire `case "payment_signature":` into the switch
    at `ios/evy/Utils/interpreter.swift:548` area.
30. Finalization: in `ios/evy/Core/EVY+Mutations.swift` `createWithGeneratedId`, after
    `newId`/`created_at` are set and only when the resource is `evy.messages`, detect a
    string marker at `payloadWithId["data"]["signature"]`, and replace it with
    `EVYPaymentSignature.finalize(...)`. A non-marker signature value passes through
    untouched.
31. Grammar parity (per `types/grammar/README.md`, same-commit rule): add conformance
    vectors for `{payment_signature(250, "AUD")}` (and a binding-arg variant) in
    `types/grammar/conformance.json`; implement the TS side in the web function registry
    (`web/app/utils/functions.ts` — same marker string output). Run both:
    `bun run --cwd web test:unit` and the `evyTests` grammar suite.
32. iOS unit tests green; commit (`feat: iOS payment signature generation`).

### Phase 6 — fixtures + seeds + e2e

33. Edit `scripts/fixtures/services/service_sdui.json`: the three payment-triggering
    creates (delivery `pending` ~line 321, shipping `pending` ~line 457, pickup
    `transaction` ~line 1023) gain a `signature` entry in their nested `data` map, e.g.
    `data: {time: {selected_delivery_timeslot}, signature: {payment_signature({marketplace.items.price.value}, {marketplace.items.price.currency})}}`.
    ⚠ Braces must balance across the whole action expression — an imbalance silently
    drops required create fields on iOS and looks like e2e flakiness. ⚠ Unquoted dotted
    values in data maps resolve as bindings; the function args here are intentional
    bindings, but do not add unquoted literal slugs.
34. Validate fixtures: `bun run test:scripts` (runs
    `scripts/shipped-fixture-action-branches.test.ts` among others).
35. Reseed and run the api e2e: `bun run dev:setup && bun run --cwd api test:e2e`.
36. iOS e2e (local workflow: docker compose up + seed + `xcodebuild` from `ios/`): run the
    purchase-flow e2e tests; they exercise the full chain (message create → hook →
    payment_intent with verification). Remember dev-DB junk rows from prior unit-test runs
    cause misleading alerts — reseed first.
37. Commit (`feat: purchase fixtures carry payment signatures`).

### Phase 7 — docs + wrap-up

38. Update `docs/evy/data.md` §DATA_EVY_Transaction: signature is no longer a placeholder —
    describe the object, the canonical-string/hash scheme (link the util files), the
    verification step in procedure #1 (`payment_intent` fails before Stripe when
    invalid), signature copying across the ledger, and the support flow (last-4 readable
    on the row; recompute `hash` → prove integrity; confirm last-4 with the customer).
    Note the deliberate v1 limits: buyer-only signature, placeholder last-4 `4242` until
    real payment-method collection exists, and the §3.1.1 plaintext/no-key decision.
39. Full sweep: `bun run types:generate` (idempotent check — no diff),
    `bun run test:scripts`, `bun run --cwd api test:unit`,
    `bun run --cwd services/marketplace test:unit`, `bun run --cwd web test:unit`,
    `bun run format`. Fix anything that surfaces.
40. Commit, push, open PR against `dev`.

## 6. Verification summary (what proves this works)

- Golden-vector hash equality across TS and Swift test suites (steps 2/6/28).
- API tests prove: tampered `hash` / wrong last-4 / mismatched amount → `payment_intent`
  fails **before** `createPaymentIntent` and writes nothing; valid signature lands on the
  intent row and every later ledger row (step 19).
- Marketplace tests prove the veto (missing signature → message rejected) and verbatim
  forwarding (step 24).
- Fixture/grammar suites prove the declarative form parses on both platforms (steps 31/34).
- iOS e2e proves the end-to-end chain on-device (step 36).

## 7. Risks & open questions

1. **Stripe "get payment methods" in real mode.** v1 has no Customer object, so there is
   no `customers.listPaymentMethods` to call; the plan retrieves the configured
   payment-method id (`pm_card_visa`). Stripe test *tokens* may not be retrievable via
   `paymentMethods.retrieve` — verify against the sandbox key early in Phase 3. Fallbacks,
   in order: create-and-attach a test PaymentMethod once and store its id in a
   `STRIPE_PAYMENT_METHOD` env var; or (last resort, mock-parity only) return the known
   `4242` for the hardcoded test card with a TODO. Mock mode (`STRIPE_MOCK=true`, the
   e2e/dev default) is unaffected.
2. **Cross-platform hash determinism.** Mitigated by the fixed canonical string, 2-decimal
   amount formatting, and shared golden vectors run in both languages.
3. **Drizzle generator may not handle a `$ref`'d object column.** Step 11 includes
   extending `scripts/generate-drizzle.ts` if needed (pattern exists for `DATA_EVY_RowData`).
4. **Old messages / mid-migration creates.** A message created by an old client (no
   signature) is vetoed at `before_create` once Phase 4 lands — acceptable in dev; land
   Phases 2-6 as one PR so fixtures and enforcement ship together.
5. **Last-4 is public by design.** Transaction rows sync to every device with the last-4
   in plaintext. Accepted deliberately (§3.1.1): PCI treats last-4 as non-sensitive,
   encryption would require key management the platform excludes, and a keyless hash
   over 10⁴ values never resisted enumeration anyway. The versioned prefix
   (`evy-txn-sig-v1`) leaves room for a keyed scheme later.
6. **Out of scope (deliberate):** seller-side signatures on capture/transfer, real
   payment-method collection on device, key-pair (asymmetric) signing, and any
   auth/devices work (auth is a record-only placeholder by design).
