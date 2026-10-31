# Person 4: Polished frontend and demo integration

Three-hour hackathon scope. Aim for an industry-style, demo-ready experience, not a production-grade claim. Reuse existing components and connect to real APIs from the first hour.

## Ownership and design

- **Branch:** `feature/frontend-integration`.
- **Own:** frontend only; send backend contract issues to the relevant owner.
- **Keep stack:** React/Vite/TypeScript/Tailwind, existing Router/query/forms foundations. Do not change libraries for cosmetic reasons.
- **Style:** indigo `#4F46E5`, slate surfaces, system fonts, restrained borders, consistent spacing, semantic status badges.
- **Shell:** one responsive sidebar/topbar, page heading, reusable table/card, form modal, toast and confirmation dialog.
- **No dead buttons:** hide unfinished actions. No dummy finance values in the final demo.

## Must ship screens, in priority order

| Screen | Required behavior |
| --- | --- |
| Login | Seeded real sign-in; loading and bad-password feedback |
| Dashboard | Four live KPI cards; overdue/recent invoice list; useful navigation |
| Subscriptions | Search/status/pagination; create form; readable detail; legal lifecycle buttons |
| Invoice detail/list | Stored lines/taxes/totals, status, balance and receipt history |
| Record payment modal | Method/date/amount; prefill balance; partial/full updates |
| Catalog | Products/variants/plans; simple create forms if endpoints ready |
| Customers | Search/list and simple create form |
| Customer view | Own subscriptions/invoices using owned endpoints, not UI-only filtering |

Build the core journey before adding optional screens. Staff and admin can share operational pages with appropriate controls rather than separate duplicated dashboards.

## Contract with backend owners

```text
API base /api; Authorization: Bearer <JWT>
Money integer paise; currency formatter divides by 100
Rates integer basis points; percentage display divides by 100
Dates YYYY-MM-DD
Success { data }; lists { data, meta: { page, pageSize, total } }
Error { error: { code, message, fields? } }
```

- **Person 1:** login/me; GET/POST customers/products/plans; variants and taxes.
- **Person 2:** subscription create/list/detail and transition; owned subscription endpoints.
- **Person 3:** generate invoice, invoice detail/list/confirm, payments, owned invoices, summary and overdue.
- **Period-aware generate:** pass `{ periodStart: subscription.nextInvoiceDate.slice(0,10) }` to `POST /subscriptions/:id/invoices`. Store the returned invoice ID, invalidate subscription data and navigate to its detail.
- **Contract freeze:** confirm actual payload examples in the first ten minutes. Adapt to compatible existing endpoints instead of demanding rewrites.

Search/filter/page live in URL query params; debounce search around 300 ms. If existing helpers differ, reuse them consistently.

## Critical interactions

- **Subscription form:** customer, plan, dates/terms and repeatable product/variant/quantity/tax lines. Send IDs/quantity only; display server-calculated prices after save.
- **Lifecycle:** DRAFT → QUOTATION → CONFIRMED → ACTIVE. Only render the legal next action.
- **Generate invoice:** visible for active, unpaused due subscriptions. Disable during request.
- **Confirmation:** invoice DRAFT → CONFIRMED before collecting payments.
- **Payment:** display current balance; submit positive integer paise; handle server overpayment errors; only full settlement becomes PAID.
- **Mutations:** await server result, invalidate detail/list/dashboard queries, then show contextual feedback.
- **Role boundaries:** hiding an action is UX, not security; backend must independently reject it.
- **Customer isolation:** use `/me/subscriptions` and `/me/invoices`; never download all customers' data and filter in React.

## Role switching correction

Do NOT merely change a role variable in the topbar. That does not change server authorization.

For the demo, sign out and log in using seeded accounts. A development-only quick-login button is acceptable only if it performs a real authentication request and replaces the session/query cache. Never ship credentials as a production feature.

## Polish checklist

- Consistent headings, spacing, price alignment and concise labels.
- Green ACTIVE/PAID; gray DRAFT; blue QUOTATION; amber CONFIRMED; rose overdue.
- OVERDUE is derived from confirmed status and due date, not a new stored status.
- Skeleton/loading, empty lists, API error/retry and inline form validation.
- Searchable customer lookup beyond the first 100 records.
- Disable duplicate submit; clear stale record data after account changes.
- Keyboard focus, labelled fields, in-page confirm dialogs.
- Check 1440px desktop and 375px mobile; stack wide tables and use a drawer.
- No CDN fonts or runtime network assets required.
- Do not guarantee automatic sub-200 ms refresh; verify requests and visible updates.

## Defer unless already working

- Password reset/signup polish, team administration and profile editing.
- Full discount/template managers, pause/resume/renew controls.
- Advanced charts, animations, mail sending and broad report filters.
- PDF generation libraries. If time remains, add browser print styling to the existing invoice view.

Hide unsupported features rather than presenting a misleading working UI.

## Timeline from now

| Time | Deliverable |
| --- | --- |
| 0–15 min | Inspect current UI; freeze payloads; establish tokens and navigation |
| 15–40 min | Real login, shell, dashboard layout, catalog/customer API options |
| 40–75 min | Subscription create/list/detail and transitions using live API |
| 75–110 min | Invoice generation/detail/confirmation and payment modal |
| 110–135 min | Live KPIs, customer-owned views, responsive/error-state polish |
| 135–150 min | Integrated smoke test; remove dead controls; feature freeze |
| 150–180 min | Rehearse on the presentation laptop; fix blockers only |

Temporary fixtures during construction must be removed or clearly separated before the final demo. Never use static JSON as the apparent production data source.

## Three-minute demo script

1. Show dashboard totals from the database.
2. Select customer/product/plan and the Odoo variant; create a subscription.
3. Advance quotation → confirmed → active.
4. Generate and confirm its invoice.
5. Record a partial payment, then the remaining balance; show PAID and updated dashboard.
6. Sign in as the customer; show only their own invoice/subscription.

Use today's start date so billing is due. Keep a second seeded ACTIVE subscription and a confirmed unpaid invoice as fallback scenes, not fake responses.

## Final acceptance

The full flow must work after refresh using real records. Test another customer's ID rejection, invalid quantity and overpayment. On presentation day, describe only completed features; do not claim automated collection, scheduled billing, production readiness or measured speed unless actually implemented and verified.
