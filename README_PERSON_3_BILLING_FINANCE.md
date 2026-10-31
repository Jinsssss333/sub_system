# 🧑‍💻 Person 3 Guide: Billing & Financial Engine Owner

> **Domain:** Pricing Mathematics, Idempotent Invoice Generator, Concurrency/Row-Locking, Payments Reconciliation, Recurring Billing Scheduler, and SQL Aggregation Reports.  
> **Git Branch:** `feature/billing-engine`  
> **Source of Truth:** [`Brightloop Logic Architecture and Implementation Handoff.md`](./Brightloop%20Logic%20Architecture%20and%20Implementation%20Handoff.md)

---

## 📂 Files You Own & Touch
```
backend/src/
├── modules/
│   ├── invoices/           <-- Invoice actions, snapshots & details
│   ├── payments/           <-- Payment receipt recording & balance tracking
│   └── reports/            <-- Fast SQL aggregate metrics & overdue lists
├── jobs/
│   └── billing.job.ts      <-- Recurring billing engine & batch runner
└── utils/
    └── pricing.ts          <-- Pure pricing, discount allocation & tax math
```
> ⚠️ **No-Touch Rule:** Do not edit `modules/auth/` or `modules/subscriptions/`. Read subscription records via Prisma.

---

## 🎯 Core Features & Endpoints to Build

### 1. Pure Pricing Algorithm (`src/utils/pricing.ts`)
* All math is **integer paise** and **integer basis points** (never floats!).
* **Step-by-step logic:**
  1. `gross = quantity * unitPrice`
  2. Apply `PRODUCT` discounts to matching lines.
  3. Apply `SUBSCRIPTION` discounts across remaining subtotal, distributed proportionally with bounded remainder on the last line.
  4. Compute line tax on the discounted taxable amount: `roundHalfUp(taxableAmount * rateBps / 10000)`.
  5. `total = subtotal - discountTotal + taxTotal`.

### 2. Idempotent Invoice Generator (`src/modules/invoices/invoices.service.ts`)
* Function: `generateInvoice(subscriptionId: string)`
* **Must run in a single `prisma.$transaction`:**
  1. Lock subscription row using `FOR UPDATE`.
  2. Verify: `status == ACTIVE`, `pausedAt == null`, `nextInvoiceDate <= today`.
  3. Check unique constraint: look up invoice for `(subscriptionId, periodStart)`.
     - *If it already exists, return existing and advance cursor (idempotent no-op; never bill twice).*
  4. Lock discount rows in deterministic ID order (prevents concurrent deadlocks).
  5. Claim discount usage atomically (`timesUsed += 1`).
  6. Generate human number: `INV-000123` via `numbering.ts`.
  7. Insert `Invoice` and `InvoiceLine` snapshots.
  8. Advance subscription `nextInvoiceDate` by one period using `dates.addPeriod`.

### 3. Billing Engine & Scheduler (`src/jobs/billing.job.ts`)
* Core function: `runBilling(today = new Date())`
  - Find all `ACTIVE` subscriptions where `pausedAt is null` and `nextInvoiceDate <= today`.
  - Process each subscription in its own `try/catch` block (one failure never stops the batch).
  - Catch up missed periods (up to 12 cycles per run).
* Expose API endpoint: **`POST /api/admin/run-billing`** (Admin only, allows live demo trigger).
* Register recurring cron job via `node-cron` using `env.BILLING_CRON`.

### 4. Invoice Actions (`src/modules/invoices/`)
* **`GET /api/invoices`**: List invoices with filters (`status`, `customerId`, `dueDate`).
* **`POST /api/invoices/:id/confirm`**: Moves `status` from `DRAFT` to `CONFIRMED`.
* **`POST /api/invoices/:id/cancel`**: Allowed only if `amountPaid == 0`. Moves to `CANCELLED`.
* **`POST /api/invoices/:id/send`**: Dispatches invoice email to Mailpit (`localhost:1025`).

### 5. Payments & Reconciliation (`src/modules/payments/`)
* **`POST /api/invoices/:id/payments`**:
  - Run inside transaction with row lock on `Invoice`.
  - Verify invoice `status == CONFIRMED`.
  - Validate: `0 < amount <= (total - amountPaid)`.
  - Insert `Payment` record with method (`CASH`, `CARD`, `UPI`, `BANK_TRANSFER`, `CHEQUE`), date, and note.
  - Increment `amountPaid += amount`.
  - If `amountPaid == total`: automatically flip invoice status to **`PAID`**.

### 6. Fast Financial Aggregations (`src/modules/reports/`)
* Must use direct PostgreSQL aggregations (`count`, `sum`), never load rows into memory:
  - **Active Subscriptions:** `prisma.subscription.count({ where: { status: 'ACTIVE' } })`.
  - **Revenue Collected:** `prisma.payment.aggregate({ _sum: { amount: true } })`.
  - **Total Outstanding:** Sum of `total - amountPaid` for `CONFIRMED` invoices.
  - **Overdue Invoices:** `prisma.invoice.findMany({ where: { status: 'CONFIRMED', dueDate: { lt: today } } })`.
* Response SLA: Returns in **under 200ms** even with thousands of records.

---

## ⏱️ Hour-by-Hour 6-Hour Plan
* **Hour 1 (0:00 – 1:00):** Write and test pure math in `pricing.ts` (discount order of operations and half-up tax).
* **Hour 2 (1:00 – 2:00):** Build `generateInvoice()` transactional logic with row-locking and uniqueness checks.
* **Hour 3 (2:00 – 3:00):** Build the payment recording endpoint with balance verification and status flip to `PAID`.
* **Hour 4 (3:00 – 4:00):** Implement `runBilling()` job, `POST /admin/run-billing`, and the `/reports/summary` aggregate endpoint.
* **Hour 5 (4:00 – 4:45):** **MERGE POINT:** Open Pull Request from `feature/billing-engine` into `dev`.
* **Hour 6 (4:45 – 6:00):** Assist team with live demo: trigger billing run and demonstrate instant dashboard updates.

---

## 🔍 Edge Cases You Must Guard Against
1. **Double-Billing:** Running billing 5 times in a row must create **exactly 1 invoice** per period.
2. **Overpayment:** Submitting a payment of ₹10,000 for a ₹5,000 balance must return HTTP 400.
3. **Discount Race:** Two parallel subscriptions claiming a discount with `usageLimit = 1` must result in only 1 successful claim.
4. **Paid Immutability:** Attempting to cancel a paid invoice must be strictly blocked.

---

## 🎤 What You Explain to Hackathon Judges
> *"I built the financial core and recurring billing engine. We designed it for total financial integrity: all pricing is computed in integer paise, taxes are levied on net discounted revenue, and double-billing is mathematically prevented using compound database constraints and transactional row locks. Our finance dashboard calculates revenue and overdue receivables using direct SQL aggregations, delivering sub-second response times."*

