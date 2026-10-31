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
