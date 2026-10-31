import { PrismaClient, Role, BillingPeriod, DiscountType, DiscountScope } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Clear existing records in correct relation order
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscriptionDiscount.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.quotationTemplateLine.deleteMany();
  await prisma.quotationTemplate.deleteMany();
  await prisma.discountProduct.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.tax.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.counter.deleteMany();

  // 2. Initialize human-readable counters
  await prisma.counter.createMany({
    data: [
      { key: 'subscription', value: 100 },
      { key: 'invoice', value: 100 },
    ],
  });

  // 3. Create Seed Users
  const adminPassword = await bcrypt.hash('Admin@1234', 10);
  const staffPassword = await bcrypt.hash('Staff@1234', 10);
  const customerPassword = await bcrypt.hash('Customer@1234', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@brightloop.test',
      name: 'System Administrator',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: 'staff@brightloop.test',
      name: 'Operations Staff',
      passwordHash: staffPassword,
      role: Role.STAFF,
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      email: 'customer@brightloop.test',
      name: 'Acme Retail Corp',
      passwordHash: customerPassword,
      role: Role.CUSTOMER,
      customer: {
        create: {
          companyName: 'Acme Retail Pvt Ltd',
          phone: '+91 9876543210',
          address: '42 MG Road, Bengaluru, Karnataka',
        },
      },
    },
    include: { customer: true },
  });

  console.log('✅ Created Demo Users (Admin, Staff, Customer)');

  // 4. Create Standard Taxes
  const tax18 = await prisma.tax.create({
    data: { name: 'GST 18%', rateBps: 1800, active: true },
  });
  await prisma.tax.createMany({
    data: [
      { name: 'GST 5%', rateBps: 500, active: true },
      { name: 'GST 12%', rateBps: 1200, active: true },
    ],
  });

  // 5. Create Products with Variants
  // Note: Odoo brand adds 560 INR = 56,000 paise
  const erpProduct = await prisma.product.create({
    data: {
      name: 'Brightloop Business Suite',
      type: 'SOFTWARE',
      salesPrice: 200000, // ₹2,000.00
      costPrice: 80000,   // ₹800.00
      notes: 'Flagship enterprise subscription package',
      variants: {
        create: [
          { attribute: 'Brand', value: 'Odoo Edition', extraPrice: 56000 }, // +₹560.00
          { attribute: 'Brand', value: 'Standard Edition', extraPrice: 0 },
        ],
      },
    },
  });

  const crmProduct = await prisma.product.create({
    data: {
      name: 'Brightloop CRM Add-on',
      type: 'ADD_ON',
      salesPrice: 50000, // ₹500.00
      costPrice: 20000,
      notes: 'Customer relation & lead pipeline module',
    },
  });

  console.log('✅ Created Products & Odoo Variant (+₹560)');

  // 6. Create Plans
  const monthlyPlan = await prisma.plan.create({
    data: {
      name: 'Standard Monthly Plan',
      price: 250000, // ₹2,500.00
      billingPeriod: BillingPeriod.MONTHLY,
      minQuantity: 1,
      startDate: new Date('2026-01-01'),
      closable: true,
      pausable: true,
      renewable: true,
      autoClose: false,
    },
  });

  const yearlyPlan = await prisma.plan.create({
    data: {
      name: 'Enterprise Annual Contract',
      price: 2500000, // ₹25,000.00
      billingPeriod: BillingPeriod.YEARLY,
      minQuantity: 5,
      startDate: new Date('2026-01-01'),
      closable: true,
      pausable: false,
      renewable: true,
      autoClose: true,
    },
  });

  // 7. Create Quotation Template
  await prisma.quotationTemplate.create({
    data: {
      name: 'Starter Enterprise Quote',
      validityDays: 14,
      planId: monthlyPlan.id,
      lines: {
        create: [
          { productId: erpProduct.id, quantity: 2 },
          { productId: crmProduct.id, quantity: 1 },
        ],
      },
    },
  });

  // 8. Create Discounts
  await prisma.discount.create({
    data: {
      name: 'High Volume Seats Discount',
      type: DiscountType.PERCENT,
      value: 1000, // 10.00% (1000 bps)
      minQuantity: 5,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: 100,
      scope: DiscountScope.SUBSCRIPTION,
    },
  });

  await prisma.discount.create({
    data: {
      name: 'Welcome ₹500 Off',
      type: DiscountType.FIXED,
      value: 50000, // ₹500.00 (50,000 paise)
      minPurchase: 100000, // ₹1,000.00
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: 50,
      scope: DiscountScope.PRODUCT,
      products: {
        create: [{ productId: erpProduct.id }],
      },
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log('Demo Credentials:');
  console.log('  Admin:    admin@brightloop.test / Admin@1234');
  console.log('  Staff:    staff@brightloop.test / Staff@1234');
  console.log('  Customer: customer@brightloop.test / Customer@1234');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
