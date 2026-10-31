# Brightloop Subscription System: Agent Build Brief

Local-first build brief for AI coding agents. Read all of it before writing any code.

## 1. How to use this document

- This is the single source of truth. If code and this doc disagree, stop and record it in `DECISIONS.md` instead of guessing.
- Work on one module per task. Finish it (code, validation, tests, seed data) before starting the next.
- Do not invent endpoints, tables or states that are not listed here. If something is missing, write your assumption in `DECISIONS.md` and continue.
- Keep code small and readable. A human teammate must be able to explain every file to judges, so no large pasted blocks you cannot justify.
- Business logic lives in `*.service.ts` files only. Controllers parse the request and send the response, nothing else.

## 2. Goal

Build one platform that runs a subscription business (Brightloop Software): products, variants, plans, quotation templates, subscriptions, automatic recurring invoices, taxes, discounts, payments and revenue reporting. Three roles: Admin, Staff, Customer.

Success means this flow works on one laptop with no internet:

sign up, admin builds catalog and plan, staff creates and activates a subscription, billing job generates the invoice, staff records a payment, finance dashboard shows revenue and overdue invoices. Every page responds in under 2 seconds with 5,000+ subscriptions in the database.

## 3. Stack (fixed, do not swap)

| Layer | Choice |
| --- | --- |
| Runtime | Node 20+, TypeScript, Express |
| ORM and DB | Prisma, PostgreSQL 16 (Docker) |
| Validation | Zod (backend and frontend) |
| Auth | JWT (Bearer header), bcrypt |
| Scheduler | node-cron |
| Email | nodemailer to Mailpit (local SMTP, no cloud) |
| Tests | Vitest, Supertest |
| Frontend | React, Vite, TypeScript, Tailwind, React Router, TanStack Query, react-hook-form, lucide-react |
| Printing | Server-rendered HTML print page with print CSS |

No cloud services, no CDN fonts, no external APIs. Everything must run offline after `npm install`.

## 4. Local setup

Prerequisites: Node 20+, Docker Desktop, Git.

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: billing
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
  mailpit:
    image: axllent/mailpit
    ports: ['1025:1025', '8025:8025']
volumes:
  pgdata:
```

```
# backend/.env.example
DATABASE_URL=postgresql://app:app@localhost:5432/billing
JWT_SECRET=change-me-long-random-string
JWT_EXPIRES_IN=1h
SMTP_HOST=localhost
SMTP_PORT=1025
APP_URL=http://localhost:5173
PORT=4000
BILLING_CRON=0 1 * * *
```

```
docker compose up -d
cd backend && npm install
npx prisma migrate dev
npm run db:seed
npm run dev                          # API on :4000
cd ../frontend && npm install && npm run dev   # UI on :5173
```

Mail inbox for reset links: http://localhost:8025. Required npm scripts in `backend`: `dev`, `build`, `test`, `db:migrate`, `db:seed`, `billing:run` (runs the billing job once, for demos).

Demo accounts created by the seed: `admin@brightloop.test` / `Admin@1234`, `staff@brightloop.test` / `Staff@1234`, `customer@brightloop.test` / `Customer@1234`.

## 5. Repo layout

```
brightloop/
  docker-compose.yml
  DECISIONS.md
  README.md
  backend/
    prisma/ schema.prisma, migrations/, seed.ts
    src/
      config/ env.ts, db.ts, mailer.ts
      middleware/ auth.ts, requireRole.ts, validate.ts, errorHandler.ts
      modules/ auth, users, customers, products, plans, taxes, discounts,
               templates, subscriptions, invoices, payments, reports
        each module: *.routes.ts, *.controller.ts, *.service.ts, *.schema.ts
      jobs/ billing.job.ts
      utils/ numbering.ts, dates.ts, money.ts, pricing.ts
      app.ts, server.ts
    tests/
  frontend/
    src/ api/, components/, features/, layouts/, pages/, routes/, lib/
```

## 6. Conventions (apply everywhere)

- Money: integers in paise (INR). Never floats. Format only in the UI by dividing by 100.
- Tax rates: stored as basis points (18% = 1800).
- Dates: date-only values in UTC for billing logic.
- IDs: UUID strings. Numbers shown to humans: `SUB-000123`, `INV-000123`, generated from a `Counter` table inside the same transaction as the insert.
- Success response: `{ data, meta? }`. Error response: `{ error: { code, message, fields? } }` where `fields` maps field name to message so forms can show inline errors.
- Lists: `?page=1&pageSize=20` (max 100), sortable, filterable, always paginated, always return `meta: { page, pageSize, total }`.
- HTTP: 400 validation, 401 not logged in, 403 wrong role, 404 not found (also for other customers' records), 409 conflict (duplicate email, illegal state change).
- Never log passwords, tokens or hashes.

## 7. Business rules

**Accounts**

- Email is unique per account (case-insensitive, store lowercase).
- Password: more than 8 characters (so at least 9), one uppercase, one lowercase, one special character. Regex: `^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$`.
- Public signup always creates a CUSTOMER. Only an Admin can create STAFF.
- Forgot password: always answer 200 (do not reveal whether the email exists). Create a random 32-byte token, store only its SHA-256 hash, expiry 30 minutes, single use. Send the link to Mailpit and also print it to the server console.

**Catalog**

- Product: name, type, sales price, cost price, notes. Variants add an extra price (Odoo brand adds 560 rupees = 56000 paise). Final unit price = product sales price + variant extra price.
- Plan: name, price, billing period (DAILY, WEEKLY, MONTHLY, YEARLY), minimum quantity, start date, optional end date, and four admin flags: autoClose, closable, pausable, renewable.

**Quotation templates**

- A template holds a plan, product lines and `validityDays`. Creating a subscription from a template copies its lines and sets the quotation expiry to today plus `validityDays`.

**Subscriptions**

- Fields: number, customer, plan, start date, expiry date, payment terms (days until due), lines (product, variant, quantity, unit price, tax, amount).
- Quantity on each line must be at least the plan minimum quantity.
- Pause (only if plan is pausable) sets `pausedAt`; billing skips paused subscriptions. Resume clears it.
- Close early only if plan is closable (Admin and Staff may override). Renew (only if plan is renewable) clones the subscription into a new DRAFT linked by `renewedFromId`.
- Auto-close: if the plan has `autoClose` and the plan end date or the subscription expiry date has passed, the billing job moves it to CLOSED.

**Taxes and discounts**

- Only the Admin creates taxes and discount rules.
- Discount: FIXED (paise) or PERCENT (basis points, 0 to 10000), optional minimum purchase and minimum quantity, start and end date, usage limit, scope PRODUCT (listed products) or SUBSCRIPTION (subscriptions it is attached to).
- Order of calculation: line amount, then discounts, then tax on the discounted amount, then totals. Document this in the invoice print page.
- Discounts apply automatically on the next invoice and stop when expired or when `timesUsed` reaches `usageLimit`.

**Invoices and payments**

- Invoices are created only from a subscription, never typed by hand. Nothing is billed twice or skipped.
- A payment needs method, amount, date, note, and a CONFIRMED invoice. Amount must be positive and not above the remaining balance.
- Invoice becomes PAID when payments cover the total.
- Overdue is derived, never stored: status CONFIRMED and `dueDate < today`.

## 8. Data model (Prisma draft)

Run `npx prisma format` and `npx prisma validate` and fix any missing back-relations. This is the contract for table and field names.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role { ADMIN STAFF CUSTOMER }
enum BillingPeriod { DAILY WEEKLY MONTHLY YEARLY }
enum SubscriptionStatus { DRAFT QUOTATION CONFIRMED ACTIVE CLOSED }
enum InvoiceStatus { DRAFT CONFIRMED PAID CANCELLED }
enum DiscountType { FIXED PERCENT }
enum DiscountScope { PRODUCT SUBSCRIPTION }
enum PaymentMethod { CASH CARD UPI BANK_TRANSFER CHEQUE }

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(CUSTOMER)
  createdAt    DateTime @default(now())
  customer     Customer?
  resetTokens  PasswordResetToken[]
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  user      User      @relation(fields: [userId], references: [id])
}

model Customer {
  id            String @id @default(uuid())
  userId        String @unique
  companyName   String?
  phone         String?
  address       String?
  user          User   @relation(fields: [userId], references: [id])
  subscriptions Subscription[]
  invoices      Invoice[]
}

model Product {
  id         String   @id @default(uuid())
  name       String
  type       String
  salesPrice Int
  costPrice  Int
  notes      String?
  active     Boolean  @default(true)
  variants   ProductVariant[]
  discounts  DiscountProduct[]
}

model ProductVariant {
  id         String  @id @default(uuid())
  productId  String
  attribute  String
  value      String
  extraPrice Int     @default(0)
  product    Product @relation(fields: [productId], references: [id])
  @@unique([productId, attribute, value])
}

model Plan {
  id            String        @id @default(uuid())
  name          String
  price         Int
  billingPeriod BillingPeriod
  minQuantity   Int           @default(1)
  startDate     DateTime
  endDate       DateTime?
  autoClose     Boolean       @default(false)
  closable      Boolean       @default(true)
  pausable      Boolean       @default(false)
  renewable     Boolean       @default(true)
  templates     QuotationTemplate[]
  subscriptions Subscription[]
}

model Tax {
  id      String @id @default(uuid())
  name    String
  rateBps Int
  active  Boolean @default(true)
}

model Discount {
  id          String        @id @default(uuid())
  name        String
  type        DiscountType
  value       Int
  minPurchase Int?
  minQuantity Int?
  startDate   DateTime
  endDate     DateTime
  usageLimit  Int?
  timesUsed   Int           @default(0)
  scope       DiscountScope
  products    DiscountProduct[]
  subscriptions SubscriptionDiscount[]
}

model DiscountProduct {
  discountId String
  productId  String
  discount   Discount @relation(fields: [discountId], references: [id])
  product    Product  @relation(fields: [productId], references: [id])
  @@id([discountId, productId])
}

model QuotationTemplate {
  id           String @id @default(uuid())
  name         String
  validityDays Int
  planId       String
  plan         Plan   @relation(fields: [planId], references: [id])
  lines        QuotationTemplateLine[]
}

model QuotationTemplateLine {
  id         String  @id @default(uuid())
  templateId String
  productId  String
  variantId  String?
  quantity   Int
  template   QuotationTemplate @relation(fields: [templateId], references: [id])
}

model Subscription {
  id              String             @id @default(uuid())
  number          String             @unique
  customerId      String
  planId          String
  status          SubscriptionStatus @default(DRAFT)
  startDate       DateTime
  expiryDate      DateTime?
  paymentTermDays Int                @default(0)
  nextInvoiceDate DateTime?
  pausedAt        DateTime?
  renewedFromId   String?
  createdAt       DateTime           @default(now())
  customer        Customer           @relation(fields: [customerId], references: [id])
  plan            Plan               @relation(fields: [planId], references: [id])
  lines           SubscriptionLine[]
  invoices        Invoice[]
  discounts       SubscriptionDiscount[]
  @@index([status, nextInvoiceDate])
  @@index([customerId])
}

model SubscriptionLine {
  id             String       @id @default(uuid())
  subscriptionId String
  productId      String
  variantId      String?
  quantity       Int
  unitPrice      Int
  taxId          String?
  amount         Int
  subscription   Subscription @relation(fields: [subscriptionId], references: [id])
}

model SubscriptionDiscount {
  subscriptionId String
  discountId     String
  subscription   Subscription @relation(fields: [subscriptionId], references: [id])
  discount       Discount     @relation(fields: [discountId], references: [id])
  @@id([subscriptionId, discountId])
}

model Invoice {
  id             String        @id @default(uuid())
  number         String        @unique
  subscriptionId String
  customerId     String
  periodStart    DateTime
  periodEnd      DateTime
  status         InvoiceStatus @default(DRAFT)
  subtotal       Int
  discountTotal  Int           @default(0)
  taxTotal       Int
  total          Int
  amountPaid     Int           @default(0)
  issueDate      DateTime
  dueDate        DateTime
  subscription   Subscription  @relation(fields: [subscriptionId], references: [id])
  customer       Customer      @relation(fields: [customerId], references: [id])
  lines          InvoiceLine[]
  payments       Payment[]
  @@unique([subscriptionId, periodStart])
  @@index([status, dueDate])
  @@index([customerId])
}

model InvoiceLine {
  id             String  @id @default(uuid())
  invoiceId      String
  productId      String?
  description    String
  quantity       Int
  unitPrice      Int
  discountAmount Int     @default(0)
  taxRateBps     Int     @default(0)
  taxAmount      Int     @default(0)
  amount         Int
  invoice        Invoice @relation(fields: [invoiceId], references: [id])
}

model Payment {
  id        String        @id @default(uuid())
  invoiceId String
  method    PaymentMethod
  amount    Int
  paidOn    DateTime
  note      String?
  createdAt DateTime      @default(now())
  invoice   Invoice       @relation(fields: [invoiceId], references: [id])
  @@index([paidOn])
}

model Counter {
  key   String @id
  value Int    @default(0)
}
```

## 9. State machines

One function per entity checks an allowed-transitions map. Anything else returns 409.

```ts
const subscriptionFlow = {
  DRAFT: ['QUOTATION'],
  QUOTATION: ['CONFIRMED'],
  CONFIRMED: ['ACTIVE'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
};
const invoiceFlow = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};
```

Side effects on subscription transitions:

- DRAFT to QUOTATION: needs at least one line; set quotation expiry if built from a template.
- QUOTATION to CONFIRMED: validate quantities against plan minimum; lock prices.
- CONFIRMED to ACTIVE: set `nextInvoiceDate = startDate`.
- ACTIVE to CLOSED: clear `nextInvoiceDate`; no more billing.

Invoice cancel is allowed only when `amountPaid = 0`. A PAID invoice never changes.

## 10. Roles and access

| Area | Admin | Staff | Customer |
| --- | --- | --- | --- |
| Users: create staff | yes | no | no |
| Products, variants, plans, taxes, discounts, templates: write | yes | no | no |
| Same catalog: read | yes | yes | no |
| Customers: list and edit | yes | yes | own profile only |
| Subscriptions | all | all | own, read plus pause/close/renew if plan allows |
| Invoices: confirm, cancel, send, print | yes | yes | own, read and print |
| Payments: record | yes | yes | no |
| Reports | yes | yes | no |
| Run billing manually | yes | no | no |

Customer isolation is enforced in the query: every customer route adds `where customerId = token.customerId`. Records that belong to someone else return 404.

## 11. API contract

All paths are prefixed with `/api`. `A` Admin, `S` Staff, `C` Customer.

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | /health | public | health check |
| POST | /auth/signup | public | create customer account |
| POST | /auth/login | public | returns JWT and user |
| POST | /auth/forgot-password | public | send reset link |
| POST | /auth/reset-password | public | token plus new password |
| GET | /auth/me | all | current user |
| POST | /users/staff | A | create staff member |
| GET | /users | A | list users |
| GET, POST | /products | read A,S; write A | products |
| GET, PATCH, DELETE | /products/:id | read A,S; write A | one product |
| POST | /products/:id/variants | A | add variant |
| PATCH, DELETE | /variants/:id | A | edit or remove variant |
| GET, POST | /plans | read A,S; write A | plans |
| PATCH, DELETE | /plans/:id | A | edit plan |
| GET, POST, PATCH | /taxes | read A,S; write A | taxes |
| GET, POST, PATCH | /discounts | read A,S; write A | discount rules |
| POST, DELETE | /discounts/:id/subscriptions/:subId | A | attach or detach |
| GET, POST | /templates | read A,S; write A | quotation templates |
| GET, POST | /customers | A,S | customers |
| GET, POST | /subscriptions | A,S | list and create (optional `templateId`) |
| GET, PATCH | /subscriptions/:id | A,S | detail and edit while DRAFT |
| POST | /subscriptions/:id/transition | A,S | body `{ to }` |
| POST | /subscriptions/:id/pause, /resume, /renew | A,S,C | if plan flag allows |
| GET | /invoices | A,S | list with filters |
| POST | /subscriptions/:id/invoices | A,S | manual generate for next due period |
| POST | /invoices/:id/confirm, /cancel, /send | A,S | invoice actions |
| GET | /invoices/:id/print | A,S,C | print-ready HTML |
| POST | /invoices/:id/payments | A,S | record payment |
| GET | /payments | A,S | list payments |
| GET | /me/subscriptions, /me/invoices | C | portal data |
| POST | /admin/run-billing | A | run billing job now |
| GET | /reports/summary | A,S | counts and money totals |
| GET | /reports/overdue | A,S | overdue invoices |

All list endpoints accept `page`, `pageSize`, `sort`, `q` and their own filters (`status`, `customerId`, `from`, `to`).

## 12. Billing engine

File: `jobs/billing.job.ts` calls `invoices.service.generateInvoice`. Runs on `BILLING_CRON` and on `POST /admin/run-billing`.

```
runBilling(today):
  closeExpired(today)   # autoClose plans past end date, expired subscriptions
  due = ACTIVE subscriptions, pausedAt is null, nextInvoiceDate <= today
  for each sub (own try/catch, one failure never stops the batch):
    up to 12 times, while nextInvoiceDate <= today and
      (expiryDate is null or nextInvoiceDate <= expiryDate):
        generateInvoice(sub.id)   # catches up missed periods
```

`generateInvoice(subscriptionId)` runs in ONE `prisma.$transaction`:

1. Load subscription, lines, plan, attached discounts. `periodStart = nextInvoiceDate`, `periodEnd = periodStart + 1 period - 1 day`.
2. Build invoice lines from subscription lines (customer, product, quantity, unit price).
3. Find eligible discounts: today inside start and end date, `timesUsed < usageLimit`, minimum purchase and minimum quantity met. PRODUCT scope applies to lines of the listed products; SUBSCRIPTION scope applies to attached discounts on the whole subtotal. Apply PRODUCT discounts first, then SUBSCRIPTION discounts, never beyond the subtotal. Split a subscription-level discount across lines in proportion, putting rounding leftovers on the last line.
4. Claim usage atomically: `updateMany({ where: { id, timesUsed: { lt: usageLimit } }, data: { timesUsed: { increment: 1 } } })`. If zero rows updated, skip that discount.
5. Tax per line on the discounted amount, rounded half up, then totals.
6. Number from `Counter`, `issueDate = today`, `dueDate = issueDate + paymentTermDays`, status DRAFT. Insert invoice and lines.
7. Advance `nextInvoiceDate` by one period. If the unique `(subscriptionId, periodStart)` constraint fires (error P2002), the period was already billed: do not create anything, just advance `nextInvoiceDate`.

Period math lives in `utils/dates.ts` (month and year add must clamp the day, e.g. 31 Jan plus one month is 28 or 29 Feb). Pricing math lives in `utils/pricing.ts` as pure functions with unit tests.

Payments: lock the invoice row inside a transaction, check `amount <= total - amountPaid`, insert payment, update `amountPaid`, set PAID when it equals the total.

## 13. Validation (Zod, mirror on frontend)

- Signup and staff creation: email format, password rule above, name required.
- Product: prices are non-negative integers; variant `extraPrice` is a non-negative integer.
- Plan: `endDate` after `startDate`, `minQuantity >= 1`, price positive.
- Discount: `endDate` after `startDate`; PERCENT value 1 to 10000 basis points; FIXED value positive; `usageLimit` positive if set.
- Subscription: `expiryDate` after `startDate`; line quantity at least plan minimum.
- Payment: amount positive integer, at most the outstanding balance, date not in the future.
- Reject unknown fields (`.strict()`). Trim strings. Return all field errors at once in `error.fields`.

## 14. Frontend spec (fast, smooth, consistent)

**Routes by role**

- Admin: Dashboard, Products, Plans, Taxes, Discounts, Templates, Users, Subscriptions, Invoices, Payments, Reports.
- Staff: Dashboard, Subscriptions, Invoices, Payments, Customers.
- Customer: My subscriptions, My invoices, Profile.
- Guards redirect by role after login. Unknown routes show a clean 404 page.

**Look and feel**

- One palette: primary indigo `#4F46E5`, neutrals from slate, success green, warning amber, danger red. System font stack only (works offline). Icons from `lucide-react`.
- Layout: left sidebar plus top bar. Under 768px the sidebar becomes a drawer and tables turn into stacked cards.
- Status badges everywhere: Draft gray, Quotation blue, Confirmed amber, Active green, Closed slate, Paid green, Overdue red, Cancelled muted red. A subscription's status must be visible in the list and the detail header.
- Money shown as `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` from paise.

**Smoothness rules**

- TanStack Query for all data, `keepPreviousData` on paginated lists so tables never flash empty.
- Skeleton loaders for first load, never a blank screen. Friendly empty states with a primary action.
- Filters, search and page live in the URL query string, so refresh and back button work. Search is debounced 300 ms.
- Forms: react-hook-form with the same Zod schemas. Show inline errors, map `error.fields` from the API, disable submit while saving, toast on success or failure.
- Confirm dialogs for destructive or irreversible actions (cancel invoice, close subscription).
- State-changing buttons appear only when the transition is allowed (for example no Confirm button on a PAID invoice).
- Dashboard cards: active subscriptions, revenue collected, outstanding amount, overdue count, plus an overdue invoice table with filters.

## 15. Reports and performance

- `/reports/summary` uses aggregate queries (`count`, `sum`, `groupBy`), never loads rows into app code.
  - Active subscriptions: count where status ACTIVE.
  - Revenue collected: sum of `Payment.amount` in the date range.
  - Outstanding: sum of `total - amountPaid` for CONFIRMED invoices.
  - Overdue: CONFIRMED and `dueDate < today`.
- Indexes are already in the schema (`status, nextInvoiceDate`, `status, dueDate`, `customerId`, `paidOn`). Add more only after measuring.
- Select only needed columns for list views. Never return unbounded lists.
- Target: p95 under 2 s per page with 5,000 subscriptions and 20,000 invoices. Add a `scripts/bench.ts` that times the main endpoints.

## 16. Seed data (`prisma/seed.ts`)

- 1 admin, 1 staff, 1 customer (credentials in section 4), plus 200 generated customers.
- 3 taxes (for example GST 5, 12, 18 percent), 6 products with variants (include Odoo brand +560), 4 plans (monthly, yearly, weekly, daily), 2 templates.
- 3 discounts (fixed, percent, and one that is nearly out of uses).
- 5,000 subscriptions across all statuses, 20,000 invoices across Draft, Confirmed, Paid, Cancelled, a spread of due dates including overdue, and matching payments.
- Use `createMany` in chunks of 1,000. Seeding must finish in under a minute and be re-runnable (clear tables first).

## 17. Testing (Vitest and Supertest, against a separate test database)

Must have tests for: password rule, duplicate email returns 409, role guards return 403, customer cannot read another customer's invoice (404), illegal state change returns 409, billing job run twice creates one invoice per period, discount `usageLimit` respected under two parallel runs, tax on discounted amount, overpayment rejected, overdue calculation, reset token expiry and single use, month-end date clamping.

## 18. Git workflow

- Branches: `main` (stable), `develop` (integration), `feature/<module>`.
- Every teammate commits from their own account. Open a pull request into `develop`, at least one other person reviews.
- Commit messages: `feat(invoices): generate invoice from subscription`. Small, frequent commits.
- Never commit `.env`, `node_modules`, or generated build output. Commit `.env.example`.

## 19. Build phases and agent prompts

Give an agent this whole document plus one prompt below. Each phase ends with its acceptance check passing.

**Phase 0: scaffold.** Prompt: Create the monorepo, `docker-compose.yml`, backend skeleton (Express, env validation, error handler, `/api/health`) and frontend Vite app with Tailwind. Acceptance: `docker compose up -d`, API answers `/api/health`, UI loads.

**Phase 1: schema.** Prompt: Create `schema.prisma` from section 8, validate it, run the first migration, write the seed for admin, staff and customer only. Acceptance: migration applies cleanly, seed logs in.

**Phase 2: auth.** Prompt: Implement auth and users modules per sections 7, 10 and 11 with Zod validation, JWT middleware, `requireRole`, reset flow with Mailpit. Acceptance: signup, login, reset link in Mailpit, customer gets 403 on admin routes.

**Phase 3: catalog.** Prompt: Implement products, variants, plans, taxes, discounts, templates CRUD with the validation in section 13. Acceptance: admin creates a product with the +560 Odoo variant and a monthly plan.

**Phase 4: subscriptions.** Prompt: Implement customers and subscriptions, template-based creation, numbering, the transition function and side effects in section 9, plus pause, resume, renew. Acceptance: walk Draft to Closed; illegal jumps return 409.

**Phase 5: invoicing.** Prompt: Implement `pricing.ts`, `generateInvoice`, invoice actions (confirm, cancel, send to Mailpit, print HTML) per section 12. Acceptance: generating twice for one period yields one invoice; discount and tax math correct in tests.

**Phase 6: billing job.** Prompt: Implement `billing.job.ts`, cron registration, `POST /admin/run-billing` and `npm run billing:run`. Acceptance: 500 due subscriptions bill in one run, rerun creates nothing new.

**Phase 7: payments and reports.** Prompt: Implement payments and the reports endpoints per sections 12 and 15. Acceptance: partial then full payment flips the invoice to PAID; dashboard numbers match SQL totals.

**Phase 8: frontend.** Prompt: Build role-based routes and pages per section 14 against the real API, using shared Zod schemas. Acceptance: all three roles can complete their flows on desktop and mobile widths.

**Phase 9: harden.** Prompt: Write the full seed (section 16), `scripts/bench.ts`, the tests in section 17, README with ER diagram and setup steps. Acceptance: every page under 2 s with seeded data; test suite green.

## 20. Definition of done

- [ ] Fresh clone runs with only the commands in section 4, no internet needed after install.
- [ ] All business rules in section 7 are enforced on the backend, not only the UI.
- [ ] No hardcoded or static JSON data in the frontend.
- [ ] Role and customer-isolation tests pass.
- [ ] Billing twice for the same period is impossible (test proves it).
- [ ] Finance dashboard filters and summary work; overdue list is correct.
- [ ] Every list is paginated and responds in under 2 s on seeded data.
- [ ] Responsive at phone and desktop widths with one consistent color scheme.
- [ ] README has setup steps, ER diagram, demo accounts and a short demo script.
- [ ] Git history shows commits and pull requests from every team member.

## 21. Assumptions (change here, then tell the agents)

- Currency is INR, stored in paise.
- Tax is calculated after discounts.
- Several discounts can stack; total discount never exceeds the subtotal.
- Invoices are created as DRAFT; staff confirm them (no auto-confirm).
- Renew clones the subscription into a new DRAFT.
- Pause is stored as `pausedAt` on an ACTIVE subscription, not as a new status.
- No proration or mid-cycle quantity changes.
- A plan's end date stops new billing for auto-close plans; it does not delete existing data.
