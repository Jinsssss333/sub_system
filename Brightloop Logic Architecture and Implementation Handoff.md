# Brightloop: logic architecture and implementation handoff

Status: planning only. Implementation is paused at the user's request. This document prepares a reviewed build for Claude Opus 5.5; it is not authorization to resume coding.

## Scope and source of truth

- **Business goal:** run products → plans → quotation → subscription activation → recurring invoices → recorded payments → finance reports on one laptop.
- **Primary requirements:** the uploaded `Subscription_Management_System-1-3.pdf`, the hackathon expectations image, and repository `Claude.md`.
- **Fixed stack:** Node 20+, TypeScript, Express, Prisma, PostgreSQL 16 via Docker, Zod, JWT, bcrypt, node-cron, nodemailer/Mailpit, React/Vite/TypeScript/Tailwind, React Router, TanStack Query, react-hook-form, lucide-react, Vitest/Supertest.
- **Deployment constraint:** local-first. No cloud database, remote fonts, external payment APIs or runtime internet dependency.
- **Implementation philosophy:** correctness in a complete vertical flow first; reusable, consistent UI second; breadth and polish after each module's acceptance checks pass.
- **Priority when documents conflict:** ask the user about material business differences; record proposed resolutions rather than silently treating them as approved.

## Current workspace and stop point

The GitHub repository is `https://github.com/Jinsssss333/sub_system`; the inspected main commit was `f132d31`. That baseline contained `Claude.md` and `LICENSE`, not application code.

Before the user's pause arrived, local uncommitted files were created under `/home/user/workspace/sub_system`, including backend services, shared schemas, a frontend, migration and seed. A local build completed and a development database was seeded, but this work has not undergone integration, browser, security or concurrency acceptance testing. Nothing was committed or pushed to GitHub.

Treat all those local files, including `DECISIONS.md`, as unreviewed drafts, not approved architecture. Keep them intact for inspection; do not push, deploy, discard, or continue implementation until the user authorizes building.

The sandbox's available PostgreSQL package was version 18; the intended deliverable still specifies PostgreSQL 16. Verification on the actual Docker/PostgreSQL 16 setup remains necessary. The initial dependency audit also reported advisories; dependency selection must be reviewed before the build is called ready.

## System architecture

```text
React pages
    ↓ forms validated with shared Zod schemas
API client + TanStack Query
    ↓ Bearer JWT; URL-based search, filters, pagination
Express routes
    ↓ authenticate → authorize → validate → controller
Domain services
    ↓ enforce ownership, lifecycle, pricing and transaction invariants
Prisma / PostgreSQL
    ↓ constraints, row locks, atomic counters, indexes

node-cron + manual admin billing command
    → same billing orchestration service
    → same invoice-generation service

Mail service → local Mailpit
Print renderer → escaped server-rendered HTML
```

- **Routes:** map paths, middleware and controllers only.
- **Controllers:** parse validated input, call one service operation, return the response envelope. No pricing, state-machine or database orchestration logic.
- **Services:** own business decisions, transaction scope and side effects.
- **Pure utilities:** money arithmetic, date arithmetic and allowed-state checks. Test independently.
- **Shared schemas:** request validation used by both client and server; frontend validation never substitutes for backend checks.
- **Database:** final guard against duplicate billing, invalid references and race conditions.

## Domain ownership and contracts

| Domain | Owns | Required invariants |
| --- | --- | --- |
| Accounts | Signup, login, staff creation, reset | Lowercase unique email; public signup creates CUSTOMER only; no password/hash leakage |
| Catalog | Products, variants, plans | Nonnegative integer prices; variant belongs to product; plan availability/minimum quantity validated |
| Taxes | Named basis-point rates | Admin writes; invoice snapshots preserve the applied rate |
| Discounts | Eligibility and usage limits | Product rules automatic; subscription rules attached; atomic usage claim; never discount below zero |
| Templates | Plan, lines, quotation validity | Copy values into a new subscription; later template edits do not mutate existing subscriptions |
| Customers | Company and contact details | Customer sees/edits own profile; staff/admin manage permitted operational records |
| Subscriptions | Lifecycle and next due date | Legal transitions only; immutable financial lines after draft; flag-controlled portal actions |
| Invoices | Recurring periods and charge snapshots | One invoice per subscription/period; invoice amounts do not depend on later catalog edits |
| Payments | Offline receipt recording | Confirmed invoice; positive amount; no overpayment; atomic balance update |
| Reports | Aggregate operational totals | Collected revenue comes from receipts; draft/cancelled invoices are not outstanding |
| Billing job | Due-work coordination | Per-subscription isolation; bounded catch-up; same engine as manual generation |

## Business decisions to resolve before implementation

These are proposals, not existing user decisions. Defaults are recommended to keep the hackathon scope coherent.

| Ambiguity | Recommended resolution | Why it matters |
| --- | --- | --- |
| Plan price versus product prices | Treat plan price as a recurring base fee and show it as a separate invoice line; ask for approval | Otherwise two developers can double-charge or ignore plan price |
| Tax on plan base fee | Do not invent a tax rule; either explicitly untaxed or add an approved tax association | Product tax should not silently imply base-fee tax |
| Quotation validity versus subscription expiry | Add nullable `quotationExpiryDate`; keep `expiryDate` for service termination | Different dates have different lifecycle effects |
| Pause/resume semantics | No proration; retain the original billing anchor; skip scheduled billing instants during the pause | Blindly resuming at an old due date causes unwanted back-billing |
| Invoice period end at service expiry | Cap displayed/covered period at expiry without proration, or require aligned expiry dates | A period must not imply unapproved service coverage |
| Auto-close and unpaid historical periods | Decide whether closure discards uninvoiced backlog or whether backlog must be billed first | Brief says close expired subscriptions before generating invoices |
| Expiry for plans without auto-close | Stop generation beyond service expiry; keep status until explicit closure | Avoid expired subscriptions remaining perpetually due |
| Zero-total invoice | On confirmation, settle as PAID atomically without a zero-value payment | Cannot record a positive receipt against zero balance |
| Multiple discount ordering | PRODUCT first, then SUBSCRIPTION; stable deterministic order within each scope | Fixed and percentage discounts can produce different totals depending on order |
| Invoice cancellation | Keep the billed-period uniqueness record; no automatic reissue in MVP | Cancellation must not accidentally charge a period again |
| Manual invoice double-click | Send/validate the intended period start, or explicitly define “generate next due period” | Period uniqueness alone does not prevent two different overdue periods being generated by two clicks |
| Password reset console logging | Do not log raw reset links; inspect Mailpit instead | Brief simultaneously forbids token logging and asks to print a token-bearing URL |

Record the accepted answers in one approved decision log before coding the affected domain. Do not let frontend convenience choose accounting behavior.

## Data model review

Start from the Prisma draft in `Claude.md`, then validate every relation and constraint before generating a migration.

- **Foreign keys:** relate line product/variant/tax IDs to their actual records, with reverse relations. Scalar UUID fields alone do not enforce existence.
- **Variant integrity:** verify the selected variant's `productId` matches the line product even when both foreign keys exist.
- **Renewal linkage:** use a self-relation for `renewedFromId`; define whether one open renewal per original is required and enforce the accepted rule transactionally.
- **Quotation validity:** add a separate field only after approving its semantics.
- **Snapshots:** store invoice description, unit price, quantity, discount amount, tax rate and tax amount. Never recompute an old invoice from current catalog data.
- **Customer billing details:** decide whether customer name/address must also be snapshotted on invoice issue. Otherwise historical printouts change when a profile is edited.
- **Money capacity:** choose a documented maximum per line and invoice below PostgreSQL Int limits, or approve BigInt/Decimal and transport rules. Prevent multiplication overflow before insertion.
- **Constraints:** retain unique user email, product/attribute/value variant key, invoice `(subscriptionId, periodStart)` and human-readable numbers.
- **Indexes:** retain due-subscription, invoice status/due date, ownership and payment-date indexes. Measure before adding indexes.
- **Deletion:** referenced catalog records should be archived or protected, never cascade-delete financial history.
- **Numbering:** increment the Counter row within the same transaction as the new subscription/invoice. Do not calculate MAX(number) + 1.

## Lifecycle orchestration

### Subscription state machine

```text
DRAFT → QUOTATION → CONFIRMED → ACTIVE → CLOSED
```

Pause is an attribute of ACTIVE, not an additional status.

| Operation | Preconditions | Atomic effects |
| --- | --- | --- |
| Create draft | Valid customer, plan, available start date and valid product/variant combinations | Copy template if used; calculate server prices; create number + lines |
| Draft → quotation | At least one line; valid quantities | Set/retain quotation expiry according to approved validity policy |
| Quotation → confirmed | Quote not expired; quantities meet plan minimum; referenced items valid | Freeze financial inputs; reject illegal or stale transition |
| Confirmed → active | Availability and service dates still valid | Set `nextInvoiceDate` to start date |
| Pause | ACTIVE, not already paused, plan pausable | Set `pausedAt`; no invoice generation while paused |
| Resume | ACTIVE, currently paused, plan pausable | Clear pause and apply the approved skipped-period policy |
| Close | ACTIVE; customer requires closable flag; internal override allowed | CLOSED, clear next billing date; retain existing invoices |
| Renew | Plan renewable; valid new availability dates | Clone into a new DRAFT with renewal linkage; never mutate original |

Use a conditional update/lock so two requests cannot both pass stale preconditions. Enforce permissions and ownership before exposing record details.

### Invoice state machine

```text
DRAFT → CONFIRMED → PAID
  └────→ CANCELLED
CONFIRMED → CANCELLED only when amountPaid = 0
```

- **Confirmation:** does not collect money.
- **Paid:** reached through valid payments, except an explicitly approved zero-total policy.
- **Cancellation:** disallowed after any payment; cancelled periods retain their historical record.
- **Overdue:** a derived label, not a persisted status: CONFIRMED and due date before the business date.
- **Send/print:** operate on stored snapshots; customer ownership enforced on both detail and print endpoints.

## Pricing algorithm

All money is integer paise; all percentage rates are integer basis points. Never accept totals or unit prices supplied by the browser.

```text
For each product line:
    unitPrice = catalogSalesPrice + selectedVariantExtraPrice
    gross = quantity × unitPrice

Add an explicitly approved plan base-fee line, if applicable.

For each eligible PRODUCT discount, in stable order:
    choose eligible product lines
    check minimum purchase / quantity on the defined eligible base
    compute and cap discount at remaining eligible amount
    claim one permitted usage atomically
    allocate discount without losing paise

For each attached eligible SUBSCRIPTION discount, in stable order:
    check current eligibility and remaining limits
    compute and cap discount
    claim one usage atomically
    allocate proportionally to remaining line balances

For each line:
    taxableAmount = gross − allocatedDiscount
    tax = roundHalfUp(taxableAmount × rateBps / 10000)

subtotal = sum(gross)
discountTotal = sum(allocatedDiscount)
taxTotal = sum(lineTax)
total = subtotal − discountTotal + taxTotal
```

- **Rounding:** use integer/BigInt intermediates; proportional allocation must sum exactly to the discount and never exceed a line's remaining balance. Use a bounded remainder or largest-remainder strategy rather than putting an arbitrarily large remainder on a zero/small last line.
- **Eligibility:** define whether minimum spend is evaluated before other discounts; apply that definition consistently.
- **Usage:** increment once per invoice that actually receives the rule, not per line and not on previews.
- **Rollback:** if invoice insertion fails, all discount usage claims and number increments roll back.
- **Presentation:** show discounts and tax separately in UI and print; clearly label base fee if adopted.

## Transaction boundaries and concurrency

### Invoice generation transaction

```text
BEGIN
    lock subscription
    reload state, pause flag, dates and intended billing period
    verify due and billable
    look up invoice for (subscriptionId, periodStart)
    if it exists: return existing / reconcile cursor, do not reprice it

    load price/tax snapshots and eligible discount rules
    lock discount rows in a global deterministic order
    re-read usage limits and claim eligible usages
    calculate exact line/summary amounts
    increment invoice counter
    insert invoice + lines
    advance subscription nextInvoiceDate
COMMIT
```

- **Uniqueness:** database constraint is mandatory even with a row lock.
- **Retries:** bound retries for serialization/deadlock conflicts; do not retry arbitrary validation failures.
- **Deadlocks:** consistent discount lock order is essential when multiple subscriptions share rules.
- **Unique-conflict handling:** do not query/update inside a PostgreSQL transaction already aborted by a unique violation. Roll back and handle/retry from a new transaction.
- **Same-period requests:** both must resolve to the same invoice or one explicit conflict, never two invoices.
- **Different periods:** advancing the cursor is legitimate only under the approved catch-up/manual-generation behavior.

### Payment transaction

```text
BEGIN
    lock invoice
    reload status and current amountPaid
    require CONFIRMED
    require 0 < amount ≤ total − amountPaid
    validate paidOn is not in the future
    insert payment
    increment amountPaid
    if amountPaid = total: mark PAID
COMMIT
```

Two concurrent payments must not both validate against the same stale balance.

### External side effects

- **Email:** send after the core database transaction. A failed email does not undo invoice creation or payment; UI reports delivery failure and allows retry.
- **Reset:** store only token hash, expiry and usage time; claim a valid token once inside the password-update transaction.
- **Print:** escape all customer/product text. A text field must never become executable HTML.
- **Payment scope:** manual receipts only. Do not imply that choosing CARD/UPI actually charges a card or creates a UPI transaction.

## Billing scheduler

One orchestration function serves cron, CLI and the admin button. Do not create three implementations.

1. Compute one UTC date-only business date for the run.
2. Apply the approved expiry/auto-close policy.
3. Fetch due ACTIVE, unpaused subscriptions in bounded batches using stable keyset pagination.
4. For each subscription, call the transactional invoice generator repeatedly, up to 12 periods.
5. Re-check state and dates inside every invoice transaction; query-time eligibility can become stale.
6. Catch failures per subscription, not around the whole batch.
7. Return generated/skipped/closed/failure counts without leaking sensitive data.
8. A retry with no remaining due work creates no additional invoices.

Calendar month/year addition clamps to valid dates while retaining the original anchor: January 31 → February 28/29 → March 31. Use the original subscription anchor, not the previous clamped date.

## API and authorization

Keep the route inventory in `Claude.md`; explicitly document approved additions rather than inventing paths in components.

- **Auth:** public account/password endpoints; authenticated `/auth/me`.
- **Admin:** staff creation, catalog writes, tax/discount rules, template writes, manual batch billing.
- **Staff:** customer/subscription operations, invoice workflows, payment recording, reports; catalog read allowed.
- **Customer:** own subscriptions/invoices/profile; only flag-permitted pause/resume/close/renew; no payment recording or reports.
- **Ownership:** enforce in the database query using JWT-derived customer ID, not request body ownership. Other customers' records return 404.
- **Response shape:** `{ data, meta? }`; errors `{ error: { code, message, fields? } }`.
- **Lists:** validate page/pageSize/sort/filter whitelist; maximum 100; bounded nested relations; deterministic tie-breaker sort.
- **Detail responses:** include readable product/variant/tax labels for customer portal lines without exposing catalog cost prices.
- **Validation:** strict unknown-field rejection, trimmed strings, proper dates, positive quantities, max string/body sizes, full inline field errors.
- **Auth hardening:** bounded login/reset attempts; generic forgot-password response; strong noncommitted JWT secret; no token/hash/password logs.

The existing contract has gaps for invoice detail, own profile edits, customer close and customer subscription detail. Define these before connecting UI routes.

## UI orchestration

### Role-based navigation

- **Admin:** Overview, Subscriptions, Invoices, Payments, Customers, Reports; Products, Plans, Taxes, Discounts, Quote Templates; Team.
- **Staff:** Overview, Subscriptions, Invoices, Payments, Customers; read-only catalog access where needed to do operational work.
- **Customer:** My Subscriptions, My Invoices, Profile.

### Reusable frontend contracts

- **App shell:** sidebar/topbar, responsive drawer, role-aware navigation and route guards.
- **List page:** URL-backed search/filter/sort/page; 300 ms debounce; keep previous query data; skeleton/empty/error states.
- **Detail page:** prominent status, allowed-action toolbar, line items, totals and related records.
- **Form:** shared Zod schema, react-hook-form, inline API errors, pending submit protection.
- **Mutation:** submit → show pending → receive authoritative result → invalidate affected list/detail/report queries → contextual success/error.
- **Destructive action:** in-page confirmation dialog naming the affected record and consequence.
- **Lookup inputs:** searchable paginated customers/products; do not assume the first 100 records cover all choices.
- **Mobile:** stacked table cards below 768px, readable totals, no horizontal page overflow, 44px touch targets.
- **Visual language:** system fonts, indigo `#4F46E5`, slate surfaces, restrained status colors; no external assets required.

### Dashboard semantics

- **Active subscriptions:** explicitly define whether paused ACTIVE subscriptions remain in this count.
- **Revenue collected:** sum payment amounts by paid date, not invoice totals.
- **Outstanding:** confirmed invoice totals minus recorded payments.
- **Overdue:** confirmed balances whose due date precedes today.
- **Date filters:** label each metric's scope. Active subscriptions are a current snapshot unless historical status tracking is introduced.
- **No invented growth:** show percentage changes only when a comparable prior period is actually computed.

## Build sequence and quality gates

Do not divide work only by visual page. Build modules against frozen shared contracts so teammates can integrate.

| Gate | Build | Acceptance before moving on |
| --- | --- | --- |
| Foundation | Repo setup, shared schemas, DB model, migration, error envelope, health | Fresh local setup works on PostgreSQL 16 |
| Identity | Signup/login/reset/RBAC | Duplicate 409; weak password 400; role denial 403; reset expiry/single-use |
| Catalog | Products/variants/plans/taxes/discounts/templates | Odoo variant adds ₹560 exactly; validations enforced server-side |
| Subscription | Customers, template copy, draft edit, lifecycle, portal isolation | Full legal chain; illegal jump 409; customer cannot read another record |
| Financial core | Pure pricing/date functions, invoice snapshots, locking, billing | Exact rounding; month-end recovery; parallel same-period billing; usage-limit race |
| Collection | Invoice confirm/cancel/send/print, partial/full payments | Concurrent overpayment rejected; PAID matches receipts; print injection escaped |
| Operations | Scheduler, aggregates, seed, benchmark | Run twice safely; per-subscription failures isolated; measured response times |
| UI integration | Three role experiences against real API | Customer/admin/staff critical flows pass at desktop and 375px |
| Release | Dependency audit, clean setup, tests, demo script, Git review | No unverified “done” claims; documented residual gaps |

If the hackathon deadline compresses, protect auth/ownership, exact arithmetic, billing uniqueness and payment safety. Reduce visual extras and advanced charts first, not these guarantees.

## Four-person team split

This is a suggested ownership plan, not permission for agents to start parallel builds.

- **Identity/catalog owner:** auth, RBAC, users, customers, catalog and shared request schemas.
- **Subscription owner:** template copy, lifecycle, pause/resume/renewal policy and date logic.
- **Billing owner:** pricing, invoice snapshots, concurrency, receipts, scheduler and aggregates.
- **Frontend/integration owner:** shared UI, three role experiences, API integration and browser acceptance.

Before parallel work, agree on response envelopes, request schemas, detail payloads, statuses, pricing decisions and migration ownership. One person owns schema integration; teammates do not independently rewrite the database model.

## Test inventory

### Pure unit tests

- Password length 8 versus 9; case and special-character rules.
- January 31 monthly clamping, March recovery and leap-year anniversaries.
- Half-up tax after discounts; fixed/percent cap; proportional allocation including zero/small last lines.
- Subscription state map and derived overdue date boundary.

### Real-database integration tests

- Duplicate mixed-case email returns 409.
- Staff/customer cannot create staff or modify catalog.
- Customer cannot inspect another customer's detail, print or action endpoint.
- Two concurrent activation/state-change requests cannot both create stale side effects.
- Two same-period invoice requests create one invoice and one discount usage.
- Shared discount with one remaining use cannot be consumed twice concurrently across subscriptions.
- Paused subscriptions do not bill; resume obeys approved skip policy.
- Separate scheduler invocations and manual generation cannot duplicate a period.
- Two payments exceeding the combined balance cannot both commit.
- Cancellation after partial payment fails; paid invoice is immutable.
- Reset expiry, token reuse and concurrent reset claims are rejected.
- Report totals match SQL aggregates after partial/full receipts.

Use a separate test database. Refuse destructive cleanup unless the database name is explicitly a test target.

### Browser acceptance

- Admin creates product/variant/plan; staff creates/activates subscription; admin bills; staff confirms invoice and records partial/full receipts.
- Dashboard numbers and invoice badges update after mutation.
- Customer signs in and sees only their own records; permitted controls work.
- Every visible form, lookup, tab, search, sort, pagination, dialog and print-preview control is exercised.
- Validate phone and desktop layouts, keyboard use, loading, empty and error states.
- Check the actual deployed preview separately if one is later requested; localhost checks are not hosted-preview verification.

### Performance and release evidence

- Seed 5,000 subscriptions and 20,000 consistent invoices/payments in bounded batches.
- Document actual database version and seed duration.
- Benchmark representative filtered list/detail/report endpoints and report sample size plus p50/p95.
- Verify frontend has no static data fallback presented as real records.
- Record dependency audit findings and resolutions.
- Never claim the under-two-second target without measurements.

## Prompt for the next model

> We are planning a local-first Brightloop subscription system for an Odoo hackathon. Read the uploaded brief, repository Claude.md and BRIGHTLOOP_LOGIC_HANDOFF.md completely. The user explicitly paused building and will authorize implementation separately.
>
> Do not start coding, installing, migrating, committing, pushing or deploying yet. First summarize the architecture and identify only the business decisions that materially affect billing. Treat existing local files and DECISIONS.md as unreviewed drafts, not user-approved choices.
>
> Once the user approves building, inspect the actual workspace and Git status before editing. Keep the fixed Express/Prisma/PostgreSQL 16 and React stack. Implement one quality gate at a time with tests. Do not substitute a static UI, cloud service or different persistence stack. Keep business rules in service modules, enforce role/ownership rules server-side, use transactional billing and payments, and validate the full three-role flow before calling the repo ready.
