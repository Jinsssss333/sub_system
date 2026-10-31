# STATUS — feature/full-build

Living build log. Each gate lists commands run, real output, and test counts. Resume with "continue from STATUS.md".

## Environment

- Branch: `feature/full-build`, created from `dev` at `6ea3207` (repo has no `develop`; owner approved `dev` as baseline).
- Node `v20.20.2`, npm `10.8.2`.
- PostgreSQL: **16.15** (`PostgreSQL 16.15 (Ubuntu 16.15-1.pgdg26.04+2)`), installed natively from apt.postgresql.org.
- **Docker is not available in this sandbox.** `docker-compose.yml` (postgres:16 + Mailpit) was not run here; everything was verified against the native PostgreSQL 16.15 above. Mailpit was not running during tests (mail transport is mocked in tests).

## Baseline (`dev` @ 6ea3207)

### git log --oneline -20
```
5da2a81 feat(frontend): connect views to live backend API endpoints with resilient seed fallback
6ea3207 Merge feature/felix: frontend integration and API bridge
2a56442 feat(frontend): integrate resilient API bridge, live backend connection health, and expose network host
e809207 Merge pull request #7 from Jinsssss333/feature/felix
b5a3cdd Merge branch 'feature/felix' of https://github.com/Jinsssss333/sub_system into feature/felix
92b9787 feat: implement backend modules and validation schemas for users, subscriptions, and auth
498d104 Merge pull request #6 from Jinsssss333/feature/identity-catalog
439543c chore: sync backend package-lock.json
c9caefc Merge remote-tracking branch 'origin/feature/felix' into feature/felix
ff53329 Merge remote-tracking branch 'origin/dev' into feature/identity-catalog
0871c4b feat(portal): add customer and finance views
d028b7f chore: restore local compose setup and ignore Vite cache
2531e33 chore: auto-seed database after test:person2 run
3e6a908 Merge remote-tracking branch 'origin/dev' into feature/billing-engine
2410647 feat: initialize Express application with core routers and middleware
595cdc6 chore: update backend package-lock.json
b090d91 feat(pricing): add complete pricing engine and hackathon example tests
ddb1c70 test: add unit tests for invoice pricing calculations
a4ccf95 feat(routes): register subscription invoices and me invoices in app router
870cca8 feat(reports): implement summary kpi metrics and overdue reports
```

### git status (at checkout)
```
On branch dev — nothing to commit, working tree clean
```

### File tree (tracked, excluding lockfiles)
```
.gitignore
Claude.md
DECISIONS.md
LICENSE
README.md
README_PERSON_1_IDENTITY_CATALOG.md
README_PERSON_2_SUBSCRIPTIONS.md
README_PERSON_3_BILLING_FINANCE.md
README_PERSON_4_FRONTEND_INTEGRATION.md
backend/.env
backend/.env.example
backend/package.json
backend/prisma/schema.prisma
backend/prisma/seed.ts
backend/src/app.ts
backend/src/config/db.ts
backend/src/config/env.ts
backend/src/config/mailer.ts
backend/src/jobs/billing.job.ts
backend/src/middleware/auth.ts
backend/src/middleware/errorHandler.ts
backend/src/middleware/requireRole.ts
backend/src/middleware/validate.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.routes.ts
backend/src/modules/auth/auth.schema.ts
backend/src/modules/auth/auth.service.ts
backend/src/modules/customers/customers.controller.ts
backend/src/modules/customers/customers.routes.ts
backend/src/modules/customers/customers.schema.ts
backend/src/modules/customers/customers.service.ts
backend/src/modules/invoices/invoices.routes.ts
backend/src/modules/invoices/invoices.service.ts
backend/src/modules/payments/payments.routes.ts
backend/src/modules/payments/payments.service.ts
backend/src/modules/plans/plans.controller.ts
backend/src/modules/plans/plans.routes.ts
backend/src/modules/plans/plans.schema.ts
backend/src/modules/plans/plans.service.ts
backend/src/modules/products/products.controller.ts
backend/src/modules/products/products.routes.ts
backend/src/modules/products/products.schema.ts
backend/src/modules/products/products.service.ts
backend/src/modules/reports/reports.routes.ts
backend/src/modules/subscriptions/subscriptions.controller.ts
backend/src/modules/subscriptions/subscriptions.routes.ts
backend/src/modules/subscriptions/subscriptions.schema.ts
backend/src/modules/subscriptions/subscriptions.service.ts
backend/src/modules/taxes/taxes.controller.ts
backend/src/modules/taxes/taxes.routes.ts
backend/src/modules/taxes/taxes.schema.ts
backend/src/modules/taxes/taxes.service.ts
backend/src/modules/templates/templates.controller.ts
backend/src/modules/templates/templates.routes.ts
backend/src/modules/templates/templates.schema.ts
backend/src/modules/templates/templates.service.ts
backend/src/modules/users/users.controller.ts
backend/src/modules/users/users.routes.ts
backend/src/modules/users/users.schema.ts
backend/src/modules/users/users.service.ts
backend/src/server.ts
backend/src/utils/dates.ts
backend/src/utils/errors.ts
backend/src/utils/numbering.ts
backend/src/utils/pricing.ts
backend/test/pricing.test.ts
backend/tests/dates.test.ts
backend/tests/statemachine.test.ts
backend/tests/verify_person_1.ts
backend/tests/verify_person_2.ts
backend/tsconfig.json
docker-compose.yml
frontend/index.html
frontend/package.json
frontend/postcss.config.js
frontend/src/App.tsx
frontend/src/api/client.ts
frontend/src/api/mockData.ts
frontend/src/components/Badge.tsx
frontend/src/components/StatCard.tsx
frontend/src/index.css
frontend/src/layouts/PrintInvoiceModal.tsx
frontend/src/main.tsx
frontend/src/pages/admin/DiscountsPage.tsx
frontend/src/pages/admin/PlansPage.tsx
frontend/src/pages/admin/ProductsPage.tsx
frontend/src/pages/customer/CustomerPortal.tsx
frontend/src/pages/finance/FinanceDashboard.tsx
frontend/src/pages/staff/InvoicesPage.tsx
frontend/src/pages/staff/PaymentModal.tsx
frontend/src/pages/staff/SubscriptionsPage.tsx
frontend/src/utils/formatters.ts
frontend/tailwind.config.js
frontend/tsconfig.json
frontend/tsconfig.node.json
frontend/vite.config.ts
```

### Baseline assessment

- Backend: auth (login/signup/me), users, customers, products, plans, taxes, templates, subscriptions, invoices, payments, reports and a billing job existed. Missing: password reset, discounts API, admin run-billing route, migrations, integration tests.
- Bugs found: `runBilling` passed `today` as the requested period (every scheduled run failed with INVALID_PERIOD_START); auto-close was rolled back by the thrown error; clients could override `unitPrice`; ownership checked after fetch rather than in the query; mailer fallback printed full email HTML (reset links) to the console; `backend/.env` was committed.
- Frontend: UI shell with pages backed by `mockData.ts` fallbacks; role switcher auto-logged in with demo credentials; `PaymentModal` called hooks conditionally.

## Gates

| Gate | Status | Commit |
| --- | --- | --- |
| 0 Foundation | existing, fixed | e24ec18 |
| 1 Identity | existing, fixed | dc31025 |
| 2 Catalog | existing, fixed + built (discounts) | c8bd88e |
| 3 Subscriptions | existing, fixed | 69c9b59 |
| 4 Financial core | existing, fixed | 5b87a33 |
| 5 Collection | existing, fixed + built (print, ledger) | 78f6914 |
| 6 Operations | existing, fixed + built (seed, benchmark) | 3f64db7 |
| 7 Frontend | existing, replaced (rebuilt on the real API) | 748112f |
| 8 Hardening & docs | built | see below |

### Gate 0 — Foundation: existing, fixed

Changes:
- Root npm workspaces (`shared`, `backend`, `frontend`) with one root lockfile; root scripts `typecheck`, `lint`, `build`, `test`, `db:*`, `bench`.
- New `@brightloop/shared` package: Zod contracts used by both frontend forms and backend validation, money limits (`MAX_LINE_AMOUNT_PAISE = 100,000,000` = ₹10,00,000 per line; max 10 lines; rates ≤ 10000 bps), `rupeesToPaise`, `formatINR`.
- Backend switched to ESM (`"type": "module"`); env validation reports variable names only, never values.
- Error envelope `{ error: { code, message, fields? } }` now also covers malformed JSON, Prisma P2002/P2025/P2003, unknown `/api` routes; 500s hide internals; request bodies are never logged.
- Mailer no longer prints email bodies (reset links) when Mailpit is down.
- `/api/health` reports database reachability (503 when down).
- First Prisma migration `20261031100359_init` (none existed) plus PostgreSQL CHECK constraints: invoice amounts non-negative and `amountPaid <= total`, payment amount > 0, discount `timesUsed <= usageLimit`, tax rate 0–10000 bps, line quantity > 0. Added indexes for list ordering.
- `backend/.env` removed from git tracking (`git rm --cached`); `.env.example` and `.env.test.example` committed. **Rotate any secret that was in the committed `.env`.**
- docker-compose: Postgres healthcheck and init script creating `billing_test`.
- Vitest + Supertest harness against `billing_test` (global setup runs `prisma migrate deploy`, refuses non-test databases). Team's `tests/dates.test.ts` and `tests/statemachine.test.ts` converted to Vitest without changing assertions.
- ESLint 9 flat config (typescript-eslint, react-hooks). Fixed: conditional hooks in `PaymentModal`, unused imports.

Commands and output:
```
$ npx prisma migrate deploy                    -> All migrations have been successfully applied.
$ npm run typecheck                            -> exit 0
$ npx eslint .                                 -> ✖ 41 problems (0 errors, 41 warnings)   [warnings: legacy `any`]
$ npm run build                                -> exit 0 (shared, backend tsc, frontend vite ✓ built)
$ npm test -w backend                          -> Test Files 4 passed (4) | Tests 11 passed (11)
```

### Gate 1 — Identity: existing, fixed

Existing and kept: signup (CUSTOMER role, lowercase email, 409 duplicates), login, `/auth/me`, admin-only staff creation, user list.
Built: `POST /api/auth/forgot-password` (always the same 200; 32-byte random token, only its SHA-256 stored, 30-minute expiry, older links invalidated, link mailed to Mailpit), `POST /api/auth/reset-password` (atomic single-use claim). Fixed: login now spends bcrypt time for unknown emails too; JWT pinned to HS256 and expiry from `JWT_EXPIRES_IN`; staff creation uses the shared schema and `ApiError`; simple per-IP limit (20/min) on login, signup, forgot and reset.

Tests (`test/identity.test.ts`, 15): signup success + no hash leak, 4 password-policy rejections, case-insensitive duplicate 409, role self-assignment rejected, login + me, identical errors for unknown email vs wrong password, tampered token 401, admin creates staff while staff/customer get 403 + paginated list, forgot-password non-enumeration, hash-only storage + single use + old password invalid, expiry and supersession, no token in any console output.

```
$ npm run typecheck      -> exit 0
$ npx eslint .           -> exit 0, ✖ 38 problems (0 errors, 38 warnings)
$ npm run build          -> exit 0
$ npm test -w backend    -> Test Files 5 passed (5) | Tests 26 passed (26)
```

### Gate 2 — Catalog: existing, fixed; discounts built

Existing and kept: products, variants (unique attribute/value per product), plans with policy flags, taxes in basis points, quotation templates.
Fixed: every catalog schema now uses the shared contracts (integer paise, max ₹10,00,000, rates ≤ 10000 bps, date-order checks); ad-hoc error objects replaced by `ApiError`; templates list paginated. Built: `PATCH /api/products/:id` (admin; e.g. deactivate) and the discounts API (`GET /api/discounts` paginated, `GET /:id`, `POST` admin-only; FIXED in paise or PERCENT in bps, PRODUCT scope requires existing products, usage limit, date window).

Tests (`test/catalog.test.ts`, 7): product + Odoo variant (+₹560) + duplicate-variant 409 + paginated list; fractional/negative/oversized money rejected; admin deactivation and staff/customer 403s; plan policy defaults and date-order validation; tax bps bounds; discount creation and 5 validation failures + pagination; template creation, empty-template rejection, pagination.

```
$ npm run typecheck      -> exit 0
$ npx eslint .           -> exit 0, ✖ 30 problems (0 errors, 30 warnings)
$ npm run build          -> exit 0
$ npm test -w backend    -> Test Files 6 passed (6) | Tests 33 passed (33)
```

### Gate 3 — Subscriptions: existing, fixed

Existing and kept: customers module, template copy, DRAFT→QUOTATION→CONFIRMED→ACTIVE→CLOSED map with side effects, pause/resume/renew, `/api/me/subscriptions`.
Fixed:
- Clients can no longer send `unitPrice`; every line is priced from the catalog (product + variant) and capped at ₹10,00,000 per line, max 10 lines. Inactive products/taxes rejected.
- Ownership is now in the WHERE clause for subscription detail, pause/resume/renew, transitions and customer profiles (another customer's id → 404). Found and fixed a bug in my own first pass where `{ id, id: own }` would have returned the caller's own row.
- Transitions, pause and resume use compare-and-set (`updateMany` on the expected status) so concurrent changes return 409 instead of overwriting; DRAFT edits re-check status under a row lock.
- Resume follows the decision: no back-billing, `nextInvoiceDate` = next anchor on or after today (`nextAnchorOnOrAfter`, month-end anchors preserved).
- Customers may close (not otherwise transition) their own subscription when the plan is closable; renew only from ACTIVE/CLOSED.
- SUBSCRIPTION-scoped discounts can be attached on create/edit (PRODUCT discounts apply automatically at billing).
- `/api/me/subscriptions` paginated.
- Staff-created customers no longer get the shared default password `Customer@1234`; they get a random one plus a reset link.

Tests (`test/subscriptions.test.ts`, 13): customer creation without default password + profile isolation; catalog pricing (₹1,000 + ₹560 variant × 2 = ₹3,120) and forged `unitPrice` rejected; line-limit rejection; template copy with expiry; discount scope on attach; full lifecycle with cursor set/cleared; illegal jump 409 and post-DRAFT edit 409; min-quantity on confirm; pause/resume no-back-billing and non-pausable plan; renew; anchor helper month-end cases; portal list isolation and 404s on detail, pause, transition, 403 on staff list; customer close allowed but other transitions 403.

Note: the team's `tests/verify_person_1.ts` and `verify_person_2.ts` scripts (not part of the Vitest suite) were not updated and may fail where they send `unitPrice`.

```
$ npm run typecheck      -> exit 0
$ npx eslint .           -> exit 0, ✖ 28 problems (0 errors, 28 warnings)
$ npm run build          -> exit 0
$ npm test -w backend    -> Test Files 7 passed (7) | Tests 46 passed (46)
```

### Gate 4 — Financial core: existing, fixed

Existing and kept: pure integer pricing (`utils/pricing.ts`: PRODUCT then SUBSCRIPTION discounts, proportional allocation with bounded remainder, half-up tax on the net amount), date clamping with anchor recovery, `generateInvoice` in one transaction with a subscription row lock and the `(subscriptionId, periodStart)` unique constraint, plan base-fee line (untaxed), `runBilling` with 12-cycle catch-up.
Fixed:
- **`runBilling` passed `today` as the requested period**, so every scheduled run failed with INVALID_PERIOD_START unless the cursor happened to equal today. It now calls `generateInvoice(id, undefined, today)`.
- **Auto-close was rolled back** because the code threw after updating; it now commits `CLOSED` and returns `{ status: 'closed' }`.
- Discount usage was checked against values read *before* the row lock; it now locks in id order, re-reads, and claims with a conditional `UPDATE ... WHERE timesUsed < usageLimit` (plus the DB CHECK).
- If a unique-constraint race still occurs (P2002) the call returns the winner's invoice; an existing invoice at the cursor repairs the cursor instead of looping.
- `generateInvoice` now returns `{ status: 'created' | 'existing' | 'closed', invoice }`; `runBilling` reports `generated`, `closed`, `failures`, `durationMs`.

Tests: `test/billing.test.ts` (9) and `test/pricing.more.test.ts` (9) — exact invoice totals with plan fee/tax/due date/period end and cursor advance; snapshots unchanged after catalog price and tax changes; product-then-subscription discount totals and usage claim; usage-limit-1 discount raced by two subscriptions → applied once; paused/inactive/not-due refusals; committed auto-close; **concurrency test (1): two simultaneous requests for the same period → one `created`, one `existing`, one row**; catch-up of 15 missed periods (12 + 3) then 3 idempotent re-runs with no duplicates; paused skipped and one failing subscription isolated. Pure tests: half-up rounding, discount scope and order independence, floor at zero, min purchase/quantity, totals consistency, invalid input and Int-range rejection, period ends, 12-month anchor stability.

```
$ npm run typecheck      -> exit 0
$ npx eslint .           -> exit 0, ✖ 28 problems (0 errors, 28 warnings)
$ npm run build          -> exit 0
$ npm test -w backend    -> Test Files 9 passed (9) | Tests 64 passed (64)
```

### Gate 5 — Collection: existing, fixed; print view and payment ledger built

Existing and kept: confirm (zero total → PAID without a receipt), cancel (unpaid only), send to Mailpit, payment recording with an invoice row lock and balance check.
Fixed: confirm and cancel are compare-and-set; invoice detail ownership moved into the WHERE clause; `/api/me/invoices` query validated (bad status was a 500, now 400); payments use the shared contract (whole paise, positive, date not in the future); send requires a confirmed invoice, escapes all text and reports 503 when Mailpit is down instead of claiming success; list responses no longer embed every line and payment.
Built: `GET /api/invoices/:id/print` — server-rendered, self-contained print-ready HTML with every interpolated value passed through `escapeHtml`, ownership-scoped, served with a restrictive CSP; `GET /api/payments` paginated ledger.

Tests (`test/collection.test.ts`, 9): single confirmation + zero-total PAID with no payment row; cancel only unpaid; email to the customer with `<script>` escaped and drafts refused; print view escapes `<script>`, `<img onerror>` and `<b>` in description/company/address; partial → final payment → PAID → further payment 409; overpayment/zero/negative/fractional/draft/customer/future-date rejections; ledger pagination; **concurrency test (2): two simultaneous ₹700 payments on a ₹1,000 invoice → exactly one succeeds, `amountPaid` ₹700, one payment row**; customer invoice list/detail/print isolation, staff list 403, bad status 400.

```
$ npm run typecheck      -> exit 0
$ npx eslint .           -> exit 0, ✖ 27 problems (0 errors, 27 warnings)
$ npm run build          -> exit 0
$ npm test -w backend    -> Test Files 10 passed (10) | Tests 73 passed (73)
```

### Gate 6 — Operations: existing, fixed; full seed and benchmark built

Existing and kept: node-cron scheduler started by `server.ts`, `/api/reports/summary` (SQL aggregates), `/api/reports/overdue` (paginated).
Fixed: the admin billing router existed but was **never mounted**; it is now `POST /api/admin/run-billing` (admin only). Scheduler and admin button share a guard so two runs never overlap; invalid `BILLING_CRON` fails fast. Summary adds overdue amount, paused count, subscriptions by status and 6-month collected revenue (all `SUM`/`COUNT`/`GROUP BY` in PostgreSQL); overdue list no longer embeds full user rows.
Built: rewritten `prisma/seed.ts` (the team's version created a handful of records) — 3 demo logins, 5 named demo customers, catalog with the Odoo Edition variant (+₹560), 2 discounts, 2 templates, a demo story (active subscription with paid/overdue/current invoices, one due today for the live billing run, confirmed/quotation/draft/paused examples) plus 200 bulk customers → **exactly 5,000 subscriptions and 20,000 invoices** (17,603 payments), deterministic, ~8 s. `SEED_SIZE=small` for demo-only data. `scripts/benchmark.ts` (`npm run bench`) measures p50/p95 per endpoint and exits 1 if any p95 ≥ 2,000 ms.

Tests (`test/operations.test.ts`, 5): run-billing admin-only, idempotent second run; overlapping runs blocked; invalid cron rejected; report aggregates exact (revenue ₹150, outstanding ₹450, overdue 1 / ₹150, monthly revenue); full seed counts 5,000/20,000, no duplicate periods, demo login works, every PAID invoice fully paid.

```
$ npm run db:seed        -> Seed complete in 8.3s: 207 users, 5000 subscriptions, 20000 invoices, 17603 payments.
$ npm run typecheck      -> exit 0
$ npx eslint .           -> exit 0, ✖ 26 problems (0 errors, 26 warnings)
$ npm run build          -> exit 0
$ npm test -w backend    -> Test Files 11 passed (11) | Tests 78 passed (78)
$ npm run bench
```

Benchmark (PostgreSQL 16.15, in-process API over HTTP on localhost, sequential requests):

Dataset: 5000 subscriptions, 20000 invoices, 17603 payments. 50 samples per endpoint after 5 warm-up calls.

| Endpoint | n | p50 (ms) | p95 (ms) | max (ms) |
| --- | ---: | ---: | ---: | ---: |
| Subscriptions, page 1 `/subscriptions?page=1&pageSize=20` | 50 | 8.0 | 12.4 | 16.5 |
| Subscriptions, last page `/subscriptions?page=250&pageSize=20` | 50 | 10.0 | 13.3 | 16.5 |
| Subscriptions, search `/subscriptions?q=Lotus&page=1&pageSize=20` | 50 | 24.7 | 31.5 | 32.2 |
| Subscriptions, ACTIVE filter `/subscriptions?status=ACTIVE&page=1&pageSize=20` | 50 | 7.6 | 11.2 | 16.2 |
| Invoices, page 1 `/invoices?page=1&pageSize=20` | 50 | 4.0 | 6.5 | 13.5 |
| Invoices, last page `/invoices?page=1000&pageSize=20` | 50 | 11.5 | 13.1 | 19.0 |
| Invoices, search `/invoices?q=INV-0100&page=1&pageSize=20` | 50 | 18.9 | 22.3 | 24.6 |
| Payments ledger `/payments?page=1&pageSize=20` | 50 | 3.1 | 5.2 | 6.1 |
| Customers `/customers?page=1&pageSize=20` | 50 | 2.7 | 7.0 | 7.7 |
| Finance summary `/reports/summary` | 50 | 8.8 | 12.3 | 13.4 |
| Overdue invoices `/reports/overdue?page=1&pageSize=20` | 50 | 3.6 | 4.9 | 10.3 |
| Customer: my subscriptions `/me/subscriptions?page=1&pageSize=20` | 50 | 6.1 | 11.1 | 11.5 |
| Customer: my invoices `/me/invoices?page=1&pageSize=20` | 50 | 14.0 | 17.1 | 20.6 |

All endpoints within the 2000 ms budget.


### Gate 7 — Frontend: existing, replaced with a standard UI on the real API

Existing: the team's pages read from `api/mockData.ts` when the API failed, used conditional hooks in `PaymentModal`, and had no routes for taxes, templates, users, password reset or the customer invoice list. Those files were removed with `git rm` and the frontend was rebuilt (React, Vite, Tailwind, React Router, TanStack Query, react-hook-form + shared Zod, lucide-react, Inter bundled locally via `@fontsource-variable/inter`; no CDN).

- No mock fallback: every screen reads PostgreSQL through `/api`; a network failure shows an error state with retry.
- Role-based shell: admin (catalog, taxes, users), staff (subscriptions, invoices, payments, customers), customer portal (subscriptions, invoices, profile). Unknown routes redirect to the role's home.
- Every list is server-paginated with search/filters, skeleton, empty and error states. Forms use the shared Zod rules; server field errors are mapped back onto inputs.
- Money is entered in rupees and sent as integer paise; percentages as basis points. Payment modal pre-fills the balance and rejects amounts above it before the server does.
- Backend additions for the UI: `subscriptionId` filter on `/api/invoices` and `/api/me/invoices`; subscription number in invoice lists.
- Fixed during QA: `SMTP_HOST` default is now `127.0.0.1` (nodemailer failed to resolve `localhost` here, so Mailpit mail was silently not delivered); dashboard stat cards no longer truncate amounts; revenue chart uses compact labels (₹1.85 Cr) and no longer overflows at 375 px; payment methods shown as "UPI", "Bank transfer".

Frontend unit tests (`src/lib/forms.test.ts`, 11): rupee→paise parsing and limits, percent→bps, quantity bounds, query building, error-envelope parsing, server-field mapping, display formatting.

```
$ npm run typecheck      -> exit 0
$ npx eslint .           -> exit 0, ✖ 16 problems (0 errors, 16 warnings)
$ npm run build          -> exit 0 (dist/assets/index-*.js 448.13 kB, gzip 127.09 kB; built in 3.73s)
$ npm test -w backend    -> Test Files 11 passed (11) | Tests 78 passed (78)
$ npm test -w frontend   -> Test Files 1 passed (1) | Tests 11 passed (11)
```

Browser QA (Playwright 1.59 headless Chromium against `npm run dev` for backend :4000 and frontend :5173, full seed, Mailpit binary on :1025/:8025). The script was run from the sandbox and is not committed.

| Check | 1440×900 | 375×812 |
| --- | --- | --- |
| Smoke: all 12 admin routes + 3 customer routes load, 0 console errors, 0 API 4xx/5xx | pass | pass |
| No horizontal page overflow on any route | pass | pass (after the chart fix) |
| Flow 1 admin: create product (₹1,000) → plan (₹500/month) → subscription for Acme ×2 with 5% tax → quotation → confirm → activate → Run billing → invoice INV total ₹2,600.00 (₹2,000 + ₹100 tax + ₹500 untaxed base fee) → confirm | pass | pass |
| Flow 2 staff: record payment ₹2,601 rejected ("Amount cannot exceed the balance of ₹2,600.00"); ₹100 then balance ₹2,500 → invoice PAID; both rows in the payments ledger | pass | pass |
| Flow 3 customer: portal, my invoices, invoice detail incl. the invoices paid in flow 2 | pass | pass |
| Password reset: forgot form → email in Mailpit → link resets password → login works → reusing the link is rejected; no token in the API log | — | pass |
| Invoice email: `POST /api/invoices/:id/send` delivered to Mailpit | pass (API) | — |


### Gate 8 — Hardening and docs: built

- `npm audit fix` (non-breaking) changed nothing. Remaining: 19 advisories (16 moderate, 3 high); each fix needs a major upgrade, so they are recorded rather than forced:
  - `zod` < 4.6.6 (high, memory exhaustion on oversized collections). Exposure is limited because `express.json` is capped at 100 kb and arrays are bounded (≤ 10 lines).
  - `nodemailer` ≤ 10.1.3 (high, DoS from a malicious SMTP server, address-comment parsing). It only talks to local Mailpit.
  - `react-router` 6 (moderate, open redirect via backslash; SSR hydration). Navigation targets here are internal constants or router state, and there is no SSR.
  - `uuid` via `node-cron` 3 (moderate, `buf` argument not used); `esbuild`/`minimatch` (dev tooling only).
- README: real setup commands, a Mermaid ER diagram and a 3-minute demo script that matches the browser-verified flows. DECISIONS: resume rule, no default customer password, money limits, snapshots, discount claims, pagination, SMTP host.
- Final reseed `Seed complete in 8.1s: 207 users, 5000 subscriptions, 20000 invoices, 17603 payments.`

```
$ npm run typecheck      -> exit 0
$ npx eslint .           -> exit 0, ✖ 16 problems (0 errors, 16 warnings: legacy `any`)
$ npm run build          -> exit 0
$ npm test -w backend    -> Test Files 11 passed (11) | Tests 78 passed (78)
$ npm test -w frontend   -> Test Files 1 passed (1) | Tests 11 passed (11)
$ npm run bench          -> All endpoints within the 2000 ms budget.
```

Benchmark (PostgreSQL 16.15, sequential HTTP on localhost):

Dataset: 5000 subscriptions, 20000 invoices, 17603 payments. 50 samples per endpoint after 5 warm-up calls.
| Endpoint | n | p50 (ms) | p95 (ms) | max (ms) |
| --- | ---: | ---: | ---: | ---: |
| Subscriptions, page 1 `/subscriptions?page=1&pageSize=20` | 50 | 7.9 | 11.1 | 15.1 |
| Subscriptions, last page `/subscriptions?page=250&pageSize=20` | 50 | 9.5 | 15.6 | 16.4 |
| Subscriptions, search `/subscriptions?q=Lotus&page=1&pageSize=20` | 50 | 25.2 | 31.5 | 34.7 |
| Subscriptions, ACTIVE filter `/subscriptions?status=ACTIVE&page=1&pageSize=20` | 50 | 7.7 | 10.7 | 15.0 |
| Invoices, page 1 `/invoices?page=1&pageSize=20` | 50 | 3.5 | 5.7 | 10.4 |
| Invoices, last page `/invoices?page=1000&pageSize=20` | 50 | 11.8 | 16.2 | 17.3 |
| Invoices, search `/invoices?q=INV-0100&page=1&pageSize=20` | 50 | 18.8 | 24.5 | 24.8 |
| Payments ledger `/payments?page=1&pageSize=20` | 50 | 3.7 | 5.9 | 8.1 |
| Customers `/customers?page=1&pageSize=20` | 50 | 2.7 | 4.6 | 6.6 |
| Finance summary `/reports/summary` | 50 | 8.6 | 11.8 | 15.1 |
| Overdue invoices `/reports/overdue?page=1&pageSize=20` | 50 | 3.4 | 4.7 | 6.9 |
| Customer: my subscriptions `/me/subscriptions?page=1&pageSize=20` | 50 | 5.8 | 9.3 | 13.3 |
| Customer: my invoices `/me/invoices?page=1&pageSize=20` | 50 | 2.5 | 4.8 | 6.0 |

## Not verified here (honest gaps)

- **Docker is unavailable in this sandbox**, so `docker compose up` (postgres:16 + Mailpit images, init-test-db.sql) was never run. Everything was verified against a native PostgreSQL 16.15 and the Mailpit binary.
- Automated tests mock the mail transport. Real Mailpit delivery (reset email, invoice email) was checked manually in the browser and API QA of gate 7, not in CI.
- The team's `backend/tests/verify_person_1.ts` and `verify_person_2.ts` scripts were not updated for the new APIs and were not run.
- Only the 2 agreed concurrency tests exist (same-period invoice, two payments over the balance). There is no serializable-retry framework (by agreement).
- Browser QA covered the 3 agreed flows at 1440 px and 375 px plus a route smoke test. Discounts, templates and the users pages were loaded but not exercised end to end in the browser.
- The npm advisories listed above remain open.
