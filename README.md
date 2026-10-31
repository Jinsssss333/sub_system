# 🔄 Brightloop Subscription Management System

> **One unified, local-first platform to run products, plans, quotations, subscriptions, recurring billing, payments, and financial reporting on one laptop.**  
> Built for the **Odoo Hackathon** by a 4-person engineering team.  
> Source of truth: [`Brightloop Logic Architecture and Implementation Handoff.md`](./Brightloop%20Logic%20Architecture%20and%20Implementation%20Handoff.md).

---

## 📑 Table of Contents
1. [The Challenge & Context](#1-the-challenge--context)
2. [A Month at Brightloop (7 Operational Scenes)](#2-a-month-at-brightloop-7-operational-scenes)
3. [System Architecture & Transaction Boundaries](#3-system-architecture--transaction-boundaries)
4. [Pricing Algorithm & Mathematical Invariants](#4-pricing-algorithm--mathematical-invariants)
5. [Business Decisions & Accounting Rules](#5-business-decisions--accounting-rules)
6. [Odoo Project Expectations & Guidelines](#6-odoo-project-expectations--guidelines)
7. [4-Person Domain Split & Git Workflow](#7-4-person-domain-split--git-workflow)
8. [Build Sequence & Quality Gates](#8-build-sequence--quality-gates)
9. [Local Quickstart & Setup Guide](#9-local-quickstart--setup-guide)
10. [Demo Credentials & 3-Minute Judging Script](#10-demo-credentials--3-minute-judging-script)

---

## 1. The Challenge & Context

### The Challenge
Your task is to build **one unified software platform** that runs the full life of a subscription business, from setting up products and plans to sending invoices, collecting payments, and reporting revenue. 

Think of it as the **digital backbone** of a company that earns its money every month, not just once. The system automates and streamlines everything that happens in an ordinary billing month.

### Meet Brightloop Software
**Brightloop Software** sells business software billed by the month or the year, add-ons customers switch on and off, and products with variants. Customers range from small shops on a monthly plan to large enterprises on annual contracts.

* **Admin:** Configures products, variants, plans, tax rules, and discounts; manages staff.
* **Internal Team (Staff):** Handles day-to-day operations, quotes, subscriptions, and payments.
* **Customers:** Self-service portal to view and manage their own subscriptions and invoices.

### How Things Run Today (The Pain Points)
* 📋 **Customer subscriptions:** Tracked in spreadsheets
* ⏰ **Renewals:** Remembered by whoever notices first
* ✍️ **Invoices:** Typed up by hand every month
* 🔍 **Payments:** Matched to invoices by scrolling through bank statements
* 📊 **Revenue reports:** Built manually at the end of each quarter

> **The Problem:** Renewals get missed, invoices go out wrong, and nobody can say how much recurring revenue the company actually has.

---

## 2. A Month at Brightloop (7 Operational Scenes)

---

### Scene 1: A New Customer Signs Up (Auth & RBAC)
* **Account Creation & Security:**
  * Customers sign up online with email and password.
  * **Email Uniqueness:** Stored lowercase, unique case-insensitively.
  * **Password Validation:** More than 8 characters (at least 9), one uppercase, one lowercase, and one special character (`^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$`).
  * **Password Recovery:** Returns HTTP 200 generic response. Generates single-use 32-byte token with 30-min expiry, dispatched locally via Mailpit (no cloud SMTP).
* **Role-Based Access Control (RBAC):**
  * **Admin:** Controls entire system; only Admin can create Staff accounts.
  * **Staff:** Day-to-day operations (Quotes, Subscriptions, Invoices, Payments, Reports).
  * **Customer:** Dedicated portal scoped strictly to their own records via `where customerId = token.customerId` (unauthorized access returns 404).

---

### Scene 2: Launching a New Plan (Catalog & Variants)
* **Product Catalog & Variants:**
  * Admin sets up products: Name, Type, Sales Price, Cost Price, Notes.
  * Variant support: Brand variant where choosing **Odoo Edition adds ₹560 / 56,000 paise** to the sales price.
  * Unit Price = Base Sales Price + Variant Extra Price.
* **Subscription Plan Configuration:**
  * Frequency: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`.
  * Minimum Quantity: Configurable threshold ($\ge 1$).
  * Availability Period: Start date and optional end date.
  * Plan Flags: `autoClose` (auto-terminates at plan/subscription expiry), `closable`, `pausable`, and `renewable`.

---

### Scene 3: Turning a Quote into a Subscription (Quotation Lifecycle)
* **Quotation Templates:**
  * Pre-configured templates holding plan, product lines, and `validityDays`.
  * Creating a subscription copies template lines and computes `quotationExpiryDate = today + validityDays`.
* **Subscription Fields:**
  * Tracks: Sequential number (`SUB-000123`), Customer, Plan, Start Date, Expiry Date, Payment Terms (days until due), and lines (Product, Variant, Quantity, Unit Price, Tax, Line Amount).
* **Subscription Lifecycle State Machine:**
  $$\text{Draft} \longrightarrow \text{Quotation} \longrightarrow \text{Confirmed} \longrightarrow \text{Active} \longrightarrow \text{Closed}$$
  * All transitions are guarded; illegal jumps return HTTP `409 Conflict`.
  * *Draft $\rightarrow$ Quotation:* Requires $\ge 1$ line.
  * *Quotation $\rightarrow$ Confirmed:* Quantities must meet plan minimum; prices frozen.
  * *Confirmed $\rightarrow$ Active:* Sets `nextInvoiceDate = startDate`.
  * *Active $\rightarrow$ Closed:* Clears `nextInvoiceDate`; disables further billing runs.

---

### Scene 4: Billing Day (Automated Invoicing & Taxes)
* **Automated Invoice Generation:**
  * Background billing engine scans `ACTIVE`, unpaused subscriptions where `nextInvoiceDate <= today`.
  * Invoices generated directly from active subscriptions with customer details, lines, taxes, and totals pre-filled.
  * **Idempotency & Integrity:** Enforces a compound unique database constraint on `(subscriptionId, periodStart)` to guarantee **no subscription is skipped or billed twice**.
* **Automated Taxes & Invoice Actions:**
  * Taxes calculated automatically from admin-configured rates (GST basis points: 500, 1200, 1800).
  * Staff can **confirm**, **cancel**, **send** (Mailpit), or **print** any invoice.
  * **Invoice Lifecycle State Machine:**
    $$\text{Draft} \longrightarrow \text{Confirmed} \longrightarrow \text{Paid}$$
    *(Cancellation allowed from Draft or Confirmed only when `amountPaid == 0`)*

---

### Scene 5: A Customer Asks for a Better Price (Discount Engine)
* **Discount Rules (Admin Managed):**
  * Type: `FIXED` (paise) or `PERCENT` (basis points, 0–10,000).
  * Conditions: Optional minimum purchase amount or minimum quantity.
  * Validity: Start date and end date.
  * Constraints: Global `usageLimit` (`timesUsed < usageLimit`).
  * Scope: `PRODUCT` (specific lines) or `SUBSCRIPTION` (attached to entire subscription subtotal).
* **Automated Discount Processing:**
  * Product-scoped discounts apply first, followed by subscription-scoped discounts apportioned proportionally across lines.
  * Discounts automatically stop applying once expired or usage limit is exhausted.

---

### Scene 6: The Money Comes In (Payment Reconciliation)
* **Payment Recording:**
  * Records offline payment against `CONFIRMED` invoices: Method (`CASH`, `CARD`, `UPI`, `BANK_TRANSFER`, `CHEQUE`), Amount, Date, and Note.
  * Validation: Positive integer, cannot exceed outstanding balance (`amount <= total - amountPaid`).
  * Automatic state change: When `amountPaid == total`, invoice flips automatically to `PAID`.
* **Receivables Tracking:**
  * Overdue is a derived label: `status == CONFIRMED && dueDate < today`.

---

### Scene 7: The Finance Lead, at the End of the Month (Analytics & SLA)
* **Centralized Financial Analytics:**
  * 4 core operational metrics computed via direct SQL aggregations:
    1. **Active subscriptions:** Count of `status == ACTIVE`.
    2. **Revenue collected:** Sum of `Payment.amount` within the date range.
    3. **Outstanding amount:** Sum of `total - amountPaid` for `CONFIRMED` invoices.
    4. **Overdue invoices:** List of confirmed invoices past due date.
* **Performance SLA:**
  * Indexed queries on `[status, nextInvoiceDate]`, `[status, dueDate]`, `[customerId]`, and `[paidOn]`.
  * Page response time strictly **under 2 seconds** with 5,000+ subscriptions.

---

## 3. System Architecture & Transaction Boundaries

### Architectural Flow

```text
React Pages (Tailwind UI + Lucide)
    ↓ validated with shared Zod schemas
API Client + TanStack Query
    ↓ Bearer JWT; URL query-backed search, filters & pagination
Express Routes & Middleware
    ↓ authenticate (JWT) → authorize (Role) → validate (Zod) → controller
Domain Services (*.service.ts)
    ↓ enforce ownership, state-machine transitions & pricing invariants
Prisma ORM / PostgreSQL 16 (Docker)
    ↓ constraints, row locks, atomic sequence counters, indexes

node-cron + manual POST /admin/run-billing trigger
    → same billing orchestration service
    → same transactional invoice generation function

Mail Service  → local Mailpit (ports 1025 / 8025)
Print Engine  → server/browser rendered HTML with print CSS
```

### Transaction Boundaries & Concurrency Safety

#### 1. Invoice Generation Transaction
```text
BEGIN (prisma.$transaction)
    1. Lock subscription row
    2. Verify status == ACTIVE, pausedAt is null, nextInvoiceDate <= today
    3. Check if invoice exists for (subscriptionId, periodStart):
       - If exists: reconcile cursor and return existing (idempotent no-op)
    4. Load price/tax snapshots and eligible discount rules
    5. Lock discount rows in deterministic ID order (prevents deadlocks)
    6. Re-check usage limits and claim eligible usages atomically (timesUsed += 1)
    7. Calculate exact line gross, discounts, line tax, and totals
    8. Increment human invoice sequence counter (INV-000123)
    9. Insert invoice and line snapshots
   10. Advance nextInvoiceDate by one period (using anchor date clamping)
COMMIT
```

#### 2. Payment Transaction
```text
BEGIN (prisma.$transaction)
    1. Lock invoice row
    2. Verify status == CONFIRMED
    3. Require: 0 < paymentAmount <= (invoice.total - invoice.amountPaid)
    4. Validate paidOn <= today
    5. Insert payment record
    6. Increment invoice.amountPaid += paymentAmount
    7. If amountPaid == total: update invoice.status = PAID
COMMIT
```

---

## 4. Pricing Algorithm & Mathematical Invariants

All money values are **integer paise** (1 INR = 100 paise). All rates are **integer basis points** (1% = 100 bps, 18% = 1800 bps). Never floats.

```text
1. For each product line:
     unitPrice = catalogSalesPrice + selectedVariantExtraPrice
     gross = quantity × unitPrice

2. For each eligible PRODUCT discount (in deterministic order):
     eligibleLines = lines matching discount products
     validate minPurchase / minQuantity on eligible base
     allocatedDiscount = min(discountValue, remainingLineBalance)
     claim 1 usage atomically

3. For each attached eligible SUBSCRIPTION discount (in deterministic order):
     validate minPurchase / minQuantity on remaining subtotal
     allocatedDiscount = min(discountValue, remainingSubtotal)
     claim 1 usage atomically
     distribute proportionally across remaining line balances (bounded remainder on last line)

4. For each line:
     taxableAmount = gross − totalAllocatedDiscounts
     lineTax = roundHalfUp(taxableAmount × taxRateBps / 10000)

5. Totals:
     subtotal = sum(gross)
     discountTotal = sum(totalAllocatedDiscounts)
     taxTotal = sum(lineTax)
     total = subtotal − discountTotal + taxTotal
```

---

## 5. Business Decisions & Accounting Rules

From Section 4 of the Handoff Specification:

| Topic | Approved Decision | Rationale |
| :--- | :--- | :--- |
| **Currency** | Integer paise (INR). Display `/ 100`. | Eliminates floating-point rounding errors in recurring billing. |
| **Tax on Discounts** | Tax calculated *after* discounts. | Tax is assessed only on net realized revenue. |
| **Pause / Resume** | Sets `pausedAt`; skips billing runs; no proration. | Retains billing anchor date without complex mid-month proration. |
| **Quotation Expiry** | Explicit `validityDays` on quotation templates. | Clear separation between quote expiration and subscription service expiry. |
| **Zero-Total Invoice** | Flips directly to `PAID` upon confirmation. | Prevents recording invalid zero-value receipts. |
| **Cancellation** | Permitted only when `amountPaid == 0`. | Protects paid receipts; historical billing period uniqueness preserved. |
| **Reset Links** | Local Mailpit inspection; no token logging. | Avoids credential exposure while keeping development 100% offline. |

---

## 6. Odoo Project Expectations & Guidelines

> *"At Odoo, we value your skills, more than your resume. Here's what we expect from you:"*

![Odoo Project Expectations](./assets/odoo_expectations.jpg)

### 🔧 Must Have Checklist
- [x] **Dynamic Data Sources:** Real PostgreSQL database with Prisma ORM (zero mock JSON files in production).
- [x] **Responsive & Clean UI:** Consistent Indigo/Slate design system, mobile drawer navigation, responsive data cards.
- [x] **Robust Input Validation:** Strict Zod schemas validating on both client and server before DB writes.
- [x] **Intuitive Navigation:** Dedicated sidebars for Admin, Staff, and Customer with contextual action buttons.
- [x] **Proper Version Control (Git):** Distributed team commits and Pull Requests across all 4 teammates.

### 📌 Nice to Have Checklist
- [x] **Backend APIs & Data Modeling:** Relational schema with foreign keys, compound unique constraints, and indexes.
- [x] **Code Comprehension:** Clean service pattern (`*.service.ts`) without unexplainable external black boxes.
- [x] **Offline / Local Solutions:** Complete stack runs offline via Docker (Postgres + Mailpit) — zero cloud reliance.
- [x] **Purposeful Tech Stack:** Standard Express + React + Tailwind stack selected for speed and zero bloat.

---

## 7. 4-Person Domain Split & Git Workflow

Adopted directly from the **Handoff Specification (Section 13)**:

```
                         ┌────────────────────────────────────┐
                         │       GitHub Repository (dev)      │
                         └────┬──────────┬──────────┬─────────┘
                              │          │          │         │
                        ┌─────▼────┐┌────▼─────┐┌───▼────┐┌───▼────┐
                        │ Person 1 ││ Person 2 ││Person 3││Person 4│
                        └──────────┘└──────────┘└────────┘└────────┘
```

| Member | Domain Ownership | Branch Name | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Person 1** | **Identity & Catalog Owner** | `feature/identity-catalog` | Auth, JWT, RBAC, Users, Customers, Products, Variants (+₹560 Odoo variant), Plans, Taxes, Discounts, and shared Zod request validation schemas. |
| **Person 2** | **Subscription Lifecycle Owner** | `feature/subscriptions` | Quotation templates, subscription creation, lifecycle state machine (`Draft` $\rightarrow$ `Quotation` $\rightarrow$ `Confirmed` $\rightarrow$ `Active` $\rightarrow$ `Closed`), pause/resume/renew, and date clamping (`dates.ts`). |
| **Person 3** | **Billing & Financial Engine Owner** | `feature/billing-engine` | Pure pricing logic (`pricing.ts`), transactional `generateInvoice()`, discount allocation, payment recording, scheduler, and SQL financial aggregates (`/reports/summary`). |
| **Person 4** | **Frontend & Integration Owner** | `feature/frontend-integration` | Shared design system, App shell, role-based views (Admin, Staff, Customer Portal), TanStack Query hooks, print view, and browser acceptance testing. |

### Collaboration Rules:
1. **Schema Integrity:** Person 1 owns `schema.prisma` and migrations. No teammate independently edits the database schema.
2. **Branching:** Always branch off `dev`.
3. **Commits:** Semantic commit messages (`feat(billing): implement idempotent invoice generator`).
4. **Merge Checkpoints:** Pull Requests are peer-reviewed before merging into `dev`.

---

## 8. Build Sequence & Quality Gates

| Gate | Focus | Acceptance Check |
| :--- | :--- | :--- |
| **1. Foundation** | Docker, Prisma schema, migration, error envelope, health check | Fresh setup starts cleanly on Docker Postgres 16; `/api/health` returns 200. |
| **2. Identity** | Signup, login, password reset, RBAC middleware | Weak password rejected (400); duplicate email returns 409; customer role gets 403 on admin routes. |
| **3. Catalog** | Products, variants, plans, taxes, discounts, templates | Odoo variant adds ₹560 (56,000 paise); server enforces min quantities and price integrity. |
| **4. Subscriptions** | Template copy, state transitions, portal isolation | Full legal chain walks; illegal jump returns 409; customer cannot read another customer's subscription. |
| **5. Financial Core** | Pricing math, invoice generation, discount ordering, locking | Month-end dates clamped; parallel billing runs generate exactly 1 invoice; tax computed after discount. |
| **6. Collections** | Invoice actions (confirm, cancel, send, print), payments | Overpayment rejected; full payment flips invoice to `PAID`; cancellation blocked after payment. |
| **7. Operations** | Scheduler, aggregate queries, benchmark | Background billing runs safely; `/reports/summary` matches SQL totals; response times $<2\text{s}$. |
| **8. UI Integration** | Three role experiences, responsive layout | Admin, Staff, and Customer flows pass on desktop and 375px mobile width. |

---

## 9. Local Quickstart & Setup Guide

### Prerequisites
* **Node.js** 20+
* **Docker Desktop**
* **Git**

### 1. Clone & Start Local Services (PostgreSQL 16 & Mailpit)
```bash
git clone https://github.com/Jinsssss333/sub_system.git
cd sub_system
git checkout dev

# Start PostgreSQL (5432) and Mailpit (1025 SMTP, 8025 Web)
docker compose up -d
```

### 2. Backend Setup
```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
# Backend API runs on: http://localhost:4000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
# Frontend application runs on: http://localhost:5173
```

### 4. Local Mailbox
Open **`http://localhost:8025`** in your browser to view all intercepted password reset and notification emails in real time without internet connectivity.

---

## 10. Demo Credentials & 3-Minute Judging Script

### Pre-Seeded Accounts

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@brightloop.test` | `Admin@1234` | Full system access (Catalog, Staff creation, Billing job, Discounts, Finance) |
| **Staff** | `staff@brightloop.test` | `Staff@1234` | Operations (Quotes, Subscriptions, Invoices, Payments) |
| **Customer** | `customer@brightloop.test` | `Customer@1234` | Self-Service Portal (Own subscriptions and invoices only) |

---

### The 3-Minute Live Demo Script for Judges

* **Minute 1: The Problem & Architecture (Person 4 / Pitch Lead)**
  * *"Judges, Brightloop Software was losing revenue due to missed renewals and manual invoicing. We built a 100% offline, local-first subscription engine running PostgreSQL and local SMTP via Docker."*
  * Show `docker-compose.yml` and highlight that no cloud service or external API is required.
* **Minute 2: The Core Operational Flow (Person 1 & Person 2)**
  * Log in as **Admin**: Show the product catalog with the **Odoo variant (+₹560)** and a monthly recurring plan.
  * Switch to **Staff**: Create a subscription from a quote template $\rightarrow$ walk status from `Draft` $\rightarrow$ `Quotation` $\rightarrow$ `Confirmed` $\rightarrow$ `Active`.
  * Trigger the billing engine $\rightarrow$ show the invoice generated with automated tax and discount math.
  * Record a payment $\rightarrow$ watch status flip to `PAID`.
* **Minute 3: Customer Isolation & Finance Analytics (Person 3 & Person 4)**
  * Switch to **Customer**: Show that the customer sees *only* their own subscription and invoice, proving customer data isolation.
  * Switch back to **Admin / Finance Lead**: Open the Finance Dashboard to show real-time active subscriptions, revenue collected, and overdue invoices calculated instantly via database aggregations in under 2 seconds.
