# Person 1: Identity, catalog and integration foundation

Three-hour hackathon scope. Preserve working foundations; do not rewrite or switch stacks. This scope supersedes the earlier six-hour work plan, not mandatory judging requirements. Keep already-working extras, but stop expanding them.

## Ownership

- **Branch:** `feature/identity-catalog`.
- **Own:** auth, customers, products, variants, plans, basic taxes, shared middleware and seed.
- **Integration owner:** only you edit Prisma schema/migrations, backend app route registration, shared exports and backend dependency files. Teammates supply route exports; merge them immediately.
- **Boundaries:** do not rewrite subscription, invoice or frontend modules. Coordinate shared changes in team chat first.

## First ten minutes: freeze contracts

Share these conventions with all teammates before anyone changes them.

```text
Base URL: /api
Auth: Authorization: Bearer <JWT>
Money: integer paise; ₹560 = 56000
Rates: integer basis points; 18% = 1800
Dates: YYYY-MM-DD; compare using one UTC business date
Success: { data: ... }
List: { data: [...], meta: { page, pageSize, total } }
Error: { error: { code, message, fields?: { fieldName: message } } }
```

Lists use `q`, `page`, `pageSize` and applicable `status` filters. Cap pageSize at 100. Keep existing compatible contracts rather than renaming them.

For unimplemented pricing semantics, use product charges plus a clearly displayed recurring plan base fee; product tax does not implicitly tax that fee. If existing code uses a different interpretation, resolve it with Persons 2–4 now. Do not silently alter prices halfway through integration.

## Must ship

- **Login:** `POST /auth/login` with `{ email, password }`; return `{ data: { token, user: { id, name, email, role, customerId } } }`. No hashes.
- **Current user:** `GET /auth/me`; verify token and load safe user data.
- **Roles:** ADMIN and STAFF operate subscriptions/invoices; ADMIN modifies catalog; CUSTOMER reads own records. Guards apply server-side.
- **Customers:** `GET /customers`, `POST /customers`; expose `{ id, companyName, user: { name, email }, phone, address }`. Customer creation must return the customer ID, not just user ID.
- **Products:** `GET /products`, `POST /products`; include variants in product results. Admin writes, staff reads.
- **Variants:** `POST /products/:id/variants`; validate product relation and integer extra price.
- **Plans:** `GET /plans`, `POST /plans`; price, period, minQuantity and existing policy flags.
- **Taxes:** `GET /taxes`; seed GST 18%. Keep tax creation if already working.
- **Validation:** required fields, nonnegative integer prices, positive quantities, email normalization and duplicate handling.
- **Seed:** admin/staff/customer logins, 5–10 customers, a few products/plans, an Odoo variant, and representative invoice states coordinated with Person 3.

Use existing safe JWT/bcrypt foundations. Never accept a requested role from public signup or log passwords/tokens.

## Seed and environment

Publish `.env.example` and exact local startup commands by minute 15. Never overwrite teammates' databases or run a destructive reset automatically. Use the existing database/schema; only add necessary compatible fields.

Development-only demo accounts:

```text
admin@brightloop.test     Admin@1234
staff@brightloop.test     Staff@1234
customer@brightloop.test  Customer@1234
```

If credentials already differ, publish those instead of resetting them. Disable demo-account shortcuts outside development.

## Defer unless already working

- Password reset/Mailpit integration, staff management UI, elaborate signup.
- Discount CRUD, expiry/usage-limit rules and product-scoped discount UI.
- Large 5,000/20,000-record seed and benchmarking.
- Generalized delete/archive management and advanced catalog configuration.

These are deadline deferrals, not assertions that the original requirements are satisfied.

## Timeline from now

| Time | Deliverable |
| --- | --- |
| 0–10 min | Inspect existing work; freeze payloads, pricing and route exports |
| 10–35 min | DB works; seeded login; auth guards; GET customers/products/plans/taxes available |
| 35–65 min | Customer/product/plan creation; register Persons 2–3 routes as they arrive |
| 65–110 min | Fix integration/validation issues; run real role-boundary checks |
| 110–145 min | Merge stable changes; assist full-flow test; freeze schema |
| 145–180 min | Feature freeze, restart from documented commands, rehearse and fix blockers only |

Do not wait until the end to merge. Small, compiling commits and shared payload examples every 20–30 minutes.

## Acceptance

- All three seeded accounts sign in; invalid credentials fail cleanly.
- Customer cannot create a product or list other customers.
- Staff can load catalog options and create a customer.
- Odoo variant extra price is exactly 56000 paise.
- Database-backed data survives refresh/restart.
- No production-grade security or performance claims without verification.
