import type { BillingPeriod, InvoiceStatus, PaymentMethod, Role, SubscriptionStatus } from '@brightloop/shared';

export type { BillingPeriod, InvoiceStatus, PaymentMethod, Role, SubscriptionStatus };

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  customerId?: string;
  customer?: { id: string; companyName: string | null; phone: string | null; address: string | null } | null;
}

export interface Customer {
  id: string;
  companyName: string | null;
  phone: string | null;
  address: string | null;
  user: { id: string; name: string; email: string };
}

export interface Variant { id: string; productId: string; attribute: string; value: string; extraPrice: number }
export interface Product { id: string; name: string; type: string; salesPrice: number; costPrice: number; notes: string | null; active: boolean; variants?: Variant[] }
export interface Plan {
  id: string; name: string; price: number; billingPeriod: BillingPeriod; minQuantity: number; startDate: string; endDate: string | null;
  autoClose: boolean; closable: boolean; pausable: boolean; renewable: boolean;
}
export interface Tax { id: string; name: string; rateBps: number; active: boolean }
export interface Discount {
  id: string; name: string; type: 'FIXED' | 'PERCENT'; value: number; scope: 'PRODUCT' | 'SUBSCRIPTION'; minPurchase: number | null; minQuantity: number | null;
  startDate: string; endDate: string; usageLimit: number | null; timesUsed: number; products: Array<{ product: { id: string; name: string } }>;
}
export interface Template {
  id: string; name: string; validityDays: number; planId: string; plan: Plan;
  lines: Array<{ id: string; quantity: number; product: Product; variant: Variant | null }>;
}

export interface SubscriptionLine { id: string; productId: string; variantId: string | null; quantity: number; unitPrice: number; amount: number; taxId: string | null; product: Product; variant: Variant | null; tax: Tax | null }
export interface Subscription {
  id: string; number: string; status: SubscriptionStatus; startDate: string; expiryDate: string | null; quotationExpiryDate: string | null;
  paymentTermDays: number; nextInvoiceDate: string | null; pausedAt: string | null; renewedFromId: string | null; createdAt: string;
  customer: Customer & { user: { id: string; name: string; email: string } };
  plan: Plan;
  lines: SubscriptionLine[];
  discounts: Array<{ discount: Discount }>;
  renewedFrom?: { id: string; number: string; status: SubscriptionStatus } | null;
  renewals?: Array<{ id: string; number: string; status: SubscriptionStatus }>;
}

export interface InvoiceLine { id: string; productId: string | null; description: string; quantity: number; unitPrice: number; discountAmount: number; taxRateBps: number; taxAmount: number; amount: number }
export interface Payment { id: string; invoiceId: string; method: PaymentMethod; amount: number; paidOn: string; note: string | null; createdAt: string }
export interface Invoice {
  id: string; number: string; subscriptionId: string; customerId: string; customerName: string | null; status: InvoiceStatus;
  periodStart: string; periodEnd: string; subtotal: number; discountTotal: number; taxTotal: number; total: number; amountPaid: number;
  issueDate: string; dueDate: string;
  customer?: { id: string; companyName: string | null; user?: { name: string; email: string } };
  subscription?: { id?: string; number: string; plan?: { name: string; billingPeriod: BillingPeriod } };
  lines?: InvoiceLine[];
  payments?: Payment[];
}
export interface LedgerPayment extends Payment { invoice: { id: string; number: string; customerName: string | null; total: number; status: InvoiceStatus } }

export interface Summary {
  activeSubscriptions: number; revenueCollected: number; outstanding: number; overdueCount: number; overdueAmount: number; pausedSubscriptions: number;
  subscriptionsByStatus: Partial<Record<SubscriptionStatus, number>>; monthlyRevenue: Array<{ month: string; collected: number }>;
}
export interface BillingRun { attempted: number; generated: number; closed: number; failures: Array<{ subscriptionId: string; message: string }>; durationMs: number; alreadyRunning: boolean }
