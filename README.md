# 🔄 Brightloop Subscription Management System

> **A unified, local-first platform running catalog, subscriptions, automated recurring billing, payments, and financial reporting.**  
> Built for the **Odoo Hackathon** as an enterprise-grade monorepo.

---

## 📑 Table of Contents
1. [Overview](#-overview)
2. [Tech Stack](#-tech-stack)
3. [Key Features](#-key-features)
4. [Monorepo Architecture](#-monorepo-architecture)
5. [Data Model & ER Diagram](#-data-model--er-diagram)
6. [Business Logic & Mathematical Invariants](#-business-logic--mathematical-invariants)
7. [API Specification & Endpoints](#-api-specification--endpoints)
8. [Quickstart & Local Setup](#-quickstart--local-setup)
9. [Demo Credentials & User Roles](#-demo-credentials--user-roles)
10. [Automated Testing & Performance Benchmarks](#-automated-testing--performance-benchmarks)
11. [Architecture & Accounting Decisions](#-architecture--accounting-decisions)

---

## 🌟 Overview

**Brightloop Subscription Management System** is a production-ready, local-first platform designed to run the entire lifecycle of a modern recurring subscription business. It manages everything from catalog configuration, quotation generation, and state-machine guarded subscriptions to automated cron billing, transactional payment processing, and executive KPI reporting.

Every component operates completely offline with zero reliance on cloud services or external CDNs.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Monorepo** | npm Workspaces (`@brightloop/shared`, `backend`, `frontend`) |
| **Runtime & Language** | Node.js 20+, TypeScript (ESM) |
| **Backend API** | Express.js, Zod, bcryptjs, jsonwebtoken |
| **ORM & Database** | Prisma ORM, PostgreSQL 16 (with native connection pooling and compound indexes) |
| **Scheduler** | node-cron (recurring billing worker) |
| **Frontend UI** | React 18, Vite, Tailwind CSS, TanStack Query, React Hook Form, Lucide Icons |
| **Testing** | Vitest, Supertest, standalone verification runners |

---

## 🚀 Key Features

### 1. Role-Based Access Control (RBAC) & Tenant Isolation
- **Three Core Roles:**
  - **Admin:** Full authority over catalog items, plans, tax rates, discount rules, staff onboarding, and manual billing runs.
  - **Staff:** Daily operational duties (customer accounts, quotation templates, subscription progression, invoice confirmation, payment recording).
  - **Customer:** Self-service portal scoped strictly to their own subscriptions, invoices, and printable payment receipts.
- **Strict Data Isolation (IDOR Protection):** Queries for customer resources enforce `where customerId = token.customerId`. Any attempt by a customer to query or manipulate another tenant's records immediately returns `404 Not Found` (never `403`, preventing ID enumeration).

### 2. Products & Variants Catalog
- Base products with sales price, cost price, and item categorization.
- **Odoo Edition Variant:** Fully supports product variants where selecting the **Odoo Edition variant adds exactly ₹560.00 (`56000` paise)** to the base sales price.
- Integer price enforcement: All catalog amounts are non-negative integers in paise.

### 3. Subscription Lifecycle State Machine
Subscriptions are governed by a strictly validated state machine:
$$\text{DRAFT} \longrightarrow \text{QUOTATION} \longrightarrow \text{CONFIRMED} \longrightarrow \text{ACTIVE} \longrightarrow \text{CLOSED}$$
- **Draft $\to$ Quotation:** Requires at least one valid product line.
- **Quotation $\to$ Confirmed:** Validates quantities against plan minimums; freezes unit pricing.
- **Confirmed $\to$ Active:** Sets `nextInvoiceDate = startDate`.
- **Active $\to$ Closed:** Clears `nextInvoiceDate`, cleanly halting automated billing runs.
- **Pause & Resume:** Pauses store `pausedAt` without mid-cycle proration; resumption recalculates next anchor cycle without double-billing or back-billing skipped intervals.
- **Renewals:** Cloning mechanism creates a new `DRAFT` linked via `renewedFromId`.

### 4. Idempotent Automated Billing Engine
- Background billing runner (`node-cron`) inspects `ACTIVE` subscriptions where `nextInvoiceDate <= today`.
- Enforces compound database unique constraint `@@unique([subscriptionId, periodStart])` on `Invoice`.
- **Zero Double-Billing Guarantee:** Running billing multiple times for the same date range produces zero duplicate invoices.

### 5. Financial Core, Taxes & Discounts
- **Integer Paise:** Floats are strictly prohibited in domain services and database tables to prevent IEEE-754 precision loss.
- **Basis Points:** Tax rates are stored in basis points ($1\% = 100\text{ bps}$, $18\%\text{ GST} = 1800\text{ bps}$).
- **Deterministic Discount Ordering:** Evaluates `PRODUCT` discounts first, then `SUBSCRIPTION` discounts. Allocates proportionally across lines with bounded remainder on the final line. Taxes are computed *after* discounts on net realized revenue.

### 6. Transactional Payments & Collections
- Overpayment prevention: Payment amounts must be $> 0$ and $\le (\text{invoice.total} - \text{invoice.amountPaid})$.
- Invoices automatically transition to `PAID` once cumulative payments match the invoice total.
- Cancellations are strictly blocked once any payment has been recorded (`amountPaid > 0`).

### 7. Executive Dashboard & Real-Time Reporting
- SQL aggregate endpoints (`/api/reports/summary`, `/api/reports/overdue`) compute:
  - Active subscription count
  - Settled revenue collected
  - Total outstanding receivables
  - Overdue invoice exposures (`dueDate < today` and status `CONFIRMED`)
- High-performance query design: Measured $p95 < 35\text{ms}$ over 20,000 invoices.

### 8. Polished Design System & Responsive UI
- **Refined Aesthetics:** Navy `#0f172a` sidebar, crisp Tailwind neutral slate surfaces, and royal blue `#2563eb` action accents.
- **Navigation:** Integrated breadcrumb trails, sticky action bars, and user avatar dropdown menu.
- **Responsive Widths:** Works smoothly across both desktop monitors and 375px mobile viewports.

---

## 🏛️ Monorepo Architecture

```
sub_system/
├── package.json              # Monorepo root scripts & workspace configuration
├── .gitignore                # Production git ignore configuration
├── docker-compose.yml        # Local PostgreSQL 16 & Mailpit container setup
│
├── shared/                   # @brightloop/shared
│   ├── src/
│   │   ├── types.ts          # Shared TypeScript interfaces & enums
│   │   ├── schemas.ts        # Zod request validation schemas
│   │   ├── formatters.ts     # Currency (INR) and date formatting helpers
│   │   └── index.ts          # Public workspace exports
│   └── package.json
│
├── backend/                  # Express REST API & Billing Engine
│   ├── prisma/
│   │   ├── schema.prisma     # Relational schema, indexes & constraints
│   │   └── seed.ts           # Demo seed + 5,000 subs / 20,000 invoices generator
│   ├── src/
│   │   ├── config/           # Environment, database client, mailer
│   │   ├── middleware/       # Auth JWT, RBAC guards, Zod validation, error handler
│   │   ├── modules/          # Auth, users, customers, products, plans, taxes,
│   │   │                     # discounts, templates, subscriptions, invoices, payments, reports
│   │   ├── jobs/             # Recurring billing engine (cron & manual runner)
│   │   ├── utils/            # Math pricing engine, date clamping & numbering
│   │   └── app.ts            # Route registration & server bootstrap
│   ├── test/                 # Vitest pricing & discount unit tests
│   ├── tests/                # Standalone end-to-end integration test runners
│   └── scripts/              # Performance benchmarking suite (scripts/benchmark.ts)
│
└── frontend/                 # React 18 + Vite Web Application
    ├── src/
    │   ├── api/              # Resilient client, JWT interceptor, API helpers
    │   ├── components/       # Status badges, StatCards, UI widgets
    │   ├── layouts/          # Responsive AppShell & PrintInvoiceModal
    │   ├── lib/              # Auth context & session storage
    │   └── pages/            # Role-based pages (Admin, Staff, Customer Portal, Finance)
    └── vite.config.ts        # Proxy to :4000 backend API
```

---

## 📊 Data Model & ER Diagram

```mermaid
erDiagram
  User ||--o| Customer : "has profile (role CUSTOMER)"
  User ||--o{ PasswordResetToken : "requests"
  Customer ||--o{ Subscription : "owns"
  Customer ||--o{ Invoice : "billed"
  Plan ||--o{ Subscription : "billing period + base fee"
  Product ||--o{ ProductVariant : "has"
  Product ||--o{ SubscriptionLine : "sold as"
  ProductVariant |o--o{ SubscriptionLine : "optional variant"
  Tax |o--o{ SubscriptionLine : "optional tax"
  Subscription ||--|{ SubscriptionLine : "contains"
  Subscription ||--o{ SubscriptionDiscount : "applies"
  Discount ||--o{ SubscriptionDiscount : "used by"
  Discount ||--o{ DiscountProduct : "PRODUCT scope"
  Product ||--o{ DiscountProduct : "targeted"
  QuotationTemplate ||--|{ QuotationTemplateLine : "contains"
  QuotationTemplate |o--o{ Subscription : "created from"
  Subscription ||--o{ Invoice : "one per period (unique subscriptionId, periodStart)"
  Invoice ||--|{ InvoiceLine : "snapshotted lines"
  Invoice ||--o{ Payment : "receives"
  User ||--o{ Payment : "recorded by"
```

---

## 🧮 Business Logic & Mathematical Invariants

All calculations follow pure deterministic mathematical rules:

```text
1. Product Line Gross:
     unitPrice = catalogSalesPrice + selectedVariantExtraPrice
     grossAmount = quantity × unitPrice

2. Product-Scoped Discounts:
     eligibleLines = lines matching discount products
     validate minPurchase / minQuantity
     allocatedDiscount = min(discountValue, remainingLineBalance)
     claim 1 usage atomically via conditional UPDATE

3. Subscription-Scoped Discounts:
     validate minPurchase / minQuantity on remaining subtotal
     allocatedDiscount = min(discountValue, remainingSubtotal)
     claim 1 usage atomically
     distribute proportionally across lines (remainder assigned to final line)

4. Tax Calculation:
     taxableAmount = grossAmount - allocatedDiscounts
     lineTax = roundHalfUp(taxableAmount × taxRateBps / 10000)

5. Totals:
     subtotal = sum(grossAmount) + planBaseFee
     discountTotal = sum(allocatedDiscounts)
     taxTotal = sum(lineTax)
     invoiceTotal = subtotal - discountTotal + taxTotal
```

---

## 🌐 API Specification & Endpoints

All endpoints are prefixed with `/api`. Requests use `Authorization: Bearer <JWT>`. Standard response envelope is `{ data: ... }` or `{ data: [...], meta: { page, pageSize, total } }`.

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | System and database reachability check |
| `POST` | `/auth/signup` | Public | Register new customer account |
| `POST` | `/auth/login` | Public | Authenticate user & issue JWT |
| `POST` | `/auth/forgot-password` | Public | Request single-use 30-min password reset link |
| `POST` | `/auth/reset-password` | Public | Set new password with reset token |
| `GET` | `/auth/me` | All Roles | Current authenticated user profile |
| `GET` | `/users` | Admin | List all registered accounts |
| `POST` | `/users/staff` | Admin | Onboard an internal staff member |
| `GET` | `/customers` | Admin, Staff | Paginated customer directory with text search |
| `POST` | `/customers` | Admin, Staff | Create customer & linked user (returns customer ID) |
| `GET` | `/customers/:id` | Admin, Staff, Customer | Customer details (scoped to own tenant) |
| `GET` | `/products` | Admin, Staff | Product catalog with nested variants |
| `POST` | `/products` | Admin | Create product with integer paise pricing |
| `POST` | `/products/:id/variants`| Admin | Create variant (supports +₹560 Odoo variant) |
| `GET` | `/plans` | Admin, Staff | Recurring plans catalog |
| `POST` | `/plans` | Admin | Create plan with policy flags and committing min quantity |
| `GET` | `/taxes` | Admin, Staff | Tax rules (basis points: 500, 1200, 1800) |
| `POST` | `/taxes` | Admin | Create tax rate |
| `GET` | `/discounts` | Admin, Staff | Discount rules |
| `POST` | `/discounts` | Admin | Create fixed or percentage discount |
| `GET` | `/templates` | Admin, Staff | Quotation templates |
| `POST` | `/templates` | Admin | Create quotation template with validity days |
| `GET` | `/subscriptions` | Admin, Staff | Filterable paginated subscriptions list |
| `POST` | `/subscriptions` | Admin, Staff | Create subscription from lines or template |
| `GET` | `/subscriptions/:id` | Admin, Staff, Customer | Subscription details (customer isolated) |
| `POST` | `/subscriptions/:id/transition` | Admin, Staff | State transition (`to: QUOTATION\|CONFIRMED\|ACTIVE\|CLOSED`) |
| `POST` | `/subscriptions/:id/pause` | Admin, Staff, Customer | Pause active subscription |
| `POST` | `/subscriptions/:id/resume` | Admin, Staff, Customer | Resume paused subscription |
| `POST` | `/subscriptions/:id/renew` | Admin, Staff, Customer | Clone subscription into a new Draft |
| `GET` | `/me/subscriptions` | Customer | Customer self-service subscription list |
| `GET` | `/invoices` | Admin, Staff | Invoices directory with status & date filters |
| `POST` | `/subscriptions/:id/invoices` | Admin, Staff | Generate invoice for next due period |
| `GET` | `/invoices/:id` | Admin, Staff, Customer | Invoice line items & balance breakdown |
| `POST` | `/invoices/:id/confirm` | Admin, Staff | Lock and confirm draft invoice |
| `POST` | `/invoices/:id/cancel` | Admin, Staff | Cancel unpaid invoice (`amountPaid == 0`) |
| `GET` | `/invoices/:id/print` | Admin, Staff, Customer | Printable server-rendered invoice HTML |
| `GET` | `/me/invoices` | Customer | Customer self-service invoices list |
| `POST` | `/invoices/:id/payments` | Admin, Staff | Record payment against confirmed invoice |
| `GET` | `/payments` | Admin, Staff | Transactional payments ledger |
| `GET` | `/reports/summary` | Admin, Staff | Financial totals (active count, revenue, outstanding, overdue) |
| `GET` | `/reports/overdue` | Admin, Staff | Overdue invoices list with days past due |
| `POST` | `/admin/run-billing` | Admin | Trigger background billing catch-up run |

---

## ⚡ Quickstart & Local Setup

### Prerequisites
* **Node.js** 20.x or higher
* **npm** 10.x or higher
* **PostgreSQL 16** (Native or Docker on port 5432)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Jinsssss333/sub_system.git
cd sub_system
npm install
```

### 2. Configure Environment Variables
Copy the example environment configurations:
```bash
cp backend/.env.example backend/.env
cp backend/.env.test.example backend/.env.test
```
*(Ensure `DATABASE_URL` matches your local PostgreSQL credentials, e.g. `postgresql://postgres:postgres@localhost:5432/billing`)*.

### 3. Initialize Database & Seed Dataset
```bash
# Push Prisma schema to PostgreSQL
npm run db:deploy

# Populate demo accounts, catalog, 5,000 subscriptions & 20,000 invoices
npm run db:seed
```
*(To seed only basic demo fixtures quickly, pass `SEED_SIZE=small npm run db:seed`)*.

### 4. Start Development Servers
Open two terminal windows from the repository root:

**Terminal 1 (Backend API on `:4000`):**
```bash
npm run dev:api
```

**Terminal 2 (Frontend Web App on `:5173`):**
```bash
npm run dev:web
```

Open your browser at **[http://localhost:5173](http://localhost:5173)**.

---

## 👤 Demo Credentials & User Roles

| Role | Email | Password | Access & Responsibilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@brightloop.test` | `Admin@1234` | Catalog, products, Odoo variants, plans, tax rates, users, manual billing runs |
| **Staff** | `staff@brightloop.test` | `Staff@1234` | Customers, quotes, subscriptions lifecycle, invoice confirmation, payments |
| **Customer** | `customer@brightloop.test` | `Customer@1234` | Customer portal for Acme Retail Pvt Ltd (view own subscriptions, print receipts) |

---

## 🧪 Automated Testing & Performance Benchmarks

### Running Test Suites
From the project root:
```bash
# Run all unit tests across workspaces (Vitest)
npm test

# Run Person 1 verification suite (Identity & Catalog)
npm run test:person1 -w backend

# Run Person 2 verification suite (Subscription state machine & date clamping)
npm run test:person2 -w backend

# Full TypeScript check across all packages
npm run typecheck

# Production build verification
npm run build
```

### Performance Benchmarks (20,000 Invoices)
Run the automated query latency benchmark:
```bash
npm run bench
```

**Verified Latency Results:**
| Endpoint | Samples | p50 | p95 | Budget |
| :--- | :---: | :---: | :---: | :---: |
| `/subscriptions?page=1&pageSize=20` | 50 | 20.7 ms | 25.7 ms | $< 2000\text{ ms}$ |
| `/invoices?page=1&pageSize=20` | 50 | 7.1 ms | 20.6 ms | $< 2000\text{ ms}$ |
| `/reports/summary` | 50 | 17.1 ms | 22.6 ms | $< 2000\text{ ms}$ |
| `/reports/overdue?page=1&pageSize=20` | 50 | 7.1 ms | 12.4 ms | $< 2000\text{ ms}$ |
| `/me/invoices?page=1&pageSize=20` | 50 | 6.9 ms | 10.6 ms | $< 2000\text{ ms}$ |

---

## 🏛️ Architecture & Accounting Decisions

| Decision Topic | Resolution | Engineering Rationale |
| :--- | :--- | :--- |
| **Monetary Precision** | Integer paise (INR). Division by 100 occurs only at presentation. | Eliminates floating-point rounding drifts across recurring cycles. |
| **Tax on Discounts** | Tax is calculated strictly *after* all discounts are applied. | Ensures tax is only assessed on net realized revenue. |
| **Pause Semantics** | Sets `pausedAt`; skips billing runs; no mid-cycle proration. | Preserves billing anchor date without complex retrospective billing. |
| **Zero-Total Invoices** | Automatically transition to `PAID` upon confirmation. | Prevents recording empty zero-value payment receipts. |
| **Invoice Cancellation** | Allowed only when `amountPaid == 0`. | Protects audited payment receipts; preserves billed-period record. |
| **Discount Concurrency** | Atomically claimed with conditional `UPDATE ... WHERE timesUsed < usageLimit`. | Guarantees parallel billing runs never exceed discount quotas. |
| **Customer IDOR Isolation** | Cross-tenant access attempts return `404 Not Found`. | Obscures resource existence and completely blocks ID enumeration. |

---

## 📄 License
This project was developed for the **Odoo Hackathon**. All rights reserved.
