/**
 * Brightloop seed.
 *
 *   npm run db:seed              -> demo accounts + catalog + 5,000 subscriptions + 20,000 invoices
 *   SEED_SIZE=small npm run db:seed  -> demo data only (fast)
 *
 * Demo logins (shown on the sign-in page):
 *   admin@brightloop.test / Admin@1234      staff@brightloop.test / Staff@1234
 *   customer@brightloop.test / Customer@1234
 *
 * Bulk customers share one password hash (Customer@1234) so seeding stays fast.
 * All money is integer paise; all tax rates are basis points.
 */
import { randomUUID } from 'node:crypto';
import { BillingPeriod, InvoiceStatus, PaymentMethod, Prisma, PrismaClient, Role, SubscriptionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const FULL = (process.env.SEED_SIZE ?? 'full') !== 'small';
const SUBSCRIPTIONS = 5_000;
const INVOICES_PER_SUBSCRIPTION = 4; // 5,000 × 4 = 20,000 invoices
const BULK_CUSTOMERS = 200;

const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const today = new Date();
const todayUtc = utcDay(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
const monthsAgo = (months: number, day = 1) => utcDay(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() - months, day);
const tax = (amount: number, bps: number) => Math.floor((amount * bps + 5_000) / 10_000);
const pad = (n: number) => n.toString().padStart(6, '0');

// Deterministic pseudo-random numbers so every seed produces the same dataset.
let state = 42;
const rand = () => ((state = (state * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648);
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];

async function chunked<T>(rows: T[], size: number, insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

async function clear() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Payment","InvoiceLine","Invoice","SubscriptionDiscount","SubscriptionLine","Subscription","QuotationTemplateLine","QuotationTemplate","DiscountProduct","Discount","ProductVariant","Product","Plan","Tax","PasswordResetToken","Customer","User","Counter" CASCADE',
  );
}

async function main() {
  const started = Date.now();
  await clear();

  // ── Accounts ──────────────────────────────────────────────────────────────
  const [adminHash, staffHash, customerHash] = await Promise.all([bcrypt.hash('Admin@1234', 10), bcrypt.hash('Staff@1234', 10), bcrypt.hash('Customer@1234', 10)]);
  await prisma.user.create({ data: { email: 'admin@brightloop.test', name: 'Aisha Admin', passwordHash: adminHash, role: Role.ADMIN } });
  await prisma.user.create({ data: { email: 'staff@brightloop.test', name: 'Sanjay Staff', passwordHash: staffHash, role: Role.STAFF } });

  const demoCustomers = [
    { email: 'customer@brightloop.test', name: 'Priya Sharma', company: 'Acme Retail Pvt Ltd', phone: '+91 98765 43210', address: '42 MG Road, Bengaluru' },
    { email: 'zenith@brightloop.test', name: 'Rahul Mehta', company: 'Zenith Tech Solutions', phone: '+91 98765 43211', address: '12 Cyber City, Gurugram' },
    { email: 'bluesky@brightloop.test', name: 'Anita Rao', company: 'BlueSky Logistics Ltd', phone: '+91 98765 43212', address: '88 Port Road, Chennai' },
    { email: 'apex@brightloop.test', name: 'Vikram Nair', company: 'Apex Healthcare Systems', phone: '+91 98765 43213', address: '15 Ring Road, Pune' },
    { email: 'horizon@brightloop.test', name: 'Meera Iyer', company: 'Horizon Media Works', phone: '+91 98765 43214', address: '7 Park Street, Kolkata' },
  ];
  const customers: { id: string; company: string }[] = [];
  for (const c of demoCustomers) {
    const user = await prisma.user.create({
      data: { email: c.email, name: c.name, passwordHash: customerHash, role: Role.CUSTOMER, customer: { create: { companyName: c.company, phone: c.phone, address: c.address } } },
      include: { customer: true },
    });
    customers.push({ id: user.customer!.id, company: c.company });
  }

  // ── Catalog ───────────────────────────────────────────────────────────────
  const gst18 = await prisma.tax.create({ data: { name: 'GST 18%', rateBps: 1800 } });
  const gst12 = await prisma.tax.create({ data: { name: 'GST 12%', rateBps: 1200 } });
  await prisma.tax.create({ data: { name: 'GST 5%', rateBps: 500 } });

  const suite = await prisma.product.create({
    data: {
      name: 'Brightloop Business Suite', type: 'SERVICE', salesPrice: 200_000, costPrice: 80_000, notes: 'Core ERP seat',
      variants: { create: [{ attribute: 'Brand', value: 'Odoo Edition', extraPrice: 56_000 }, { attribute: 'Brand', value: 'Standard Edition', extraPrice: 0 }] },
    },
    include: { variants: true },
  });
  const odoo = suite.variants.find((v) => v.value === 'Odoo Edition')!;
  const crm = await prisma.product.create({ data: { name: 'Brightloop CRM Add-on', type: 'SERVICE', salesPrice: 50_000, costPrice: 10_000 } });
  const storage = await prisma.product.create({ data: { name: 'Cloud Storage 100 GB', type: 'SERVICE', salesPrice: 25_000, costPrice: 5_000 } });
  await prisma.product.create({ data: { name: 'Onboarding Workshop', type: 'SERVICE', salesPrice: 1_500_000, costPrice: 400_000, active: false, notes: 'Retired' } });

  const monthly = await prisma.plan.create({
    data: { name: 'Standard Monthly', price: 250_000, billingPeriod: BillingPeriod.MONTHLY, minQuantity: 1, startDate: utcDay(2024, 0, 1), pausable: true, renewable: true, closable: true },
  });
  const yearly = await prisma.plan.create({
    data: { name: 'Enterprise Annual', price: 2_500_000, billingPeriod: BillingPeriod.YEARLY, minQuantity: 5, startDate: utcDay(2024, 0, 1), pausable: false, renewable: true, closable: false, autoClose: true },
  });
  await prisma.plan.create({ data: { name: 'Weekly Starter', price: 60_000, billingPeriod: BillingPeriod.WEEKLY, startDate: utcDay(2024, 0, 1), pausable: true } });

  const launch = await prisma.discount.create({
    data: {
      name: 'Odoo launch ₹500 off', type: 'FIXED', value: 50_000, scope: 'PRODUCT', startDate: monthsAgo(6), endDate: monthsAgo(-6), usageLimit: 1_000,
      products: { create: [{ productId: suite.id }] },
    },
  });
  const loyalty = await prisma.discount.create({ data: { name: 'Loyalty 10%', type: 'PERCENT', value: 1_000, scope: 'SUBSCRIPTION', minPurchase: 100_000, startDate: monthsAgo(12), endDate: monthsAgo(-12) } });

  await prisma.quotationTemplate.create({
    data: { name: 'Starter Business Quote', planId: monthly.id, validityDays: 14, lines: { create: [{ productId: suite.id, variantId: odoo.id, quantity: 2 }, { productId: crm.id, quantity: 2 }] } },
  });
  await prisma.quotationTemplate.create({ data: { name: 'Enterprise Rollout', planId: yearly.id, validityDays: 30, lines: { create: [{ productId: suite.id, variantId: odoo.id, quantity: 10 }] } } });

  // ── Subscriptions and invoices ───────────────────────────────────────────
  type LineSpec = { productId: string; variantId: string | null; quantity: number; unitPrice: number; taxId: string; rateBps: number; name: string };
  const lineOptions: Array<() => LineSpec[]> = [
    () => [{ productId: suite.id, variantId: odoo.id, quantity: 1 + Math.floor(rand() * 4), unitPrice: 256_000, taxId: gst18.id, rateBps: 1800, name: 'Brightloop Business Suite (Brand: Odoo Edition)' }],
    () => [{ productId: crm.id, variantId: null, quantity: 1 + Math.floor(rand() * 10), unitPrice: 50_000, taxId: gst18.id, rateBps: 1800, name: 'Brightloop CRM Add-on' }],
    () => [
      { productId: suite.id, variantId: null, quantity: 2, unitPrice: 200_000, taxId: gst18.id, rateBps: 1800, name: 'Brightloop Business Suite' },
      { productId: storage.id, variantId: null, quantity: 1, unitPrice: 25_000, taxId: gst12.id, rateBps: 1200, name: 'Cloud Storage 100 GB' },
    ],
  ];

  const subRows: Prisma.SubscriptionCreateManyInput[] = [];
  const subLineRows: Prisma.SubscriptionLineCreateManyInput[] = [];
  const invoiceRows: Prisma.InvoiceCreateManyInput[] = [];
  const invoiceLineRows: Prisma.InvoiceLineCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  let subNo = 0;
  let invNo = 0;

  function addSubscription(customer: { id: string; company: string }, opts: { status: SubscriptionStatus; invoices: number; paidInvoices: number; startMonthsAgo: number; nextDue?: Date; lines?: LineSpec[]; pausedAt?: Date }) {
    subNo += 1;
    const id = randomUUID();
    const startDate = monthsAgo(opts.startMonthsAgo, 1 + Math.floor(rand() * 27));
    const lines = opts.lines ?? pick(lineOptions)();
    const isLive = opts.status === 'ACTIVE';
    const nextInvoiceDate = isLive ? opts.nextDue ?? utcDay(startDate.getUTCFullYear(), startDate.getUTCMonth() + opts.invoices, startDate.getUTCDate()) : null;
    subRows.push({
      id, number: `SUB-${pad(subNo)}`, customerId: customer.id, planId: monthly.id, status: opts.status, startDate, paymentTermDays: 15,
      nextInvoiceDate, pausedAt: opts.pausedAt ?? null, createdAt: addDays(startDate, -3),
      quotationExpiryDate: opts.status === 'QUOTATION' ? addDays(todayUtc, 14) : null,
    });
    for (const l of lines) subLineRows.push({ id: randomUUID(), subscriptionId: id, productId: l.productId, variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice, taxId: l.taxId, amount: l.quantity * l.unitPrice });

    for (let k = 0; k < opts.invoices; k += 1) {
      invNo += 1;
      const invoiceId = randomUUID();
      const periodStart = utcDay(startDate.getUTCFullYear(), startDate.getUTCMonth() + k, startDate.getUTCDate());
      const periodEnd = addDays(utcDay(startDate.getUTCFullYear(), startDate.getUTCMonth() + k + 1, startDate.getUTCDate()), -1);
      const priced = lines.map((l) => {
        const gross = l.quantity * l.unitPrice;
        const taxAmount = tax(gross, l.rateBps);
        return { ...l, gross, taxAmount, amount: gross + taxAmount };
      });
      const subtotal = priced.reduce((s, l) => s + l.gross, 0) + monthly.price;
      const taxTotal = priced.reduce((s, l) => s + l.taxAmount, 0);
      const total = subtotal + taxTotal;
      const paid = k < opts.paidInvoices;
      const status: InvoiceStatus = paid ? 'PAID' : k === opts.invoices - 1 && rand() < 0.15 ? 'DRAFT' : 'CONFIRMED';
      invoiceRows.push({
        id: invoiceId, number: `INV-${pad(invNo)}`, subscriptionId: id, customerId: customer.id, customerName: customer.company,
        periodStart, periodEnd, status, subtotal, discountTotal: 0, taxTotal, total, amountPaid: paid ? total : 0,
        issueDate: periodStart, dueDate: addDays(periodStart, 15),
      });
      for (const l of priced) invoiceLineRows.push({ id: randomUUID(), invoiceId, productId: l.productId, description: l.name, quantity: l.quantity, unitPrice: l.unitPrice, taxRateBps: l.rateBps, taxAmount: l.taxAmount, amount: l.amount });
      invoiceLineRows.push({ id: randomUUID(), invoiceId, productId: null, description: `Plan: ${monthly.name} (Recurring Base Fee)`, quantity: 1, unitPrice: monthly.price, amount: monthly.price });
      if (paid) paymentRows.push({ id: randomUUID(), invoiceId, method: pick(['UPI', 'CARD', 'BANK_TRANSFER', 'CASH', 'CHEQUE'] as PaymentMethod[]), amount: total, paidOn: addDays(periodStart, 1 + Math.floor(rand() * 14)) });
    }
    return id;
  }

  // Demo story for the walkthrough (customer@brightloop.test = Acme Retail).
  const acme = customers[0];
  // 1) Active subscription with history: two paid, one confirmed (overdue), one confirmed (current).
  addSubscription(acme, { status: 'ACTIVE', invoices: 4, paidInvoices: 2, startMonthsAgo: 4, lines: [lineOptions[0]()[0], { productId: crm.id, variantId: null, quantity: 3, unitPrice: 50_000, taxId: gst18.id, rateBps: 1800, name: 'Brightloop CRM Add-on' }] });
  // 2) Active subscription due today -> "Run billing" creates its invoice live.
  addSubscription(acme, { status: 'ACTIVE', invoices: 0, paidInvoices: 0, startMonthsAgo: 0, nextDue: todayUtc, lines: [{ productId: suite.id, variantId: odoo.id, quantity: 2, unitPrice: 256_000, taxId: gst18.id, rateBps: 1800, name: 'Brightloop Business Suite (Brand: Odoo Edition)' }] });
  // 3) A confirmed subscription waiting to be activated and a quotation awaiting approval.
  addSubscription(customers[1], { status: 'CONFIRMED', invoices: 0, paidInvoices: 0, startMonthsAgo: 0 });
  addSubscription(customers[2], { status: 'QUOTATION', invoices: 0, paidInvoices: 0, startMonthsAgo: 0 });
  addSubscription(customers[3], { status: 'DRAFT', invoices: 0, paidInvoices: 0, startMonthsAgo: 0 });
  // 4) A paused subscription for the pause/resume demo.
  addSubscription(customers[4], { status: 'ACTIVE', invoices: 2, paidInvoices: 2, startMonthsAgo: 2, pausedAt: addDays(todayUtc, -5) });
  const demoSubIds = subRows.map((s) => s.id!);

  if (FULL) {
    // Bulk customers share one hash for speed.
    const bulkUsers: Prisma.UserCreateManyInput[] = [];
    const bulkCustomers: Prisma.CustomerCreateManyInput[] = [];
    for (let i = 1; i <= BULK_CUSTOMERS; i += 1) {
      const userId = randomUUID();
      const customerId = randomUUID();
      const company = `${pick(['Nova', 'Sunrise', 'Indus', 'Lotus', 'Peak', 'Delta', 'Coral', 'Vertex'])} ${pick(['Traders', 'Foods', 'Labs', 'Textiles', 'Motors', 'Pharma', 'Studios', 'Exports'])} ${i}`;
      bulkUsers.push({ id: userId, email: `client${i}@brightloop.test`, name: `Client ${i}`, passwordHash: customerHash, role: Role.CUSTOMER });
      bulkCustomers.push({ id: customerId, userId, companyName: company, phone: `+91 90000 ${pad(i).slice(1)}`, address: `${i} Industrial Area, Kochi` });
      customers.push({ id: customerId, company });
    }
    await prisma.user.createMany({ data: bulkUsers });
    await prisma.customer.createMany({ data: bulkCustomers });

    // Bulk subscriptions carry 4 invoices (a few carry 5) so totals land exactly on 20,000.
    const remainingSubs = SUBSCRIPTIONS - subRows.length;
    const missingInvoices = SUBSCRIPTIONS * INVOICES_PER_SUBSCRIPTION - invoiceRows.length;
    for (let i = 0; i < remainingSubs; i += 1) {
      const invoices = i < missingInvoices - remainingSubs * INVOICES_PER_SUBSCRIPTION ? INVOICES_PER_SUBSCRIPTION + 1 : INVOICES_PER_SUBSCRIPTION;
      const r = rand();
      const status: SubscriptionStatus = r < 0.8 ? 'ACTIVE' : 'CLOSED';
      const paidInvoices = Math.max(0, invoices - (rand() < 0.35 ? 1 + Math.floor(rand() * 2) : 0));
      // Bulk cursors sit in the future so a demo "Run billing" stays quick.
      addSubscription(pick(customers.slice(5)), { status, invoices, paidInvoices, startMonthsAgo: invoices + Math.floor(rand() * 8), nextDue: status === 'ACTIVE' ? addDays(todayUtc, 1 + Math.floor(rand() * 27)) : undefined });
    }
  }

  await chunked(subRows, 1_000, (data) => prisma.subscription.createMany({ data }));
  await chunked(subLineRows, 2_000, (data) => prisma.subscriptionLine.createMany({ data }));
  await chunked(invoiceRows, 2_000, (data) => prisma.invoice.createMany({ data }));
  await chunked(invoiceLineRows, 5_000, (data) => prisma.invoiceLine.createMany({ data }));
  await chunked(paymentRows, 5_000, (data) => prisma.payment.createMany({ data }));
  await prisma.subscriptionDiscount.create({ data: { subscriptionId: demoSubIds[1], discountId: loyalty.id } });
  void launch;

  await prisma.counter.createMany({ data: [{ key: 'subscription', value: subNo }, { key: 'invoice', value: invNo }] });
  await prisma.$executeRawUnsafe('ANALYZE');

  const [subs, invoices, payments, users] = await Promise.all([prisma.subscription.count(), prisma.invoice.count(), prisma.payment.count(), prisma.user.count()]);
  console.log(`Seed complete in ${((Date.now() - started) / 1000).toFixed(1)}s: ${users} users, ${subs} subscriptions, ${invoices} invoices, ${payments} payments.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
