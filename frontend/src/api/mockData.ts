/**
 * In-memory fallback and seed data for Brightloop Subscription Engine
 * Matches backend/prisma/seed.ts exactly.
 * Guarantees zero blank screens while backend endpoints are merged.
 */

export interface ProductVariant {
  id: string;
  productId: string;
  attribute: string;
  value: string;
  extraPrice: number; // in paise
}

export interface Product {
  id: string;
  name: string;
  type: string;
  salesPrice: number; // in paise
  costPrice: number;  // in paise
  notes?: string;
  active: boolean;
  variants: ProductVariant[];
}

export interface Plan {
  id: string;
  name: string;
  price: number; // in paise
  billingPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  minQuantity: number;
  startDate: string;
  endDate?: string;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
}

export interface Tax {
  id: string;
  name: string;
  rateBps: number; // in basis points (1800 = 18%)
  active: boolean;
}

export interface Discount {
  id: string;
  name: string;
  type: 'FIXED' | 'PERCENT';
  value: number; // paise or bps
  minPurchase?: number;
  minQuantity?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  timesUsed: number;
  scope: 'PRODUCT' | 'SUBSCRIPTION';
}

export interface SubscriptionLine {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number; // in paise
  taxRateBps: number;
  amount: number; // in paise
}

export interface Subscription {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  planId: string;
  planName: string;
  status: 'DRAFT' | 'QUOTATION' | 'CONFIRMED' | 'ACTIVE' | 'CLOSED';
  startDate: string;
  expiryDate?: string;
  quotationExpiryDate?: string;
  paymentTermDays: number;
  nextInvoiceDate?: string;
  pausedAt?: string;
  lines: SubscriptionLine[];
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRateBps: number;
  taxAmount: number;
  amount: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  method: 'UPI' | 'CARD' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  amount: number; // in paise
  paidOn: string;
  note?: string;
}

export interface Invoice {
  id: string;
  number: string;
  subscriptionId: string;
  subscriptionNumber: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerEmail: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  payments: Payment[];
}

// Initial In-Memory State
export const initialProducts: Product[] = [
  {
    id: 'prod-1',
    name: 'Brightloop Business Suite',
    type: 'SOFTWARE',
    salesPrice: 200000, // ₹2,000.00
    costPrice: 80000,
    notes: 'Flagship enterprise subscription package',
    active: true,
    variants: [
      {
        id: 'var-1',
        productId: 'prod-1',
        attribute: 'Brand',
        value: 'Odoo Edition',
        extraPrice: 56000, // +₹560.00 (56,000 paise)
      },
      {
        id: 'var-2',
        productId: 'prod-1',
        attribute: 'Brand',
        value: 'Standard Edition',
        extraPrice: 0,
      },
    ],
  },
  {
    id: 'prod-2',
    name: 'Brightloop CRM Add-on',
    type: 'ADD_ON',
    salesPrice: 50000, // ₹500.00
    costPrice: 20000,
    notes: 'Customer relation & lead pipeline module',
    active: true,
    variants: [],
  },
  {
    id: 'prod-3',
    name: 'Cloud Storage 500GB',
    type: 'STORAGE',
    salesPrice: 120000, // ₹1,200.00
    costPrice: 40000,
    notes: 'Encrypted S3-compatible cloud storage bundle',
    active: true,
    variants: [],
  },
];

export const initialPlans: Plan[] = [
  {
    id: 'plan-1',
    name: 'Standard Monthly Plan',
    price: 250000, // ₹2,500.00
    billingPeriod: 'MONTHLY',
    minQuantity: 1,
    startDate: '2026-01-01',
    closable: true,
    pausable: true,
    renewable: true,
    autoClose: false,
  },
  {
    id: 'plan-2',
    name: 'Enterprise Annual Contract',
    price: 2500000, // ₹25,000.00
    billingPeriod: 'YEARLY',
    minQuantity: 5,
    startDate: '2026-01-01',
    closable: true,
    pausable: false,
    renewable: true,
    autoClose: true,
  },
];

export const initialDiscounts: Discount[] = [
  {
    id: 'disc-1',
    name: 'High Volume Seats Discount',
    type: 'PERCENT',
    value: 1000, // 10.00% (1,000 bps)
    minQuantity: 5,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    usageLimit: 100,
    timesUsed: 14,
    scope: 'SUBSCRIPTION',
  },
  {
    id: 'disc-2',
    name: 'Welcome ₹500 Off',
    type: 'FIXED',
    value: 50000, // ₹500.00
    minPurchase: 100000, // ₹1,000.00
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    usageLimit: 50,
    timesUsed: 22,
    scope: 'PRODUCT',
  },
];

export const initialSubscriptions: Subscription[] = [
  {
    id: 'sub-101',
    number: 'SUB-2026-0101',
    customerId: 'cust-1',
    customerName: 'Acme Retail Pvt Ltd',
    customerEmail: 'customer@brightloop.test',
    planId: 'plan-1',
    planName: 'Standard Monthly Plan',
    status: 'ACTIVE',
    startDate: '2026-02-01',
    nextInvoiceDate: '2026-11-01',
    paymentTermDays: 15,
    lines: [
      {
        id: 'sline-1',
        productId: 'prod-1',
        productName: 'Brightloop Business Suite (Odoo Edition)',
        variantId: 'var-1',
        variantName: 'Odoo Edition (+₹560)',
        quantity: 2,
        unitPrice: 256000, // ₹2,560.00
        taxRateBps: 1800,
        amount: 512000, // ₹5,120.00
      },
      {
        id: 'sline-2',
        productId: 'prod-2',
        productName: 'Brightloop CRM Add-on',
        quantity: 1,
        unitPrice: 50000,
        taxRateBps: 1800,
        amount: 50000,
      },
    ],
  },
  {
    id: 'sub-102',
    number: 'SUB-2026-0102',
    customerId: 'cust-2',
    customerName: 'Globex Logistics Corp',
    customerEmail: 'ops@globex.test',
    planId: 'plan-2',
    planName: 'Enterprise Annual Contract',
    status: 'QUOTATION',
    startDate: '2026-11-01',
    quotationExpiryDate: '2026-11-15',
    paymentTermDays: 30,
    lines: [
      {
        id: 'sline-3',
        productId: 'prod-1',
        productName: 'Brightloop Business Suite',
        quantity: 5,
        unitPrice: 200000,
        taxRateBps: 1800,
        amount: 1000000,
      },
    ],
  },
  {
    id: 'sub-103',
    number: 'SUB-2026-0103',
    customerId: 'cust-1',
    customerName: 'Acme Retail Pvt Ltd',
    customerEmail: 'customer@brightloop.test',
    planId: 'plan-1',
    planName: 'Standard Monthly Plan',
    status: 'DRAFT',
    startDate: '2026-11-05',
    paymentTermDays: 14,
    lines: [
      {
        id: 'sline-4',
        productId: 'prod-3',
        productName: 'Cloud Storage 500GB',
        quantity: 2,
        unitPrice: 120000,
        taxRateBps: 1800,
        amount: 240000,
      },
    ],
  },
  {
    id: 'sub-104',
    number: 'SUB-2026-0104',
    customerId: 'cust-3',
    customerName: 'Initech Software Labs',
    customerEmail: 'billing@initech.test',
    planId: 'plan-1',
    planName: 'Standard Monthly Plan',
    status: 'CONFIRMED',
    startDate: '2026-10-15',
    paymentTermDays: 15,
    lines: [
      {
        id: 'sline-5',
        productId: 'prod-1',
        productName: 'Brightloop Business Suite',
        quantity: 1,
        unitPrice: 200000,
        taxRateBps: 1800,
        amount: 200000,
      },
    ],
  },
];

export const initialInvoices: Invoice[] = [
  {
    id: 'inv-101',
    number: 'INV-2026-0101',
    subscriptionId: 'sub-101',
    subscriptionNumber: 'SUB-2026-0101',
    customerId: 'cust-1',
    customerName: 'Acme Retail Pvt Ltd',
    customerAddress: '42 MG Road, Bengaluru, Karnataka 560001',
    customerEmail: 'customer@brightloop.test',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    status: 'PAID',
    subtotal: 562000,      // ₹5,620.00
    discountTotal: 50000,  // -₹500.00
    taxTotal: 92160,       // ₹921.60 (18%)
    total: 604160,         // ₹6,041.60
    amountPaid: 604160,    // Fully Paid
    issueDate: '2026-10-01',
    dueDate: '2026-10-15',
    lines: [
      {
        id: 'iline-1',
        description: 'Brightloop Business Suite (Odoo Edition) x 2',
        quantity: 2,
        unitPrice: 256000,
        discountAmount: 50000,
        taxRateBps: 1800,
        taxAmount: 83160,
        amount: 512000,
      },
      {
        id: 'iline-2',
        description: 'Brightloop CRM Add-on x 1',
        quantity: 1,
        unitPrice: 50000,
        discountAmount: 0,
        taxRateBps: 1800,
        taxAmount: 9000,
        amount: 50000,
      },
    ],
    payments: [
      {
        id: 'pay-1',
        invoiceId: 'inv-101',
        method: 'UPI',
        amount: 604160,
        paidOn: '2026-10-03T11:30:00Z',
        note: 'UPI Reference #982348123',
      },
    ],
  },
  {
    id: 'inv-102',
    number: 'INV-2026-0102',
    subscriptionId: 'sub-104',
    subscriptionNumber: 'SUB-2026-0104',
    customerId: 'cust-3',
    customerName: 'Initech Software Labs',
    customerAddress: '7 Hitec City, Hyderabad, Telangana 500081',
    customerEmail: 'billing@initech.test',
    periodStart: '2026-10-15',
    periodEnd: '2026-11-14',
    status: 'CONFIRMED',
    subtotal: 200000,
    discountTotal: 0,
    taxTotal: 36000, // 18%
    total: 236000,   // ₹2,360.00
    amountPaid: 0,   // Unpaid
    issueDate: '2026-10-15',
    dueDate: '2026-11-15',
    lines: [
      {
        id: 'iline-3',
        description: 'Brightloop Business Suite x 1',
        quantity: 1,
        unitPrice: 200000,
        discountAmount: 0,
        taxRateBps: 1800,
        taxAmount: 36000,
        amount: 200000,
      },
    ],
    payments: [],
  },
  {
    id: 'inv-103',
    number: 'INV-2026-0103',
    subscriptionId: 'sub-101',
    subscriptionNumber: 'SUB-2026-0101',
    customerId: 'cust-1',
    customerName: 'Acme Retail Pvt Ltd',
    customerAddress: '42 MG Road, Bengaluru, Karnataka 560001',
    customerEmail: 'customer@brightloop.test',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    status: 'CONFIRMED', // Overdue because dueDate < now and amountPaid < total
    subtotal: 300000,
    discountTotal: 0,
    taxTotal: 54000,
    total: 354000, // ₹3,540.00
    amountPaid: 100000, // Partially paid ₹1,000.00, remaining ₹2,540.00
    issueDate: '2026-09-01',
    dueDate: '2026-09-15', // Overdue!
    lines: [
      {
        id: 'iline-4',
        description: 'Odoo Edition Custom Module x 1',
        quantity: 1,
        unitPrice: 300000,
        discountAmount: 0,
        taxRateBps: 1800,
        taxAmount: 54000,
        amount: 300000,
      },
    ],
    payments: [
      {
        id: 'pay-2',
        invoiceId: 'inv-103',
        method: 'BANK_TRANSFER',
        amount: 100000,
        paidOn: '2026-09-10T09:00:00Z',
        note: 'Partial Advance Payment',
      },
    ],
  },
];
