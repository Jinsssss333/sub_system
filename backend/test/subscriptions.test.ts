import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/mailer.js', () => ({ sendEmail: vi.fn(async () => ({ delivered: true, messageId: 'test' })) }));

const { prisma } = await import('../src/config/db.js');
const { nextAnchorOnOrAfter } = await import('../src/modules/subscriptions/subscriptions.service.js');
const { api, auth, resetDb, seedActors, seedCatalog } = await import('./helpers.js');

afterAll(() => prisma.$disconnect());

let actors: Awaited<ReturnType<typeof seedActors>>;
let catalog: Awaited<ReturnType<typeof seedCatalog>>;
beforeEach(async () => {
  await resetDb();
  actors = await seedActors();
  catalog = await seedCatalog();
});

const staff = () => auth(actors.staffToken);

async function createDraft(overrides: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/subscriptions')
    .set(staff())
    .send({
      customerId: actors.customer.customer!.id,
      planId: catalog.plan.id,
      startDate: '2026-01-31',
      lines: [{ productId: catalog.product.id, variantId: catalog.variant.id, quantity: 2, taxId: catalog.tax.id }],
      ...overrides,
    });
  return res;
}

async function activate(id: string) {
  for (const to of ['QUOTATION', 'CONFIRMED', 'ACTIVE']) {
    const res = await api().post(`/api/subscriptions/${id}/transition`).set(staff()).send({ to });
    expect(res.status, `${to}: ${JSON.stringify(res.body)}`).toBe(200);
  }
}

describe('customers', () => {
  it('creates a customer without a shared default password and isolates customer profiles', async () => {
    const created = await api().post('/api/customers').set(staff()).send({ email: 'buyer@acme.test', name: 'Buyer', companyName: 'Acme' });
    expect(created.status).toBe(201);
    const login = await api().post('/api/auth/login').send({ email: 'buyer@acme.test', password: 'Customer@1234' });
    expect(login.status).toBe(401);

    const own = await api().get(`/api/customers/${actors.customer.customer!.id}`).set(auth(actors.customerToken));
    expect(own.status).toBe(200);
    const other = await api().get(`/api/customers/${actors.other.customer!.id}`).set(auth(actors.customerToken));
    expect(other.status).toBe(404);
  });
});

describe('subscription creation', () => {
  it('prices lines from the catalog (product + variant) and ignores client prices', async () => {
    const res = await createDraft();
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.number).toMatch(/^SUB-\d{6}$/);
    expect(res.body.data.lines[0]).toMatchObject({ unitPrice: 156_000, amount: 312_000 });

    const forged = await createDraft({ lines: [{ productId: catalog.product.id, quantity: 1, unitPrice: 1 }] });
    expect(forged.status).toBe(400);
  });

  it('rejects line totals above the documented maximum', async () => {
    const res = await createDraft({ lines: [{ productId: catalog.product.id, quantity: 1001 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LINE_AMOUNT_TOO_LARGE');
  });

  it('copies template lines and sets the quotation expiry', async () => {
    const template = await prisma.quotationTemplate.create({
      data: { name: 'Starter', planId: catalog.plan.id, validityDays: 10, lines: { create: [{ productId: catalog.product.id, quantity: 3 }] } },
    });
    const res = await api().post('/api/subscriptions').set(staff()).send({ customerId: actors.customer.customer!.id, templateId: template.id });
    expect(res.status).toBe(201);
    expect(res.body.data.lines).toHaveLength(1);
    expect(res.body.data.lines[0].quantity).toBe(3);
    const expiry = new Date(res.body.data.quotationExpiryDate).getTime();
    expect(Math.abs(expiry - (Date.now() + 10 * 86_400_000))).toBeLessThan(5 * 60_000);
  });

  it('attaches only subscription-scoped discounts', async () => {
    const subDiscount = await prisma.discount.create({ data: { name: '10%', type: 'PERCENT', value: 1000, scope: 'SUBSCRIPTION', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01') } });
    const prodDiscount = await prisma.discount.create({ data: { name: 'P', type: 'FIXED', value: 100, scope: 'PRODUCT', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01') } });
    expect((await createDraft({ discountIds: [subDiscount.id] })).status).toBe(201);
    expect((await createDraft({ discountIds: [prodDiscount.id] })).status).toBe(400);
  });
});

describe('lifecycle', () => {
  it('walks DRAFT → QUOTATION → CONFIRMED → ACTIVE → CLOSED and sets/clears the billing cursor', async () => {
    const draft = await createDraft();
    await activate(draft.body.data.id);
    const active = await prisma.subscription.findUniqueOrThrow({ where: { id: draft.body.data.id } });
    expect(active.status).toBe('ACTIVE');
    expect(active.nextInvoiceDate?.toISOString().slice(0, 10)).toBe('2026-01-31');

    const closed = await api().post(`/api/subscriptions/${draft.body.data.id}/transition`).set(staff()).send({ to: 'CLOSED' });
    expect(closed.status).toBe(200);
    expect(closed.body.data.nextInvoiceDate).toBeNull();
  });

  it('rejects illegal jumps with 409 and edits after DRAFT with 409', async () => {
    const draft = await createDraft();
    const jump = await api().post(`/api/subscriptions/${draft.body.data.id}/transition`).set(staff()).send({ to: 'ACTIVE' });
    expect(jump.status).toBe(409);
    await api().post(`/api/subscriptions/${draft.body.data.id}/transition`).set(staff()).send({ to: 'QUOTATION' });
    const edit = await api().patch(`/api/subscriptions/${draft.body.data.id}`).set(staff()).send({ paymentTermDays: 5 });
    expect(edit.status).toBe(409);
  });

  it('enforces the plan minimum quantity on confirmation', async () => {
    const plan = await prisma.plan.update({ where: { id: catalog.plan.id }, data: { minQuantity: 5 } });
    const draft = await createDraft({ planId: plan.id });
    await api().post(`/api/subscriptions/${draft.body.data.id}/transition`).set(staff()).send({ to: 'QUOTATION' });
    const confirm = await api().post(`/api/subscriptions/${draft.body.data.id}/transition`).set(staff()).send({ to: 'CONFIRMED' });
    expect(confirm.status).toBe(409);
    expect(confirm.body.error.code).toBe('MIN_QUANTITY_NOT_MET');
  });

  it('pauses only pausable plans and resumes at the next anchor on or after today (no back-billing)', async () => {
    const draft = await createDraft({ startDate: '2025-01-31' });
    await activate(draft.body.data.id);
    const paused = await api().post(`/api/subscriptions/${draft.body.data.id}/pause`).set(staff());
    expect(paused.status).toBe(200);
    expect(paused.body.data.pausedAt).toBeTruthy();
    expect((await api().post(`/api/subscriptions/${draft.body.data.id}/pause`).set(staff())).status).toBe(409);

    const resumed = await api().post(`/api/subscriptions/${draft.body.data.id}/resume`).set(staff());
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.pausedAt).toBeNull();
    const next = new Date(resumed.body.data.nextInvoiceDate);
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    expect(next.getTime()).toBeGreaterThanOrEqual(today.getTime());
    expect(next.getTime() - today.getTime()).toBeLessThanOrEqual(31 * 86_400_000);

    await prisma.plan.update({ where: { id: catalog.plan.id }, data: { pausable: false } });
    expect((await api().post(`/api/subscriptions/${draft.body.data.id}/pause`).set(staff())).body.error.code).toBe('PLAN_NOT_PAUSABLE');
  });

  it('renews into a linked DRAFT and leaves the original untouched', async () => {
    const draft = await createDraft();
    await activate(draft.body.data.id);
    const renewed = await api().post(`/api/subscriptions/${draft.body.data.id}/renew`).set(staff());
    expect(renewed.status).toBe(201);
    expect(renewed.body.data).toMatchObject({ status: 'DRAFT', renewedFromId: draft.body.data.id });
    const original = await prisma.subscription.findUniqueOrThrow({ where: { id: draft.body.data.id } });
    expect(original.status).toBe('ACTIVE');
  });
});

describe('next anchor helper', () => {
  it('keeps month-end anchors when skipping paused periods', () => {
    const anchor = new Date('2026-01-31');
    expect(nextAnchorOnOrAfter(new Date('2026-01-31'), 'MONTHLY', anchor, new Date('2026-04-15')).toISOString().slice(0, 10)).toBe('2026-04-30');
    expect(nextAnchorOnOrAfter(new Date('2026-01-31'), 'MONTHLY', anchor, new Date('2026-05-31')).toISOString().slice(0, 10)).toBe('2026-05-31');
    expect(nextAnchorOnOrAfter(new Date('2026-06-30'), 'MONTHLY', anchor, new Date('2026-06-01')).toISOString().slice(0, 10)).toBe('2026-06-30');
  });
});

describe('customer portal isolation', () => {
  it('lists only the customer’s own subscriptions and 404s on others', async () => {
    const mine = await createDraft();
    const theirs = await createDraft({ customerId: actors.other.customer!.id });

    const list = await api().get('/api/me/subscriptions?page=1&pageSize=10').set(auth(actors.customerToken));
    expect(list.status).toBe(200);
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([mine.body.data.id]);
    expect(list.body.meta.total).toBe(1);

    expect((await api().get(`/api/subscriptions/${theirs.body.data.id}`).set(auth(actors.customerToken))).status).toBe(404);
    expect((await api().get(`/api/me/subscriptions/${theirs.body.data.id}`).set(auth(actors.customerToken))).status).toBe(404);
    expect((await api().post(`/api/subscriptions/${theirs.body.data.id}/pause`).set(auth(actors.customerToken))).status).toBe(404);
    expect((await api().post(`/api/subscriptions/${theirs.body.data.id}/transition`).set(auth(actors.customerToken)).send({ to: 'CLOSED' })).status).toBe(404);
    expect((await api().get('/api/subscriptions').set(auth(actors.customerToken))).status).toBe(403);
  });

  it('lets customers close but not activate their own subscription', async () => {
    const mine = await createDraft();
    const activateAttempt = await api().post(`/api/subscriptions/${mine.body.data.id}/transition`).set(auth(actors.customerToken)).send({ to: 'QUOTATION' });
    expect(activateAttempt.status).toBe(403);
    await activate(mine.body.data.id);
    const close = await api().post(`/api/subscriptions/${mine.body.data.id}/transition`).set(auth(actors.customerToken)).send({ to: 'CLOSED' });
    expect(close.status).toBe(200);
  });
});
