# 🧑‍💻 Person 1 Guide: Identity & Catalog Owner

> **Domain:** Authentication, RBAC, Users, Customers, Catalog (Products, Variants, Plans, Taxes, Discounts), and Shared Request Schemas.  
> **Git Branch:** `feature/identity-catalog`  
> **Source of Truth:** [`Brightloop Logic Architecture and Implementation Handoff.md`](./Brightloop%20Logic%20Architecture%20and%20Implementation%20Handoff.md)

---

## 📂 Files You Own & Touch
```
backend/
├── prisma/
│   ├── schema.prisma       <-- ONLY Person 1 edits & runs migrations!
│   └── seed.ts             <-- Seed master data & demo users
└── src/
    └── modules/
        ├── auth/           <-- Signup, login, reset, JWT
        ├── users/          <-- Staff creation, user listing
        ├── customers/      <-- Customer profiles
        ├── products/       <-- Products & Variants (+₹560 Odoo variant)
        ├── plans/          <-- Subscription plans & policy flags
        ├── taxes/          <-- GST tax rates (basis points)
        └── discounts/      <-- Discount rules (fixed & percent)
```
> ⚠️ **No-Touch Rule:** Do not touch `modules/subscriptions/`, `modules/invoices/`, `jobs/`, or `frontend/`.

---

## 🎯 Core Features & Endpoints to Build

### 1. Auth & RBAC Module (`src/modules/auth/`)
* **`POST /api/auth/signup`**:
  - Registers a new user with role `CUSTOMER`.
  - Email uniqueness check (case-insensitive, store lowercase).
  - Password validation regex: `^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$` (min 9 chars, uppercase, lowercase, special char).
* **`POST /api/auth/login`**:
  - Validates credentials using `bcrypt.compare`.
  - Returns `{ data: { token, user: { id, email, name, role, customerId } } }`.
* **`POST /api/auth/forgot-password`**:
  - Always returns HTTP 200 (prevents email enumeration).
  - Generates 32-byte crypto token, stores SHA-256 hash in `PasswordResetToken` (30 min expiry).
  - Sends email to local **Mailpit** (`localhost:1025`).
* **`POST /api/auth/reset-password`**:
  - Validates single-use token hash, updates user's `passwordHash`, marks token used.
* **`GET /api/auth/me`**:
  - Returns authenticated user profile from JWT.

### 2. Users & Customers Module (`src/modules/users/`, `src/modules/customers/`)
* **`POST /api/users/staff`**: (Admin only via `requireRole('ADMIN')`)
  - Creates staff member account.
* **`GET /api/users`**: (Admin only) Lists all accounts.
* **`GET, POST /api/customers`**: (Admin & Staff) Customer company details (name, phone, address).

### 3. Catalog Module (`src/modules/products/`, `src/modules/plans/`, `src/modules/taxes/`, `src/modules/discounts/`)
* **`POST /api/products`**: Name, Type, Sales Price (paise), Cost Price (paise), Notes.
* **`POST /api/products/:id/variants`**:
  - Brand variant: e.g. **Odoo Edition adds ₹560 = 56,000 paise** (`extraPrice: 56000`).
* **`POST /api/plans`**:
  - Name, Price (paise), Billing Period (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`), `minQuantity`.
  - Admin flags: `autoClose` (boolean), `closable` (boolean), `pausable` (boolean), `renewable` (boolean).
* **`POST /api/taxes`**: Name, `rateBps` (18% = 1800, 12% = 1200, 5% = 500).
* **`POST /api/discounts`**:
  - Name, Type (`FIXED` or `PERCENT`), Value, `minPurchase`, `minQuantity`, `startDate`, `endDate`, `usageLimit`, Scope (`PRODUCT` or `SUBSCRIPTION`).

---

## ⏱️ Hour-by-Hour 6-Hour Plan
* **Hour 1 (0:00 – 1:00):** Verify Docker PostgreSQL & Mailpit running. Run `npx prisma migrate dev` and test `npm run db:seed`. Verify demo accounts login in DB.
* **Hour 2 (1:00 – 2:00):** Build Auth routes (`signup`, `login`, `me`) with Zod schemas and JWT. Test password regex.
* **Hour 3 (2:00 – 3:00):** Build Mailpit password reset flow (`forgot-password`, `reset-password`). Check Mailpit web UI on `http://localhost:8025`.
* **Hour 4 (3:00 – 4:00):** Build Products, Variants, Plans, Taxes, and Discounts CRUD.
* **Hour 5 (4:00 – 4:45):** **MERGE POINT:** Open Pull Request from `feature/identity-catalog` into `dev`. Resolve any route imports in `app.ts`.
* **Hour 6 (4:45 – 6:00):** Assist with end-to-end testing of Scene 1 (Signup/Login) and Scene 2 (Catalog setup).

---

## 🔍 Edge Cases You Must Guard Against
1. **Password Policy:** Reject 8-character passwords or passwords missing a special character with HTTP 400.
2. **Duplicate Email:** Reject duplicate signups with HTTP 409 Conflict.
3. **Role Boundary:** Ensure non-admins cannot call `POST /api/users/staff` (must return HTTP 403 Forbidden).
4. **Offline Isolation:** Ensure NO calls to external cloud auth or CDN fonts; all mail goes to Mailpit.

---

## 🎤 What You Explain to Hackathon Judges
> *"I designed our relational database schema and security core. We enforce strict password hashing with bcrypt, role-based JWT guards, and a 100% offline password reset flow using local SMTP. In the catalog, all currency is modeled in exact integer paise to prevent rounding bugs, and we implemented product variants where the Odoo Edition dynamically applies the ₹560 pricing delta."*
