# Person 2: Subscription flow

Three-hour hackathon scope. Build on existing code; no architecture rewrite. Prioritize the complete quote-to-invoice journey over optional lifecycle features. Earlier six-hour scheduling is superseded.

## Ownership and dependency

- **Branch:** `feature/subscriptions`.
- **Own:** subscription routes/service, date utility and numbering utility.
- **Do not edit:** Prisma schema, backend app registration, auth, invoices or frontend. Person 1 integrates your exported router and approved schema requests.
- **Share immediately:** router export, sample request/response and date/numbering helper signatures.

## Frozen contract

```text
Base /api; Bearer JWT
Money integer paise; dates YYYY-MM-DD
Success { data }; list { data, meta: { page, pageSize, total } }
Error { error: { code, message, fields? } }
```

Use existing compatible names. Person 1 supplies safe `actor`/`user` identity and role middleware; agree which request property is used.

## Must ship endpoints

| Endpoint | Behavior |
| --- | --- |
| GET /subscriptions | Admin/staff list; q, status, page, pageSize |
| POST /subscriptions | Create DRAFT and server-priced lines |
| GET /subscriptions/:id | Detail with plan, customer, readable product/variant labels and line snapshots |
| POST /subscriptions/:id/transition | Body `{ to }`; enforce strict state chain |
| GET /me/subscriptions | Customer-owned list only |
| GET /me/subscriptions/:id | Customer-owned detail only |

Return `nextInvoiceDate` so Person 4 can pass the intended billing period to Person 3. Never expose product cost prices in customer payloads.

```json
{
  "customerId": "<customer UUID>",
  "planId": "<plan UUID>",
  "startDate": "2026-10-31",
  "paymentTermDays": 14,
  "lines": [
    { "productId": "<UUID>", "variantId": "<UUID or null>", "quantity": 2, "taxId": "<UUID or null>" }
  ]
}
```

Use the current business date in the demo, not the sample date literally. Optional expiry may remain if already supported. Do not accept client unitPrice, amount or total.

## Mandatory business logic

```text
DRAFT → QUOTATION → CONFIRMED → ACTIVE → CLOSED
```

- **Create:** require existing customer, available plan, active products, variant belonging to product, valid tax and quantity at least plan minimum.
- **Snapshot:** `unitPrice = salesPrice + variant.extraPrice`; `amount = unitPrice × quantity`, with safe bounds.
- **Quotation:** require at least one line. Retain separate quotation validity logic if it exists.
- **Confirmation:** validate minimum quantities and any quotation expiry. Do not allow catalog changes to silently reprice confirmed lines.
- **Activation:** atomically change status and set nextInvoiceDate to startDate. Reject stale/illegal transitions with 409.
- **Closure:** ACTIVE → CLOSED clears nextInvoiceDate; leave outstanding invoices untouched.
- **Edits:** if existing draft edit is retained, block edits after DRAFT. Do not add a full editing system if it delays integration.
- **Concurrency:** conditional state update or row lock so requests cannot both act on stale state.
- **Ownership:** customer queries include JWT-derived customerId; another customer's record returns 404.

Correct the earlier guide's expiry instruction: template validity is quotation expiry, NOT subscription service expiry. If templates are deferred, no new expiry field is needed just for this demo.

## Date and numbering helpers

Share one helper with Person 3:

```typescript
nextPeriod(periodStart: Date, billingPeriod: string, anchor: Date): Date
number(tx: Prisma.TransactionClient, prefix: 'SUB' | 'INV'): Promise<string>
```

- DAILY/WEEKLY add calendar days; MONTHLY/YEARLY clamp safely.
- Preserve original anchor: Jan 31 → Feb 28/29 → Mar 31.
- Atomic counter increment and number creation belong in the caller's transaction.
- Export these functions early; do not block Person 3 while polishing the module.

## Defer unless already working

- Quotation template CRUD and template-copy UI.
- Pause/resume/renewal and proration; hide unsupported controls.
- Advanced expiration/auto-close orchestration and scheduled status sweeps.
- Discount attachment management.

If pause/resume already works, keep it but confirm its billing policy with Person 3. Never clear a pause and accidentally back-bill skipped time.

## Timeline from now

| Time | Deliverable |
| --- | --- |
| 0–10 min | Agree contracts and pricing with team; inspect foundations |
| 10–35 min | Export numbering/date helpers; subscription list/detail shapes |
| 35–70 min | Create DRAFT with validated snapshots; lifecycle transitions |
| 70–95 min | Customer-owned list/detail; test with Person 4 and billing owner |
| 95–145 min | Complete end-to-end flow and fix integration defects |
| 145–180 min | Freeze features; rehearse create → quote → confirm → activate |

## Acceptance

- DRAFT → ACTIVE jump returns 409.
- Quantity below minimum fails; Odoo delta is applied server-side.
- Confirmed line prices do not change when catalog prices change.
- Activation creates a due billing date.
- Customer cannot inspect another subscription.
- Person 3 generates an invoice from your ACTIVE record without manual DB edits.
