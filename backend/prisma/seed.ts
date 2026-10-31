import { PrismaClient, Role, BillingPeriod, SubscriptionStatus, InvoiceStatus, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seed (3-Hour Scope)...');

  // 1. Clear existing records in dependency order
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

  // 2. Initialize atomic counters
  await prisma.counter.createMany({
    data: [
      { key: 'subscription', value: 105 },
      { key: 'invoice', value: 104 },
    ],
  });

  // 3. Create Seed Users
  const adminPassword = await bcrypt.hash('Admin@1234', 10);
  const staffPassword = await bcrypt.hash('Staff@1234', 10);
  const customerPassword = await bcrypt.hash('Customer@1234', 10);

  await prisma.user.create({
    data: {
      email: 'admin@brightloop.test',
      name: 'System Administrator',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      email: 'staff@brightloop.test',
      name: 'Operations Staff',
      passwordHash: staffPassword,
      role: Role.STAFF,
    },
  });

  // 4. Create 5 Customers
  const customerUsers = [
    { email: 'customer@brightloop.test', name: 'Acme Retail Corp', company: 'Acme Retail Pvt Ltd', phone: '+91 9876543210', address: '42 MG Road, Bengaluru' },
    { email: 'zenith@brightloop.test', name: 'Zenith Tech', company: 'Zenith Tech Solutions', phone: '+91 9876543211', address: '12 Cyber City, Gurugram' },
    { email: 'bluesky@brightloop.test', name: 'BlueSky Cargo', company: 'BlueSky Logistics Ltd', phone: '+91 9876543212', address: '88 Port Road, Chennai' },
    { email: 'apex@brightloop.test', name: 'Apex Health', company: 'Apex Healthcare Systems', phone: '+91 9876543213', address: '15 Ring Road, Pune' },
    { email: 'horizon@brightloop.test', name: 'Horizon Media', company: 'Horizon Media Works', phone: '+91 9876543214', address: '7 Park Street, Kolkata' },
  ];

  const customers: any[] = [];
  for (const c of customerUsers) {
    const user = await prisma.user.create({
      data: {
        email: c.email,
        name: c.name,
        passwordHash: customerPassword,
        role: Role.CUSTOMER,
        customer: {
          create: {
            companyName: c.company,
            phone: c.phone,
            address: c.address,
          },
        },
      },
      include: { customer: true },
    });
    customers.push(user.customer);
  }

  console.log('✅ Created 5 Customers & Demo Accounts');

  // 5. Create Standard Taxes
  const tax18 = await prisma.tax.create({
    data: { name: 'GST 18%', rateBps: 1800, active: true },
  });
  await prisma.tax.createMany({
    data: [
      { name: 'GST 12%', rateBps: 1200, active: true },
      { name: 'GST 5%', rateBps: 500, active: true },
    ],
  });

  // 6. Create Products with Variants (+₹560 Odoo variant = 56,000 paise)
  const erpProduct = await prisma.product.create({
    data: {
      name: 'Brightloop Business Suite',
      type: 'SOFTWARE',
      salesPrice: 200000, // ₹2,000.00
      costPrice: 80000,
      notes: 'Flagship enterprise subscription package',
      variants: {
        create: [
          { attribute: 'Brand', value: 'Odoo Edition', extraPrice: 56000 }, // +₹560.00
          { attribute: 'Brand', value: 'Standard Edition', extraPrice: 0 },
        ],
      },
    },
    include: { variants: true },
  });

  const odooVariant = erpProduct.variants.find((v) => v.value === 'Odoo Edition')!;

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

  // 7. Create Plans
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

  // 8. Create Quotation Template
  await prisma.quotationTemplate.create({
    data: {
      name: 'Starter Enterprise Quote',
      validityDays: 14,
      planId: monthlyPlan.id,
      lines: {
        create: [
          { productId: erpProduct.id, variantId: odooVariant.id, quantity: 2 },
          { productId: crmProduct.id, quantity: 1 },
        ],
      },
    },
  });

  // 9. Create Representative Subscriptions across all states
  // SUB-000101: ACTIVE (Acme Retail)
  const activeSub = await prisma.subscription.create({
    data: {
      number: 'SUB-000101',
      customerId: customers[0].id,
      planId: monthlyPlan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date('2026-10-01'),
      expiryDate: new Date('2027-10-01'),
      nextInvoiceDate: new Date('2026-11-01'),
      paymentTermDays: 15,
      lines: {
        create: [
          {
            productId: erpProduct.id,
            variantId: odooVariant.id,
            quantity: 2,
            unitPrice: 256000, // ₹2,560.00 (2000 + 560)
            amount: 512000,
            taxId: tax18.id,
          },
        ],
      },
    },
  });

  // SUB-000102: CONFIRMED (Zenith Tech)
  const confirmedSub = await prisma.subscription.create({
    data: {
      number: 'SUB-000102',
      customerId: customers[1].id,
      planId: monthlyPlan.id,
      status: SubscriptionStatus.CONFIRMED,
      startDate: new Date('2026-11-01'),
      expiryDate: new Date('2027-11-01'),
      paymentTermDays: 15,
      lines: {
        create: [
          {
            productId: erpProduct.id,
            quantity: 1,
            unitPrice: 200000,
            amount: 200000,
            taxId: tax18.id,
          },
        ],
      },
    },
  });

  // SUB-000103: QUOTATION (BlueSky Cargo)
  const quoteSub = await prisma.subscription.create({
    data: {
      number: 'SUB-000103',
      customerId: customers[2].id,
      planId: yearlyPlan.id,
      status: SubscriptionStatus.QUOTATION,
      startDate: new Date('2026-11-15'),
      quotationExpiryDate: new Date('2026-11-29'),
      paymentTermDays: 30,
      lines: {
        create: [
          {
            productId: erpProduct.id,
            variantId: odooVariant.id,
            quantity: 5,
            unitPrice: 256000,
            amount: 1280000,
            taxId: tax18.id,
          },
        ],
      },
    },
  });

  // SUB-000104: DRAFT (Apex Health)
  await prisma.subscription.create({
    data: {
      number: 'SUB-000104',
      customerId: customers[3].id,
      planId: monthlyPlan.id,
      status: SubscriptionStatus.DRAFT,
      startDate: new Date('2026-12-01'),
      paymentTermDays: 15,
      lines: {
        create: [
          {
            productId: crmProduct.id,
            quantity: 2,
            unitPrice: 50000,
            amount: 100000,
            taxId: tax18.id,
          },
        ],
      },
    },
  });

  // 10. Create Representative Invoices (Paid, Confirmed, Overdue)
  // INV-000101: PAID
  await prisma.invoice.create({
    data: {
      number: 'INV-000101',
      subscriptionId: activeSub.id,
      customerId: customers[0].id,
      customerName: customers[0].companyName,
      customerAddress: customers[0].address,
      periodStart: new Date('2026-10-01'),
      periodEnd: new Date('2026-10-31'),
      status: InvoiceStatus.PAID,
      subtotal: 512000, // ₹5,120.00
      taxTotal: 92160,  // 18% = ₹921.60
      total: 604160,    // ₹6,041.60
      amountPaid: 604160,
      issueDate: new Date('2026-10-01'),
      dueDate: new Date('2026-10-16'),
      lines: {
        create: [
          {
            productId: erpProduct.id,
            description: 'Brightloop Business Suite (Odoo Edition) x 2',
            quantity: 2,
            unitPrice: 256000,
            taxRateBps: 1800,
            taxAmount: 92160,
            amount: 512000,
          },
        ],
      },
      payments: {
        create: [
          {
            method: PaymentMethod.UPI,
            amount: 604160,
            paidOn: new Date('2026-10-05'),
            note: 'UPI Payment - Ref: UPI/2026/ACME/101',
          },
        ],
      },
    },
  });

  // INV-000102: CONFIRMED & OVERDUE (Due date Oct 20, 2026 - before today)
  await prisma.invoice.create({
    data: {
      number: 'INV-000102',
      subscriptionId: confirmedSub.id,
      customerId: customers[1].id,
      customerName: customers[1].companyName,
      customerAddress: customers[1].address,
      periodStart: new Date('2026-10-01'),
      periodEnd: new Date('2026-10-31'),
      status: InvoiceStatus.CONFIRMED,
      subtotal: 200000,
      taxTotal: 36000,
      total: 236000, // ₹2,360.00
      amountPaid: 0,
      issueDate: new Date('2026-10-05'),
      dueDate: new Date('2026-10-20'), // OVERDUE!
      lines: {
        create: [
          {
            productId: erpProduct.id,
            description: 'Brightloop Business Suite x 1',
            quantity: 1,
            unitPrice: 200000,
            taxRateBps: 1800,
            taxAmount: 36000,
            amount: 200000,
          },
        ],
      },
    },
  });

  // INV-000103: CONFIRMED (Current / Outstanding, not yet overdue)
  await prisma.invoice.create({
    data: {
      number: 'INV-000103',
      subscriptionId: quoteSub.id,
      customerId: customers[2].id,
      customerName: customers[2].companyName,
      customerAddress: customers[2].address,
      periodStart: new Date('2026-10-15'),
      periodEnd: new Date('2026-11-14'),
      status: InvoiceStatus.CONFIRMED,
      subtotal: 100000,
      taxTotal: 18000,
      total: 118000, // ₹1,180.00
      amountPaid: 50000, // Partially paid
      issueDate: new Date('2026-10-25'),
      dueDate: new Date('2026-11-10'), // Outstanding
      lines: {
        create: [
          {
            productId: crmProduct.id,
            description: 'Brightloop CRM Add-on x 2',
            quantity: 2,
            unitPrice: 50000,
            taxRateBps: 1800,
            taxAmount: 18000,
            amount: 100000,
          },
        ],
      },
      payments: {
        create: [
          {
            method: PaymentMethod.BANK_TRANSFER,
            amount: 50000,
            paidOn: new Date('2026-10-26'),
            note: 'Advance partial payment - NEFT/88219',
          },
        ],
      },
    },
  });

  console.log('✅ Seeded Representative Subscriptions and Invoices (Paid, Confirmed, Overdue)');
  console.log('----------------------------------------------------');
  console.log('Demo Credentials:');
  console.log('  Admin:    admin@brightloop.test / Admin@1234');
  console.log('  Staff:    staff@brightloop.test / Staff@1234');
  console.log('  Customer: customer@brightloop.test / Customer@1234');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
