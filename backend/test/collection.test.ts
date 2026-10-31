import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sent: Array<{ to: string; html: string; subject: string }> = [];
vi.mock('../src/config/mailer.js', () => ({
  sendEmail: vi.fn(async (message: { to: string; html: string; subject: string }) => {
    sent.push(message);
    return { delivered: true, messageId: 'test' };
  }),
}));

const { prisma } = await import('../src/config/db.js');
const { api, auth, resetDb, seedActors, seedCatalog } = await import('./helpers.js');
const { recordPayment } = await import('../src/modules/payments/payments.service.js');

afterAll(() => prisma.$disconnect());

let actors: Awaited<ReturnType<typeof seedActors>>;
let catalog: Awaited<ReturnType<typeof seedCatalog>>;
beforeEach(async () => {
  await resetDb();
  sent.length = 0;
  actors = await seedActors();
  catalog = await seedCatalog();
});

let n = 0;
async function invoice(opts: { total?: number; status?: 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED'; customerId?: string; description?: string } = {}) {
  n += 1;
  const total = opts.total ?? 100_000;
  const customerId = opts.customerId ?? actors.customer.customer!.id;
  const sub = await prisma.subscription.create({ data: { number: `SUB-C${n}`, customerId, planId: catalog.plan.id, status: 'ACTIVE', startDate: new Date('2026-01-01') } });
  return prisma.invoice.create({
    data: {
      number: `INV-C${n}`, subscriptionId: sub.id, customerId, periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
      status: opts.status ?? 'DRAFT', subtotal: total, taxTotal: 0, total, issueDate: new Date('2026-01-01'), dueDate: new Date('2026-01-15'),
      lines: { create: [{ description: opts.description ?? 'Seat', quantity: 1, unitPrice: total, amount: total }] },
    },
  });
}

const staff = () => auth(actors.staffToken);
const pay = (id: string, amount: number, token = actors.staffToken) =>
  api().post(`/api/invoices/${id}/payments`).set(auth(token)).send({ method: 'UPI', amount, paidOn: '2026-01-10' });

describe('invoice actions', () => {
  it('confirms a draft once; a zero-total invoice settles as PAID', async () => {
    const inv = await invoice();
    const confirmed = await api().post(`/api/invoices/${inv.id}/confirm`).set(staff());
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');
    expect((await api().post(`/api/invoices/${inv.id}/confirm`).set(staff())).status).toBe(409);

    const zero = await invoice({ total: 0 });
    const settled = await api().post(`/api/invoices/${zero.id}/confirm`).set(staff());
    expect(settled.body.data.status).toBe('PAID');
    expect(await prisma.payment.count({ where: { invoiceId: zero.id } })).toBe(0);
  });

  it('cancels only unpaid invoices', async () => {
    const unpaid = await invoice({ status: 'CONFIRMED' });
    expect((await api().post(`/api/invoices/${unpaid.id}/cancel`).set(staff())).body.data.status).toBe('CANCELLED');
    const partly = await invoice({ status: 'CONFIRMED' });
    await pay(partly.id, 1_000);
    const res = await api().post(`/api/invoices/${partly.id}/cancel`).set(staff());
    expect(res.status).toBe(409);
  });

  it('sends confirmed invoices by email with escaped content, not drafts', async () => {
    await prisma.customer.update({ where: { id: actors.customer.customer!.id }, data: { companyName: '<script>alert(1)</script>' } });
    const draft = await invoice();
    expect((await api().post(`/api/invoices/${draft.id}/send`).set(staff())).status).toBe(409);
    const confirmed = await invoice({ status: 'CONFIRMED' });
    const res = await api().post(`/api/invoices/${confirmed.id}/send`).set(staff());
    expect(res.status).toBe(200);
    expect(sent[0].to).toBe('customer@test.local');
    expect(sent[0].html).not.toContain('<script>');
    expect(sent[0].html).toContain('&lt;script&gt;');
  });

  it('renders a printable invoice with every text value escaped', async () => {
    await prisma.customer.update({ where: { id: actors.customer.customer!.id }, data: { companyName: '"><img src=x onerror=alert(1)>', address: '<b>bold</b>' } });
    const inv = await invoice({ status: 'CONFIRMED', description: '<script>steal()</script>' });
    const res = await api().get(`/api/invoices/${inv.id}/print`).set(auth(actors.customerToken));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).not.toContain('<script>steal');
    expect(res.text).not.toContain('<img src=x');
    expect(res.text).not.toContain('<b>bold');
    expect(res.text).toContain('&lt;script&gt;steal()&lt;/script&gt;');
    expect(res.text).toContain('₹1,000.00');
  });
});

describe('payments', () => {
  it('records partial then final payments and flips to PAID', async () => {
    const inv = await invoice({ status: 'CONFIRMED' });
    const first = await pay(inv.id, 40_000);
    expect(first.status).toBe(201);
    expect(first.body.data.invoice).toMatchObject({ amountPaid: 40_000, status: 'CONFIRMED' });
    const second = await pay(inv.id, 60_000);
    expect(second.body.data.invoice).toMatchObject({ amountPaid: 100_000, status: 'PAID' });
    expect((await pay(inv.id, 1)).status).toBe(409);
  });

  it('rejects overpayment, zero, negative, fractional, unconfirmed and customer-recorded payments', async () => {
    const inv = await invoice({ status: 'CONFIRMED', total: 5_000 });
    const over = await pay(inv.id, 10_000);
    expect(over.status).toBe(400);
    expect(over.body.error.code).toBe('OVERPAYMENT');
    for (const amount of [0, -5, 10.5]) expect((await pay(inv.id, amount)).status).toBe(400);
    const draft = await invoice();
    expect((await pay(draft.id, 100)).status).toBe(409);
    expect((await pay(inv.id, 100, actors.customerToken)).status).toBe(403);
    const future = await api().post(`/api/invoices/${inv.id}/payments`).set(staff()).send({ method: 'UPI', amount: 100, paidOn: '2099-01-01' });
    expect(future.status).toBe(400);
  });

  it('lists the payment ledger with pagination', async () => {
    const inv = await invoice({ status: 'CONFIRMED' });
    await pay(inv.id, 1_000);
    await pay(inv.id, 2_000);
    const res = await api().get('/api/payments?page=1&pageSize=1').set(staff());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(2);
  });
});

describe('concurrency (2): two payments exceeding the balance', () => {
  it('lets only one of two simultaneous payments succeed when together they exceed the balance', async () => {
    const inv = await invoice({ status: 'CONFIRMED', total: 100_000 });
    const results = await Promise.allSettled([
      recordPayment(inv.id, { method: 'CASH', amount: 70_000, paidOn: new Date('2026-01-10') }),
      recordPayment(inv.id, { method: 'CARD', amount: 70_000, paidOn: new Date('2026-01-10') }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.code).toBe('OVERPAYMENT');
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.amountPaid).toBe(70_000);
    expect(await prisma.payment.count({ where: { invoiceId: inv.id } })).toBe(1);
  });
});

describe('invoice isolation', () => {
  it('shows customers only their invoices and 404s on others (detail and print)', async () => {
    const mine = await invoice({ status: 'CONFIRMED' });
    const theirs = await invoice({ status: 'CONFIRMED', customerId: actors.other.customer!.id });
    const list = await api().get('/api/me/invoices').set(auth(actors.customerToken));
    expect(list.body.data.map((i: { id: string }) => i.id)).toEqual([mine.id]);
    expect((await api().get(`/api/invoices/${theirs.id}`).set(auth(actors.customerToken))).status).toBe(404);
    expect((await api().get(`/api/invoices/${theirs.id}/print`).set(auth(actors.customerToken))).status).toBe(404);
    expect((await api().get('/api/invoices').set(auth(actors.customerToken))).status).toBe(403);
    expect((await api().get('/api/me/invoices?status=BOGUS').set(auth(actors.customerToken))).status).toBe(400);
  });
});
