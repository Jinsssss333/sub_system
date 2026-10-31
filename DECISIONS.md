# 🏛️ Architecture & Design Decisions (DECISIONS.md)

This document tracks all key technical choices, business rule interpretations, and departures from specifications.

---

## 1. Currency & Financial Representation
* **Decision:** All monetary values are strictly stored as integer **paise** (1 INR = 100 paise).
* **Reason:** Floating-point representations (`float` / `double`) introduce catastrophic precision errors in recurring compounding, tax splits, and multi-line invoice aggregations.
* **UI Handling:** Values are divided by 100 only at the UI presentation boundary (`Intl.NumberFormat('en-IN')`).

## 2. Tax Rates
* **Decision:** Tax rates are stored as integer **basis points** ($1\% = 100\text{ bps}$, $18\% = 1800\text{ bps}$).
* **Reason:** Supports sub-percentage calculations (e.g., 0.25%, 5.5%) without floating-point inaccuracies.

## 3. Invoice Generation & Idempotency
* **Decision:** Invoices enforce a compound database unique constraint on `(subscriptionId, periodStart)`.
* **Reason:** Guarantees that even under concurrent scheduler triggers or manual clicks, no subscription can ever be billed twice for the same billing cycle.

## 4. Discount Order of Operations
* **Decision:**
  1. Calculate base line amount (`quantity * unitPrice`).
  2. Apply `PRODUCT`-scoped discounts to matching lines.
  3. Apply `SUBSCRIPTION`-scoped discounts across total subtotal, apportioned proportionally.
  4. Total discount is capped at subtotal (cannot be negative).
  5. Apply taxes to the discounted net amount.
* **Reason:** Follows standard commercial accounting principles where tax is levied only on realized revenue.

## 5. Offline & Local-First Philosophy
* **Decision:** Zero external cloud dependencies.
  - PostgreSQL 16 runs locally via Docker.
  - Mailpit captures all transactional emails on port 1025 with web viewing on port 8025.
  - Fonts and icons are self-hosted/bundled via `lucide-react` and system fonts.
* **Reason:** Total resilience against unreliable hackathon venue Wi-Fi during live judging.

## 6. Subscription & Invoice Immutability
* **Decision:**
  - Active subscriptions can be paused (sets `pausedAt`) or closed early.
  - Renewing clones the subscription into a new `DRAFT` linked via `renewedFromId`.
  - Paid invoices cannot be cancelled or modified. Invoices can only be cancelled if `amountPaid == 0`.
