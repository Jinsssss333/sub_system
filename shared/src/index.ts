/**
 * Shared validation contracts for Brightloop.
 *
 * The frontend uses these schemas for instant form feedback. The backend parses
 * every request with the same schemas and remains the real enforcement point.
 *
 * Money is always integer paise (₹1 = 100 paise). Rates are integer basis points
 * (1% = 100 bps). Limits below keep every invoice total inside PostgreSQL Int
 * (2,147,483,647): 10 lines × ₹10,00,000 × 2 (100% tax) + ₹10,00,000 plan fee.
 */
import { z } from 'zod';

export const LIMITS = {
  /** Maximum amount for a single line (quantity × unit price): ₹10,00,000.00 */
  MAX_LINE_AMOUNT_PAISE: 100_000_000,
  /** Maximum unit price / plan price / fixed discount: ₹10,00,000.00 */
  MAX_PRICE_PAISE: 100_000_000,
  MAX_QUANTITY: 10_000,
  MAX_LINES: 10,
  MAX_RATE_BPS: 10_000,
  MAX_PAGE_SIZE: 100,
} as const;

export const ROLES = ['ADMIN', 'STAFF', 'CUSTOMER'] as const;
export const BILLING_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export const SUBSCRIPTION_STATUSES = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'] as const;
export const INVOICE_STATUSES = ['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'] as const;
export const DISCOUNT_TYPES = ['FIXED', 'PERCENT'] as const;
export const DISCOUNT_SCOPES = ['PRODUCT', 'SUBSCRIPTION'] as const;
export const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] as const;

export type Role = (typeof ROLES)[number];
export type BillingPeriod = (typeof BILLING_PERIODS)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;
export const PASSWORD_MESSAGE =
  'Password must be more than 8 characters and include an uppercase letter, a lowercase letter and a special character';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Use a YYYY-MM-DD date')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');

const uuid = (label: string) => z.string().uuid(`${label} is required`);
const text = (label: string, max = 200) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, 'Too long')
    .optional()
    .transform((value) => (value === '' ? undefined : value));
const paise = (label: string, max: number = LIMITS.MAX_PRICE_PAISE) =>
  z.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be whole paise`).min(0, `${label} cannot be negative`).max(max, `${label} exceeds the maximum`);
const bps = (label: string) =>
  z.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be whole basis points`).min(0, `${label} cannot be negative`).max(LIMITS.MAX_RATE_BPS, `${label} cannot exceed 100%`);

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
export const passwordSchema = z.string().max(128, 'Password is too long').regex(PASSWORD_RULE, PASSWORD_MESSAGE);

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.MAX_PAGE_SIZE).default(20),
  q: z.string().trim().max(100).optional(),
});

// ── Identity ───────────────────────────────────────────────────────────────
export const loginBody = z.object({ email: emailSchema, password: z.string().min(1, 'Password is required').max(128) }).strict();
export const signupBody = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: text('Name', 100),
    companyName: optionalText(200),
    phone: optionalText(30),
    address: optionalText(500),
  })
  .strict();
export const forgotPasswordBody = z.object({ email: emailSchema }).strict();
export const resetPasswordBody = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'Reset link is invalid'), password: passwordSchema }).strict();
export const createStaffBody = z.object({ email: emailSchema, password: passwordSchema, name: text('Name', 100) }).strict();
export const customerBody = z
  .object({
    email: emailSchema,
    name: text('Name', 100),
    password: passwordSchema.optional(),
    companyName: optionalText(200),
    phone: optionalText(30),
    address: optionalText(500),
  })
  .strict();

// ── Catalog ────────────────────────────────────────────────────────────────
export const productBody = z
  .object({
    name: text('Name'),
    type: text('Type', 50),
    salesPrice: paise('Sales price'),
    costPrice: paise('Cost price'),
    notes: optionalText(1000),
    active: z.boolean().optional().default(true),
  })
  .strict();
export const variantBody = z
  .object({ attribute: text('Attribute', 50), value: text('Value', 100), extraPrice: paise('Extra price').default(0) })
  .strict();
export const planBody = z
  .object({
    name: text('Name'),
    price: paise('Plan price'),
    billingPeriod: z.enum(BILLING_PERIODS),
    minQuantity: z.number().int().min(1).max(LIMITS.MAX_QUANTITY).default(1),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    autoClose: z.boolean().default(false),
    closable: z.boolean().default(true),
    pausable: z.boolean().default(false),
    renewable: z.boolean().default(true),
  })
  .strict()
  .refine((plan) => !plan.endDate || new Date(plan.endDate) >= new Date(plan.startDate), { message: 'End date must be on or after the start date', path: ['endDate'] });
export const taxBody = z.object({ name: text('Name', 100), rateBps: bps('Tax rate'), active: z.boolean().optional().default(true) }).strict();
export const discountBody = z
  .object({
    name: text('Name'),
    type: z.enum(DISCOUNT_TYPES),
    value: z.number().int().min(1, 'Value must be positive'),
    scope: z.enum(DISCOUNT_SCOPES),
    minPurchase: paise('Minimum purchase').nullable().optional(),
    minQuantity: z.number().int().min(1).max(LIMITS.MAX_QUANTITY).nullable().optional(),
    startDate: isoDate,
    endDate: isoDate,
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    productIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .strict()
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), { message: 'End date must be on or after the start date', path: ['endDate'] })
  .refine((d) => (d.type === 'PERCENT' ? d.value <= LIMITS.MAX_RATE_BPS : d.value <= LIMITS.MAX_PRICE_PAISE), {
    message: 'Percent discounts are basis points (max 10000); fixed discounts are paise (max ₹10,00,000)',
    path: ['value'],
  })
  .refine((d) => d.scope === 'SUBSCRIPTION' || d.productIds.length > 0, { message: 'Product discounts need at least one product', path: ['productIds'] });

export const templateLineBody = z.object({ productId: uuid('Product'), variantId: z.string().uuid().nullable().optional(), quantity: z.number().int().min(1).max(LIMITS.MAX_QUANTITY) });
export const templateBody = z
  .object({ name: text('Name'), planId: uuid('Plan'), validityDays: z.number().int().min(1).max(365), lines: z.array(templateLineBody).min(1, 'Add at least one line').max(LIMITS.MAX_LINES) })
  .strict();

// ── Subscriptions ──────────────────────────────────────────────────────────
/** Unit prices are never accepted from clients; the server prices every line from the catalog. */
export const subscriptionLineBody = z
  .object({
    productId: uuid('Product'),
    variantId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(LIMITS.MAX_QUANTITY),
    taxId: z.string().uuid().nullable().optional(),
  })
  .strict();
export const createSubscriptionBody = z
  .object({
    customerId: uuid('Customer'),
    templateId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    startDate: isoDate.optional(),
    expiryDate: isoDate.nullable().optional(),
    quotationExpiryDate: isoDate.nullable().optional(),
    paymentTermDays: z.number().int().min(0).max(365).default(0),
    lines: z.array(subscriptionLineBody).max(LIMITS.MAX_LINES).optional(),
    discountIds: z.array(z.string().uuid()).max(10).optional(),
  })
  .strict()
  .refine((data) => data.templateId || (data.planId && data.lines && data.lines.length > 0), {
    message: 'Choose a template, or a plan with at least one line',
    path: ['planId'],
  });
export const updateSubscriptionBody = z
  .object({
    planId: z.string().uuid().optional(),
    startDate: isoDate.optional(),
    expiryDate: isoDate.nullable().optional(),
    quotationExpiryDate: isoDate.nullable().optional(),
    paymentTermDays: z.number().int().min(0).max(365).optional(),
    lines: z.array(subscriptionLineBody).min(1).max(LIMITS.MAX_LINES).optional(),
    discountIds: z.array(z.string().uuid()).max(10).optional(),
  })
  .strict();
export const transitionBody = z.object({ to: z.enum(SUBSCRIPTION_STATUSES) }).strict();

// ── Collection ─────────────────────────────────────────────────────────────
export const paymentBody = z
  .object({
    method: z.enum(PAYMENT_METHODS),
    amount: z.number({ invalid_type_error: 'Amount must be a number' }).int('Amount must be whole paise').positive('Amount must be positive').max(2_147_483_647),
    paidOn: isoDate,
    note: optionalText(1000),
  })
  .strict();

export type LoginBody = z.infer<typeof loginBody>;
export type SignupBody = z.infer<typeof signupBody>;
export type ProductBody = z.infer<typeof productBody>;
export type PlanBody = z.infer<typeof planBody>;
export type TaxBody = z.infer<typeof taxBody>;
export type DiscountBody = z.infer<typeof discountBody>;
export type CreateSubscriptionBody = z.infer<typeof createSubscriptionBody>;
export type PaymentBody = z.infer<typeof paymentBody>;

/** Convert a rupee string such as "1,499.50" to integer paise without floating-point drift. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

export function formatINR(paiseValue: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paiseValue / 100);
}
