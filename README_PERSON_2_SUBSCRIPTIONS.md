# 🧑‍💻 Person 2 Guide: Subscription Lifecycle Owner

> **Domain:** Quotation Templates, Subscriptions Creation, Lifecycle State Machine, Pause/Resume/Renew Policies, and Date Clamping Math.  
> **Git Branch:** `feature/subscriptions`  
> **Source of Truth:** [`Brightloop Logic Architecture and Implementation Handoff.md`](./Brightloop%20Logic%20Architecture%20and%20Implementation%20Handoff.md)

---

## 📂 Files You Own & Touch
```
backend/src/
├── modules/
│   ├── templates/          <-- Quotation template CRUD & line copy logic
│   └── subscriptions/      <-- Subscription lifecycle, state transitions & actions
└── utils/
    ├── dates.ts            <-- Period math & month-end anchor date clamping
    └── numbering.ts        <-- Sequential SUB-000123 generation
```
> ⚠️ **No-Touch Rule:** Do not edit `schema.prisma` directly (ask Person 1 if DB changes are needed). Do not touch `modules/auth/`, `modules/invoices/`, or `frontend/`.

---

## 🎯 Core Features & Endpoints to Build

### 1. Quotation Templates Module (`src/modules/templates/`)
* **`POST /api/templates`**:
  - Creates a reusable quote template with `name`, `planId`, `validityDays`, and `lines` (products, variants, quantities).
* **`GET /api/templates`**:
  - Lists available quotation templates for sales reps.

### 2. Subscriptions Management Module (`src/modules/subscriptions/`)
* **`POST /api/subscriptions`**:
  - Creates a new subscription either from scratch or from a `templateId`.
  - Generates atomic human number: `SUB-000123` via `numbering.ts`.
  - Sets `status = DRAFT`.
  - If built from a template: copies product lines and sets `expiryDate = today + validityDays`.
* **`GET /api/subscriptions`**:
  - Paginated list (`?page=1&pageSize=20&status=ACTIVE&customerId=...`).
* **`GET /api/subscriptions/:id`**:
  - Detailed view with lines, plan, customer, and attached discounts.
* **`PATCH /api/subscriptions/:id`**:
  - Edits permitted **only while status is DRAFT**. If status is not DRAFT, return HTTP 409 Conflict.

### 3. State Machine & Transitions (`POST /api/subscriptions/:id/transition`)
Enforce the strict allowed-transitions map:
$$\text{Draft} \longrightarrow \text{Quotation} \longrightarrow \text{Confirmed} \longrightarrow \text{Active} \longrightarrow \text{Closed}$$

```typescript
const allowedTransitions = {
  DRAFT: ['QUOTATION'],
  QUOTATION: ['CONFIRMED'],
  CONFIRMED: ['ACTIVE'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
};
```
* **Side Effects per Transition:**
  - `DRAFT` $\rightarrow$ `QUOTATION`: Requires at least one line item.
  - `QUOTATION` $\rightarrow$ `CONFIRMED`: Validate line quantities $\ge$ `plan.minQuantity`. Lock prices.
  - `CONFIRMED` $\rightarrow$ `ACTIVE`: Set `nextInvoiceDate = startDate`.
  - `ACTIVE` $\rightarrow$ `CLOSED`: Clear `nextInvoiceDate` (stops billing engine from picking it up).
  - *Any invalid transition must return HTTP 409 Conflict.*

### 4. Lifecycle Actions (Pause, Resume, Renew)
* **`POST /api/subscriptions/:id/pause`**:
  - Allowed only if `plan.pausable == true`.
  - Sets `pausedAt = today`. (Billing engine will automatically skip paused subscriptions).
* **`POST /api/subscriptions/:id/resume`**:
  - Allowed only if currently paused. Clears `pausedAt = null`.
* **`POST /api/subscriptions/:id/renew`**:
  - Allowed only if `plan.renewable == true`.
  - Clones the existing subscription into a fresh `DRAFT` linked via `renewedFromId`. Original remains untouched.

### 5. Date Clamping Utility (`src/utils/dates.ts`)
* Implement billing period addition with **calendar date clamping**:
  - E.g., Jan 31 + 1 month = Feb 28 (or 29 in leap year).
  - Retain the original anchor date so subsequent cycle reverts to March 31.

### 6. Customer Portal Scoping
* **`GET /api/me/subscriptions`**:
  - Scoped strictly to `where customerId = req.user.customerId`.

---

## ⏱️ Hour-by-Hour 6-Hour Plan
* **Hour 1 (0:00 – 1:00):** Implement date clamping functions in `dates.ts` and test end-of-month edge cases.
* **Hour 2 (1:00 – 2:00):** Build Quotation Templates CRUD and Template-to-Subscription line copy logic.
* **Hour 3 (2:00 – 3:00):** Build the Subscription State Machine and transition validator.
* **Hour 4 (3:00 – 4:00):** Build Pause, Resume, and Renew cloning endpoints. Add `/api/me/subscriptions`.
* **Hour 5 (4:00 – 4:45):** **MERGE POINT:** Open Pull Request from `feature/subscriptions` into `dev`.
* **Hour 6 (4:45 – 6:00):** Assist Person 3 (Billing) and Person 4 (Frontend) in testing the complete Quote-to-Active flow.

---

## 🔍 Edge Cases You Must Guard Against
1. **Illegal State Jump:** Attempting to jump from `DRAFT` directly to `ACTIVE` must fail with HTTP 409.
2. **Editing Post-Draft:** Attempting to edit line items on an `ACTIVE` subscription must be rejected.
3. **Minimum Quantity:** Ensure line quantity cannot be lower than the plan's `minQuantity`.
4. **Customer Isolation:** Customers querying another company's subscription ID must receive HTTP 404.

---

## 🎤 What You Explain to Hackathon Judges
> *"I built the Subscription Engine and State Machine. Our system enforces strict, deterministic transitions from Draft Quote to Active Service. I handled edge-case calendar date clamping so renewals never drift, and implemented plan policy flags so only eligible plans can be paused or renewed. When a subscription is renewed, we preserve full audit history by cloning into a new Draft linked via parent pointers."*

