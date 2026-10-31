import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/db.js';
import { generateInvoice } from '../src/modules/invoices/invoices.service.js';
import { runBilling } from '../src/jobs/billing.job.js';
import { resetDb, seedActors, seedCatalog } from './helpers.js';

afterAll(() => prisma.$disconnect());

let actors: Awaited<ReturnType<typeof seedActors>>;
let catalog: Awaited<ReturnType<typeof seedCatalog>>;
beforeEach(async () => {
  await resetDb();
  actors = await seedActors();
  catalog = await seedCatalog();
});

let counter = 0;
async function activeSubscription(opts: { startDate?: string; quantity?: number; planId?: string; expiryDate?: string; discountIds?: string[]; customerId?: string } = {}) {
  counter += 1;
  const quantity = opts.quantity ?? 2;
  const unitPrice = catalog.product.salesPrice + catalog.variant.extraPrice;
  const start = new Date(opts.startDate ?? '2026-01-31');
  return prisma.subscription.create({
    data: {
      number: `SUB-T${counter}`,
      customerId: opts.customerId ?? actors.customer.customer!.id,
      planId: opts.planId ?? catalog.plan.id,
      status: 'ACTIVE',
      startDate: start,
      nextInvoiceDate: start,
      expiryDate: opts.expiryDate ? new Date(opts.expiryDate) : null,
      paymentTermDays: 15,
      lines: { create: [{ productId: catalog.product.id, variantId: catalog.variant.id, quantity, unitPrice, amount: quantity * unitPrice, taxId: catalog.tax.id }] },
      discounts: { create: (opts.discountIds ?? []).map((discountId) => ({ discountId })) },
    },
  });
}

describe('invoice generation', () => {
  it('snapshots priced lines plus an untaxed plan base-fee line and advances the cursor', async () => {
    const sub = await activeSubscription();
    const outcome = await generateInvoice(sub.id, undefined, new Date('2026-02-01'));
    expect(outcome.status).toBe('created');
    const invoice = outcome.invoice!;
    // Product line: 2 × ₹1,560 = ₹3,120, 18% GST = ₹561.60; plan fee ₹500 untaxed.
    expect(invoice).toMatchObject({ subtotal: 362_000, discountTotal: 0, taxTotal: 56_160, total: 418_160, status: 'DRAFT' });
    expect(invoice.number).toMatch(/^INV-\d{6}$/);
    expect(invoice.lines).toHaveLength(2);
    const planLine = invoice.lines.find((l) => l.productId === null)!;
    expect(planLine).toMatchObject({ unitPrice: 50_000, taxRateBps: 0, taxAmount: 0, amount: 50_000 });
    expect(invoice.periodStart.toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(invoice.periodEnd.toISOString().slice(0, 10)).toBe('2026-02-27');
    expect(invoice.dueDate.toISOString().slice(0, 10)).toBe('2026-02-16');
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(after.nextInvoiceDate?.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('keeps invoice snapshots stable when catalog prices change later', async () => {
    const sub = await activeSubscription();
    const { invoice } = await generateInvoice(sub.id, undefined, new Date('2026-02-01'));
    await prisma.product.update({ where: { id: catalog.product.id }, data: { salesPrice: 999_999 } });
    await prisma.tax.update({ where: { id: catalog.tax.id }, data: { rateBps: 2800 } });
    const reread = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice!.id }, include: { lines: true } });
    expect(reread.total).toBe(418_160);
    expect(reread.lines.find((l) => l.productId)!.taxRateBps).toBe(1800);
  });

  it('applies product then subscription discounts and claims usage once per invoice', async () => {
    const productDiscount = await prisma.discount.create({
      data: { name: '₹200 off seat', type: 'FIXED', value: 20_000, scope: 'PRODUCT', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), usageLimit: 5, products: { create: [{ productId: catalog.product.id }] } },
    });
    const subDiscount = await prisma.discount.create({ data: { name: '10%', type: 'PERCENT', value: 1000, scope: 'SUBSCRIPTION', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') } });
    const sub = await activeSubscription({ discountIds: [subDiscount.id] });
    const { invoice } = await generateInvoice(sub.id, undefined, new Date('2026-02-01'));
    // 312,000 - 20,000 = 292,000; 10% = 29,200 -> discount 49,200; taxable 262,800; tax 47,304
    expect(invoice).toMatchObject({ discountTotal: 49_200, taxTotal: 47_304, total: 362_000 - 49_200 + 47_304 });
    expect((await prisma.discount.findUniqueOrThrow({ where: { id: productDiscount.id } })).timesUsed).toBe(1);
  });

  it('stops applying a discount once its usage limit is reached', async () => {
    const limited = await prisma.discount.create({
      data: { name: 'One use', type: 'FIXED', value: 10_000, scope: 'PRODUCT', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), usageLimit: 1, products: { create: [{ productId: catalog.product.id }] } },
    });
    const a = await activeSubscription();
    const b = await activeSubscription();
    const [first, second] = await Promise.all([generateInvoice(a.id, undefined, new Date('2026-02-01')), generateInvoice(b.id, undefined, new Date('2026-02-01'))]);
    const discounted = [first.invoice!, second.invoice!].filter((inv) => inv.discountTotal > 0);
    expect(discounted).toHaveLength(1);
    expect((await prisma.discount.findUniqueOrThrow({ where: { id: limited.id } })).timesUsed).toBe(1);
  });

  it('refuses paused, inactive and not-yet-due subscriptions', async () => {
    const sub = await activeSubscription({ startDate: '2026-03-01' });
    await expect(generateInvoice(sub.id, undefined, new Date('2026-02-01'))).rejects.toMatchObject({ code: 'SUBSCRIPTION_NOT_DUE' });
    await prisma.subscription.update({ where: { id: sub.id }, data: { pausedAt: new Date() } });
    await expect(generateInvoice(sub.id, undefined, new Date('2026-03-02'))).rejects.toMatchObject({ code: 'SUBSCRIPTION_PAUSED' });
    await prisma.subscription.update({ where: { id: sub.id }, data: { pausedAt: null, status: 'CLOSED' } });
    await expect(generateInvoice(sub.id, undefined, new Date('2026-03-02'))).rejects.toMatchObject({ code: 'SUBSCRIPTION_NOT_ACTIVE' });
  });

  it('auto-closes an expired subscription and the close is committed', async () => {
    await prisma.plan.update({ where: { id: catalog.plan.id }, data: { autoClose: true } });
    const sub = await activeSubscription({ startDate: '2026-01-31', expiryDate: '2026-01-15' });
    const outcome = await generateInvoice(sub.id, undefined, new Date('2026-02-01'));
    expect(outcome.status).toBe('closed');
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(after.status).toBe('CLOSED');
    expect(await prisma.invoice.count()).toBe(0);
  });
});

describe('concurrency (1): same-period invoice requested twice', () => {
  it('creates exactly one invoice when two requests race for the same period', async () => {
    const sub = await activeSubscription();
    const results = await Promise.all([
      generateInvoice(sub.id, '2026-01-31', new Date('2026-02-01')),
      generateInvoice(sub.id, '2026-01-31', new Date('2026-02-01')),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['created', 'existing']);
    expect(results[0].invoice!.id).toBe(results[1].invoice!.id);
    expect(await prisma.invoice.count({ where: { subscriptionId: sub.id } })).toBe(1);
  });
});

describe('billing orchestration', () => {
  it('catches up missed periods (max 12) and is idempotent across repeated runs', async () => {
    const sub = await activeSubscription({ startDate: '2025-01-31' });
    const first = await runBilling(new Date('2026-04-15'));
    expect(first).toMatchObject({ attempted: 1, generated: 12, failures: [] });
    const second = await runBilling(new Date('2026-04-15'));
    expect(second.generated).toBe(3); // Jan 31, Feb 28, Mar 31 2026 remained after the 12-cycle cap
    for (let i = 0; i < 3; i += 1) expect((await runBilling(new Date('2026-04-15'))).generated).toBe(0);
    const periods = (await prisma.invoice.findMany({ where: { subscriptionId: sub.id }, orderBy: { periodStart: 'asc' } })).map((i) => i.periodStart.toISOString().slice(0, 10));
    expect(periods).toHaveLength(15);
    expect(new Set(periods).size).toBe(15);
    expect(periods.slice(0, 3)).toEqual(['2025-01-31', '2025-02-28', '2025-03-31']);
  });

  it('skips paused subscriptions and isolates one failing subscription from the batch', async () => {
    const good = await activeSubscription();
    const paused = await activeSubscription();
    await prisma.subscription.update({ where: { id: paused.id }, data: { pausedAt: new Date() } });
    const broken = await activeSubscription({ expiryDate: '2026-01-01' }); // expired, plan not autoClose -> error
    const result = await runBilling(new Date('2026-02-01'));
    expect(result.attempted).toBe(2);
    expect(result.generated).toBe(1);
    expect(result.failures).toEqual([{ subscriptionId: broken.id, message: expect.stringContaining('expiry') }]);
    expect(await prisma.invoice.count({ where: { subscriptionId: good.id } })).toBe(1);
    expect(await prisma.invoice.count({ where: { subscriptionId: paused.id } })).toBe(0);
  });
});
