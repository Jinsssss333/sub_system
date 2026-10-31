import bcrypt from 'bcryptjs';
import request from 'supertest';
import { BillingPeriod, Role } from '@prisma/client';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

export const api = () => request(app);

const TABLES = [
  'Payment', 'InvoiceLine', 'Invoice', 'SubscriptionDiscount', 'SubscriptionLine', 'Subscription',
  'QuotationTemplateLine', 'QuotationTemplate', 'DiscountProduct', 'Discount', 'ProductVariant', 'Product',
  'Plan', 'Tax', 'PasswordResetToken', 'Customer', 'User', 'Counter',
];

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

export const PASSWORD = 'Strong@Pass1';
// Low bcrypt cost keeps the suite fast; production code uses cost 10.
const hash = () => bcrypt.hashSync(PASSWORD, 4);

export async function createUser(role: Role, email: string, withCustomer = role === 'CUSTOMER') {
  return prisma.user.create({
    data: { email, name: `${role} user`, passwordHash: hash(), role, ...(withCustomer ? { customer: { create: { companyName: `${email} Co` } } } : {}) },
    include: { customer: true },
  });
}

export async function login(email: string, password = PASSWORD) {
  const res = await api().post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token as string;
}

export async function seedActors() {
  const admin = await createUser('ADMIN', 'admin@test.local');
  const staff = await createUser('STAFF', 'staff@test.local');
  const customer = await createUser('CUSTOMER', 'customer@test.local');
  const other = await createUser('CUSTOMER', 'other@test.local');
  return {
    admin, staff, customer, other,
    adminToken: await login(admin.email),
    staffToken: await login(staff.email),
    customerToken: await login(customer.email),
    otherToken: await login(other.email),
  };
}

export async function seedCatalog() {
  const tax = await prisma.tax.create({ data: { name: 'GST 18%', rateBps: 1800 } });
  const product = await prisma.product.create({ data: { name: 'CRM Seat', type: 'SERVICE', salesPrice: 100_000, costPrice: 20_000 } });
  const variant = await prisma.productVariant.create({ data: { productId: product.id, attribute: 'Edition', value: 'Odoo', extraPrice: 56_000 } });
  const plan = await prisma.plan.create({
    data: { name: 'Monthly', price: 50_000, billingPeriod: BillingPeriod.MONTHLY, startDate: new Date('2026-01-01'), pausable: true, renewable: true, closable: true },
  });
  return { tax, product, variant, plan };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
