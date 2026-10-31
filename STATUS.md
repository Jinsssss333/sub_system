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
| 1 Identity | existing, fixed | see below |

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
