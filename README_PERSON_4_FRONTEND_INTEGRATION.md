# 🎨 Person 4 Guide: Frontend & Integration Owner

> **Domain:** Complete React Frontend UI, Design System, Multi-Role Views, TanStack Query Integration, Print Invoices, Browser Acceptance, and Live Demo Pitch Lead.  
> **Git Branch:** `feature/frontend-integration`  
> **Source of Truth:** [`Brightloop Logic Architecture and Implementation Handoff.md`](./Brightloop%20Logic%20Architecture%20and%20Implementation%20Handoff.md)

---

## 📂 Files You Own & Touch
```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts         <-- Fetch wrapper with Bearer token & error mapping
│   ├── components/           <-- Reusable Badges, Modals, Tables, Metric Cards
│   ├── layouts/              <-- App Shell, Sidebar, Topbar with Role Switcher
│   ├── pages/
│   │   ├── admin/            <-- Products, Variants, Plans, Discounts manager
│   │   ├── staff/            <-- Subscriptions list/detail, Invoices, Payment modal
│   │   ├── customer/         <-- Customer Self-Service Portal (My Subs, My Invoices)
│   │   └── finance/          <-- Finance Lead KPI Dashboard & Overdue Table
│   ├── App.tsx               <-- Routing and Role Guard setup
│   └── index.css             <-- Tailwind styles and @media print CSS
```
> ⚠️ **No-Touch Rule:** Do not edit `backend/` files. Connect to backend endpoints via `/api/*`.

---

## 🎯 Core Views & Components to Build

### 1. App Shell & Navigation (`src/layouts/`)
* **Sidebar:** Left navigation that adapts dynamically based on active role:
  - **Admin:** Catalog, Plans, Discounts, Users, Finance Dashboard.
  - **Staff:** Subscriptions, Invoices, Payments, Customers.
  - **Customer:** My Subscriptions, My Invoices, Profile.
* **Topbar:** Top bar with a **Live Role Switcher button group (Admin | Staff | Customer)** so hackathon judges can toggle perspectives in one click.

### 2. Status Badges & Design Tokens (`src/components/`)
* **Color Palette:** Primary Indigo (`#4F46E5`), Slate neutrals, Emerald for Paid/Active, Amber for Confirmed, Rose for Overdue/Cancelled.
* **Subscription Status Badges:**
  - `DRAFT`: Gray
  - `QUOTATION`: Blue
  - `CONFIRMED`: Amber
  - `ACTIVE`: Emerald
  - `CLOSED`: Slate
* **Currency Formatter:** Display paise formatted in Indian Rupees:
  ```typescript
  export const formatINR = (paise: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
  ```

### 3. Admin Catalog Views (`src/pages/admin/`)
* **Products & Variants Table:**
  - Shows products, prices, and variants.
  - Highlight variant: **Odoo Edition (+₹560.00)**.
* **Plans Manager:**
  - Displays Monthly/Yearly plans, billing frequency, and policy badges (`closable`, `pausable`, `renewable`, `autoClose`).

### 4. Staff Operations Views (`src/pages/staff/`)
* **Subscriptions Table & Detail Page:**
  - List with search, status filters, and pagination.
  - Detail page with line items, totals, and **contextual transition buttons**:
    - *"Submit Quote"*, *"Approve & Confirm"*, *"Activate Subscription"*, *"Pause"*, *"Renew"*.
    - Show confirm dialogs for destructive actions.
* **Invoices & Payments Modal:**
  - Invoices list showing due date and status.
  - Detail page with **"Record Payment" modal**:
    - Select Payment Method (`UPI`, `CARD`, `CASH`, `BANK_TRANSFER`, `CHEQUE`).
    - Input amount (pre-filled with remaining balance).
    - Submitting automatically updates remaining balance and flips badge to `PAID`.

### 5. Customer Self-Service Portal (`src/pages/customer/`)
* **My Subscriptions:** Clean, customer-facing card view showing their active plans.
* **My Invoices:** List of past and current invoices with a **"Print / Download"** button.
* **Customer Isolation:** Verify when logged in as `customer@brightloop.test`, no data from other customers is visible.

### 6. Finance Lead Dashboard (`src/pages/finance/`)
* **4 Big Metric KPI Cards:**
  1. **Active Subscriptions:** (e.g. `12 Subscribers`)
  2. **Revenue Collected:** (e.g. `₹4,50,000.00`)
  3. **Total Outstanding:** (e.g. `₹1,20,000.00`)
  4. **Overdue Invoices:** (e.g. `3 Invoices`)
* **Overdue Invoices Table:** Direct table with customer name, due date, amount, and quick action to follow up.
* **Fast Load Guarantee:** TanStack Query auto-refreshes metrics in $<200\text{ms}$.

### 7. Printable Invoice View
* Clean invoice layout with company header, line item table (gross, discount, tax, total), and `@media print` CSS so clicking **Print** produces a clean PDF directly in Chrome/Edge without extra dependencies.

---

## ⏱️ Hour-by-Hour 6-Hour Plan
* **Hour 1 (0:00 – 1:00):** Set up layout shell with sidebar, topbar, and working Role Switcher. Test routing.
* **Hour 2 (1:00 – 2:00):** Build Admin Catalog screen (Products, Odoo variant, Plans) and Status Badges.
* **Hour 3 (2:00 – 3:00):** Build Staff Subscriptions list/detail and the *"Record Payment"* modal with instant balance update.
* **Hour 4 (3:00 – 4:00):** Build Customer Portal views and Finance Dashboard KPI cards.
* **Hour 5 (4:00 – 4:45):** **MERGE POINT:** Connect live API endpoints (`/api/*`), verify end-to-end flows, and format printable invoice.
* **Hour 6 (4:45 – 6:00):** Rehearse and lead the **3-minute live pitch** for the judges!

---

## 🔍 Edge Cases You Must Guard Against
1. **Never Show Blank Screens:** Use skeleton loaders while TanStack Query fetches.
2. **Form Errors:** Map backend `error.fields` directly to inputs so forms show clear inline validation errors.
3. **Invalid Actions:** Don't render a *"Confirm"* button on an invoice that is already `PAID`.
4. **Mobile Responsive:** Verify table rows convert to readable cards on mobile width (<768px).

---

## 🎤 What You Explain to Hackathon Judges (Pitch Lead)
> *"I designed our responsive UI and unified user experience across all three roles. We built a customer self-service portal where customers manage their own accounts with total data isolation, an operational console for staff to manage quotes and log payments, and an executive dashboard where the finance boss sees real-time revenue and overdue receivables instantly. Our UI is 100% bundled offline with zero external CDN dependencies."*

