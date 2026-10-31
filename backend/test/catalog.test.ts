import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/db.js';
import { api, auth, resetDb, seedActors } from './helpers.js';

afterAll(() => prisma.$disconnect());

let actors: Awaited<ReturnType<typeof seedActors>>;
beforeEach(async () => {
  await resetDb();
  actors = await seedActors();
});

const asAdmin = () => auth(actors.adminToken);

async function createProduct(body: Record<string, unknown> = {}) {
  return api().post('/api/products').set(asAdmin()).send({ name: 'CRM Seat', type: 'SERVICE', salesPrice: 100_000, costPrice: 20_000, ...body });
}

describe('products and variants', () => {
  it('creates a product with an Odoo variant (+₹560) and lists it paginated', async () => {
    const product = await createProduct();
    expect(product.status).toBe(201);
    const variant = await api().post(`/api/products/${product.body.data.id}/variants`).set(asAdmin()).send({ attribute: 'Edition', value: 'Odoo', extraPrice: 56_000 });
    expect(variant.status).toBe(201);
    expect(variant.body.data.extraPrice).toBe(56_000);

    const duplicate = await api().post(`/api/products/${product.body.data.id}/variants`).set(asAdmin()).send({ attribute: 'Edition', value: 'Odoo', extraPrice: 1 });
    expect(duplicate.status).toBe(409);

    const list = await api().get('/api/products?page=1&pageSize=10').set(auth(actors.staffToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });

  it('rejects fractional, negative and oversized money', async () => {
    for (const salesPrice of [10.5, -1, 100_000_001]) {
      const res = await createProduct({ salesPrice });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.salesPrice).toBeTruthy();
    }
  });

  it('lets admins deactivate a product and blocks staff from catalog writes', async () => {
    const product = await createProduct();
    const patch = await api().patch(`/api/products/${product.body.data.id}`).set(asAdmin()).send({ active: false });
    expect(patch.status).toBe(200);
    expect(patch.body.data.active).toBe(false);
    const staffWrite = await api().post('/api/products').set(auth(actors.staffToken)).send({ name: 'X', type: 'S', salesPrice: 1, costPrice: 1 });
    expect(staffWrite.status).toBe(403);
    const customerRead = await api().get('/api/products').set(auth(actors.customerToken));
    expect(customerRead.status).toBe(403);
  });
});

describe('plans and taxes', () => {
  it('creates a plan with policy flags and validates date order', async () => {
    const ok = await api().post('/api/plans').set(asAdmin()).send({ name: 'Monthly', price: 50_000, billingPeriod: 'MONTHLY', startDate: '2026-01-01', pausable: true });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ pausable: true, renewable: true, closable: true, autoClose: false });
    const bad = await api().post('/api/plans').set(asAdmin()).send({ name: 'Bad', price: 1, billingPeriod: 'MONTHLY', startDate: '2026-02-01', endDate: '2026-01-01' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.endDate).toBeTruthy();
  });

  it('stores tax as basis points and rejects rates above 100%', async () => {
    const ok = await api().post('/api/taxes').set(asAdmin()).send({ name: 'GST 18%', rateBps: 1800 });
    expect(ok.status).toBe(201);
    expect(ok.body.data.rateBps).toBe(1800);
    expect((await api().post('/api/taxes').set(asAdmin()).send({ name: 'Bad', rateBps: 10_001 })).status).toBe(400);
    expect((await api().post('/api/taxes').set(asAdmin()).send({ name: 'Bad', rateBps: 18.5 })).status).toBe(400);
  });
});

describe('discounts', () => {
  it('creates product and subscription discounts with validation', async () => {
    const product = await createProduct();
    const productDiscount = await api().post('/api/discounts').set(asAdmin()).send({
      name: 'Launch ₹100 off', type: 'FIXED', value: 10_000, scope: 'PRODUCT', startDate: '2026-01-01', endDate: '2026-12-31', usageLimit: 5, productIds: [product.body.data.id],
    });
    expect(productDiscount.status).toBe(201);
    expect(productDiscount.body.data.products).toHaveLength(1);

    const percent = await api().post('/api/discounts').set(asAdmin()).send({ name: '10% off', type: 'PERCENT', value: 1000, scope: 'SUBSCRIPTION', startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(percent.status).toBe(201);

    const tooMuch = await api().post('/api/discounts').set(asAdmin()).send({ name: 'Bad', type: 'PERCENT', value: 10_001, scope: 'SUBSCRIPTION', startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(tooMuch.status).toBe(400);
    const noProducts = await api().post('/api/discounts').set(asAdmin()).send({ name: 'Bad', type: 'FIXED', value: 1, scope: 'PRODUCT', startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(noProducts.status).toBe(400);
    const missingProduct = await api().post('/api/discounts').set(asAdmin()).send({ name: 'Bad', type: 'FIXED', value: 1, scope: 'PRODUCT', startDate: '2026-01-01', endDate: '2026-12-31', productIds: ['00000000-0000-4000-8000-000000000000'] });
    expect(missingProduct.status).toBe(400);
    const backwards = await api().post('/api/discounts').set(asAdmin()).send({ name: 'Bad', type: 'FIXED', value: 1, scope: 'SUBSCRIPTION', startDate: '2026-12-31', endDate: '2026-01-01' });
    expect(backwards.status).toBe(400);

    const list = await api().get('/api/discounts?pageSize=1').set(auth(actors.staffToken));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.total).toBe(2);
  });
});

describe('quotation templates', () => {
  it('creates a template and lists it paginated', async () => {
    const product = await createProduct();
    const plan = await api().post('/api/plans').set(asAdmin()).send({ name: 'Monthly', price: 50_000, billingPeriod: 'MONTHLY', startDate: '2026-01-01' });
    const template = await api().post('/api/templates').set(asAdmin()).send({ name: 'Starter', planId: plan.body.data.id, validityDays: 14, lines: [{ productId: product.body.data.id, quantity: 3 }] });
    expect(template.status).toBe(201);
    expect(template.body.data.lines).toHaveLength(1);
    const empty = await api().post('/api/templates').set(asAdmin()).send({ name: 'Empty', planId: plan.body.data.id, validityDays: 14, lines: [] });
    expect(empty.status).toBe(400);
    const list = await api().get('/api/templates?page=1&pageSize=5').set(auth(actors.staffToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });
});
