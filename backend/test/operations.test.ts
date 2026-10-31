import { execSync } from 'node:child_process';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/db.js';
import { runBillingExclusive, startBillingScheduler } from '../src/jobs/billing.job.js';
import { api, auth, resetDb, seedActors, seedCatalog } from './helpers.js';

afterAll(() => prisma.$disconnect());

let actors: Awaited<ReturnType<typeof seedActors>>;
let catalog: Awaited<ReturnType<typeof seedCatalog>>;
beforeEach(async () => {
  await resetDb();
  actors = await seedActors();
  catalog = await seedCatalog();
});

async function dueSubscription(number: string) {
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  return prisma.subscription.create({
    data: {
      number, customerId: actors.customer.customer!.id, planId: catalog.plan.id, status: 'ACTIVE', startDate: start, nextInvoiceDate: start,
      lines: { create: [{ productId: catalog.product.id, quantity: 1, unitPrice: 100_000, amount: 100_000, taxId: catalog.tax.id }] },
    },
  });
}

describe('admin run-billing', () => {
  it('is admin-only and generates due invoices once', async () => {
    await dueSubscription('SUB-OPS1');
    expect((await api().post('/api/admin/run-billing').set(auth(actors.staffToken))).status).toBe(403);
    const first = await api().post('/api/admin/run-billing').set(auth(actors.adminToken));
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ attempted: 1, generated: 1, failures: [], alreadyRunning: false });
    const second = await api().post('/api/admin/run-billing').set(auth(actors.adminToken));
    expect(second.body.data.generated).toBe(0);
    expect(await prisma.invoice.count()).toBe(1);
  });

  it('does not start a second run while one is in progress', async () => {
    await dueSubscription('SUB-OPS2');
    const [a, b] = await Promise.all([runBillingExclusive(), runBillingExclusive()]);
    expect([a.alreadyRunning, b.alreadyRunning].sort()).toEqual([false, true]);
    expect(await prisma.invoice.count()).toBe(1);
  });
});

describe('scheduler', () => {
  it('rejects an invalid cron expression and schedules a valid one', () => {
    expect(() => startBillingScheduler('not a cron')).toThrow(/cron/);
    const task = startBillingScheduler('0 1 * * *');
    expect(task).toBeTruthy();
    task.stop();
  });
});

describe('reports', () => {
  it('aggregates revenue, outstanding and overdue in the database', async () => {
    const sub = await dueSubscription('SUB-OPS3');
    const base = { subscriptionId: sub.id, customerId: actors.customer.customer!.id, periodEnd: new Date('2026-01-31'), subtotal: 0, taxTotal: 0, issueDate: new Date('2026-01-01') };
    await prisma.invoice.create({ data: { ...base, number: 'INV-R1', periodStart: new Date('2026-01-01'), status: 'PAID', total: 10_000, amountPaid: 10_000, dueDate: new Date('2026-01-15'), payments: { create: [{ method: 'UPI', amount: 10_000, paidOn: new Date() }] } } });
    await prisma.invoice.create({ data: { ...base, number: 'INV-R2', periodStart: new Date('2026-02-01'), status: 'CONFIRMED', total: 20_000, amountPaid: 5_000, dueDate: new Date('2020-01-01'), payments: { create: [{ method: 'CASH', amount: 5_000, paidOn: new Date() }] } } });
    await prisma.invoice.create({ data: { ...base, number: 'INV-R3', periodStart: new Date('2026-03-01'), status: 'CONFIRMED', total: 30_000, amountPaid: 0, dueDate: new Date('2099-01-01') } });

    const res = await api().get('/api/reports/summary').set(auth(actors.staffToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ activeSubscriptions: 1, revenueCollected: 15_000, outstanding: 45_000, overdueCount: 1, overdueAmount: 15_000 });
    expect(res.body.data.monthlyRevenue.at(-1).collected).toBe(15_000);

    const overdue = await api().get('/api/reports/overdue?page=1&pageSize=10').set(auth(actors.staffToken));
    expect(overdue.body.data.map((i: { number: string }) => i.number)).toEqual(['INV-R2']);
    expect((await api().get('/api/reports/summary').set(auth(actors.customerToken))).status).toBe(403);
  });
});

describe('full seed', () => {
  it('creates exactly 5,000 subscriptions and 20,000 invoices with demo logins', async () => {
    execSync('npx tsx prisma/seed.ts', { stdio: 'ignore', env: process.env });
    expect(await prisma.subscription.count()).toBe(5_000);
    expect(await prisma.invoice.count()).toBe(20_000);
    const duplicates = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*)::bigint AS n FROM (SELECT "subscriptionId","periodStart" FROM "Invoice" GROUP BY 1,2 HAVING COUNT(*) > 1) d`;
    expect(Number(duplicates[0].n)).toBe(0);
    const login = await api().post('/api/auth/login').send({ email: 'customer@brightloop.test', password: 'Customer@1234' });
    expect(login.status).toBe(200);
    const paidMismatch = await prisma.invoice.count({ where: { status: 'PAID', NOT: { amountPaid: { equals: prisma.invoice.fields.total } } } });
    expect(paidMismatch).toBe(0);
  }, 120_000);
});
