# 🏛️ Architecture & Business Decisions (DECISIONS.md)

This document records all approved business rule resolutions, architectural invariants, and accounting logic for the **Brightloop Subscription System**, as established in `Brightloop Logic Architecture and Implementation Handoff.md`.

---

## 1. Resolved Business & Accounting Decisions

| Ambiguity | Approved Decision | Rationale |
| :--- | :--- | :--- |
| **Plan Base Price vs Product Prices** | Plan price is treated as a recurring base fee line item on the invoice. | Clarifies distinction between plan membership fees and seat/product line add-ons. |
| **Tax on Plan Base Fee** | Untaxed unless explicitly associated with a tax rate. | Product tax rules do not silently imply base-fee taxation. |
| **Quotation Validity vs Subscription Expiry** | Distinct fields: `quotationExpiryDate` for offer acceptance; `expiryDate` for service termination. | Separates sales quote validity from service lifespan. |
| **Pause / Resume Semantics** | Retains original billing anchor; skips billing instants during pause; **no proration**. | Prevents complex back-billing on resume and keeps billing intervals clean. |
| **Auto-Close & Unbilled Periods** | Expired subscriptions are closed before generating new invoices. | Prevents generating invoices for expired service contracts. |
| **Zero-Total Invoices** | Upon confirmation, marked as `PAID` atomically without recording a zero-value receipt. | Ensures receipts reflect actual positive money transfers. |
| **Multiple Discount Order** | `PRODUCT` scope evaluated first, then `SUBSCRIPTION` scope. Proportional allocation with bounded remainder on last line. | Standard commercial accounting; prevents negative line amounts. |
| **Invoice Cancellation** | Permitted only when `amountPaid == 0`. Billed-period record is retained. | Protects financial history; prevents double-billing for the same cycle. |
| **Password Reset Delivery** | Dispatched to local Mailpit (`:8025`); no raw reset tokens logged to console. | Maintains security hygiene while operating 100% offline. |
| **Resume after pause** | Billing restarts at the next billing anchor on or after the resume date. Periods skipped while paused are never back-billed. | Matches "pausing skips billing"; the anchor keeps invoice dates predictable. |
| **Customer default password** | Staff-created customers get no usable password and must set one through the Mailpit reset link. | The team's code used a shared default (`Customer@1234`), which anyone could guess. |
| **Money limits (Int, no BigInt)** | Unit price, plan price and fixed discount are capped at ₹10,00,000.00 each; quantity at 10,000; line amount (qty × price) at ₹10,00,000.00; at most 10 lines. Invoice totals therefore stay far below the 32-bit Int limit (₹2.1 crore). | Lets the schema keep `Int` paise safely. The limits are enforced by the shared Zod schemas on the backend (and mirrored in the forms); DB CHECK constraints add non-negative amounts, positive payments, tax ≤ 100% and `amountPaid ≤ total`. |
| **Snapshots** | Invoice lines snapshot description, quantity, unit price, discount and tax. There is no customer snapshot; `Invoice.customerName` is kept only so search does not need a join. | Matches the agreed scope cut. |
| **Discount usage limits** | Usage is claimed with a single conditional `UPDATE ... WHERE "timesUsed" < "usageLimit"` inside the invoice transaction. | Two invoices cannot over-claim the last use. |
| **Pagination** | Every list uses offset pagination (`page`, `pageSize` ≤ 100) with a total count. | Measured p95 stays below 35 ms on the 20,000-invoice seed, so keyset pagination was not needed. |
| **Local SMTP host** | `SMTP_HOST` defaults to `127.0.0.1`, not `localhost`. | nodemailer resolves hostnames itself and failed on `localhost` in testing, which silently dropped mail. |

---

## 2. Core Technical Invariants

### 1. Currency & Money Math
* **Paise (INR):** All monetary values are strictly stored as integer **paise** ($1\text{ INR} = 100\text{ paise}$).
* **Basis Points:** Tax rates are stored as integer **basis points** ($1\% = 100\text{ bps}$, $18\% = 1800\text{ bps}$).
* **Float Prohibition:** Floating-point numbers (`float`, `double`) are banned in domain services, database tables, and API contracts.

### 2. Concurrency & Idempotency
* **Database Unique Constraint:** `(subscriptionId, periodStart)` on `Invoice` ensures no subscription is billed twice for the same period.
* **Row-Level Locking:** Subscription rows are locked during billing runs; discount rows are locked in deterministic ID order to prevent deadlocks.
* **Payment Balancing:** Payments are validated inside a transaction against `total - amountPaid` with row locks to prevent race conditions.

### 3. Customer Data Isolation
* Customer portal queries strictly enforce `where customerId = token.customerId` on the database level.
* Requests attempting to query or modify another customer's record return `HTTP 404 Not Found` (never 403, to avoid confirming the record's existence).
