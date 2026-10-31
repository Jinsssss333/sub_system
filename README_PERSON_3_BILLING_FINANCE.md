# Person 3: Invoice, payment and live metrics

Three-hour hackathon scope. Keep financial safeguards; reduce feature breadth. Integrate continuously, not at hour five. Preserve working existing billing code rather than rebuilding it.

## Ownership

- **Branch:** `feature/billing-engine`.
- **Own:** invoices, payments, basic reports and pure pricing.
- **Use:** Person 2's shared date/numbering helpers and Person 1's middleware.
- **Do not edit:** schema, auth, subscription module or frontend. Person 1 registers your route export.

## Frozen API contract

Base `/api`; Bearer JWT; integer paise and basis points; UTC date-only business dates.

```text
Success { data }
List { data, meta: { page, pageSize, total } }
Error { error: { code, message, fields? } }
```

| Endpoint | Minimum behavior |
| --- | --- |
| POST /subscriptions/:id/invoices | Body `{ periodStart: "YYYY-MM-DD" }`; generate/return that due period |
| GET /invoices | Admin/staff; q, status, page, pageSize |
| GET /invoices/:id | Safe detail, lines, customer and payments; own customer access only |
| POST /invoices/:id/confirm | DRAFT → CONFIRMED |
| POST /invoices/:id/payments | Atomic partial/full receipt |
| GET /me/invoices | Customer-owned paginated list |
| GET /reports/summary | Admin/staff current aggregates |
| GET /reports/overdue | Admin/staff confirmed overdue invoices |

If already implemented paths/payloads differ, freeze and communicate the existing contract at minute 10; do not leave frontend guessing.

## Minimum correct calculation

1. Use stored subscription line unit prices, not client prices or current catalog prices.
2. Gross line amount = quantity × stored unit price.
3. Add the approved recurring plan base fee visibly; agree semantics with all owners.
4. Apply existing tested discounts only. If no discount engine exists, store discount totals as zero and explicitly defer advanced discounts.
5. Tax each product line's discounted amount using its tax rate snapshot.
6. Sum integer line amounts, discounts and rounded line taxes.
7. Store invoice descriptions, quantities, prices, rates, taxes and totals as snapshots.

Use integer/BigInt intermediates. Half-up tax: `(amount × rateBps + 5000) / 10000` with integer division. Validate supported maximum amounts.

The plan fee is untaxed unless an explicit tax is configured. For this demo, avoid changing plan prices after activation unless a base-fee snapshot policy is already implemented.

Example with zero discounts:

```text
Product ₹1,000 + variant ₹560; quantity 2 = ₹3,120
Plan base fee ₹990
18% tax on product lines = ₹561.60
Invoice total = ₹4,671.60 = 467160 paise
```

## Invoice generation transaction

```text
BEGIN
  lock subscription FOR UPDATE
  verify staff/admin access and valid intended period
  if invoice(subscriptionId, requestedPeriodStart) exists: return it
  require ACTIVE, unpaused, and requestedPeriodStart = nextInvoiceDate ≤ today
  enforce existing service-expiry policy
  calculate snapshots
  increment INV counter
  insert invoice + lines
  advance nextInvoiceDate using original start-date anchor
COMMIT
```

- Database unique `(subscriptionId, periodStart)` remains mandatory.
- Check an existing requested-period invoice before rejecting a stale nextInvoiceDate: retrying a successful request should return the same invoice.
- Keep bounded retries for serialization/deadlock errors only.
- Do not accept a client-supplied total.
- If discount usage exists, its claim must be in this transaction. Do not introduce usage-limit complexity during the final integration window.

## Payment transaction

Body `{ method, amount, paidOn, note? }`; method is UPI, CARD, CASH, BANK_TRANSFER or CHEQUE. These are manual recording categories, not payment-gateway integrations.

```text
BEGIN
  lock invoice FOR UPDATE
  require CONFIRMED
  validate 0 < amount ≤ total − amountPaid
  reject future paidOn
  insert receipt; increment amountPaid
  set PAID exactly when balance reaches zero
COMMIT
```

Return 400 for overpayment. Never mark PAID after a partial receipt. Reject payments on DRAFT, CANCELLED and PAID invoices. A zero-total invoice can settle on confirmation without inserting a zero payment.

## Metrics

`GET /reports/summary` returns:

```json
{ "data": { "activeSubscriptions": 3, "revenueCollected": 100000,
  "outstanding": 50000, "overdueCount": 1 } }
```

- Active = current ACTIVE status count; label paused handling if implemented.
- Collected = payment sum, not invoice sum.
- Outstanding = confirmed totals minus paid amounts.
- Overdue = CONFIRMED and dueDate before today.
- Use DB aggregates; do not promise 200 ms or any SLA without measurement.

## Defer unless already working

- Automatic cron, batch catch-up, manual run-all billing endpoint.
- Discount-rule engine, usage-limit races and complex proportional allocations.
- SMTP delivery, elaborate print renderer, advanced reports/charts.
- Cancellation UI; if cancellation already exists, block it after any payment.

Single-subscription period-aware generation demonstrates recurring billing mechanics. Do not describe it as an automated scheduler.

## Timeline and acceptance

- **0–15 min:** freeze routes; request helpers; share invoice/payment payloads with Person 4.
- **15–60 min:** transactional generation and confirm; same-period retry creates one invoice.
- **60–95 min:** partial/full payments; reject overpayment; owned customer reads.
- **95–120 min:** summary/overdue; integrate and seed representative statuses with Person 1.
- **120–145 min:** real full-flow tests; concurrent same-period generation and combined-overpayment checks.
- **145–180 min:** freeze features and rehearse.

Do not claim production financial integrity based on a successful happy-path demo. State exactly which safeguards were tested.
