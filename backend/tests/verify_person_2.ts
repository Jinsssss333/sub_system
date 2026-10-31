import http from 'http';
import jwt from 'jsonwebtoken';
import { BillingPeriod, SubscriptionStatus } from '@prisma/client';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { addPeriod, addDays, calculatePeriodEnd } from '../src/utils/dates.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[VERIFICATION FAILED] ${message}`);
  }
}

async function request(
  serverUrl: string,
  method: string,
  path: string,
  token?: string,
  body?: any
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${serverUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function main() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING COMPREHENSIVE PERSON 2 VERIFICATION SUITE');
  console.log('======================================================\n');

  // --- PART 1: Date Clamping and Recovery Math ---
  console.log('▶ TEST 1: Date Clamping Math & Anchor Recovery');
  const jan31 = new Date('2026-01-31T00:00:00.000Z');
  const feb28 = addPeriod(jan31, BillingPeriod.MONTHLY, jan31);
  assert(
    feb28.toISOString().startsWith('2026-02-28'),
    `Jan 31 + 1 month should clamp to 2026-02-28, got ${feb28.toISOString()}`
  );

  const mar31 = addPeriod(feb28, BillingPeriod.MONTHLY, jan31);
  assert(
    mar31.toISOString().startsWith('2026-03-31'),
    `Feb 28 + 1 month with Jan 31 anchor should recover to 2026-03-31, got ${mar31.toISOString()}`
  );

  const apr30 = addPeriod(mar31, BillingPeriod.MONTHLY, jan31);
  assert(
    apr30.toISOString().startsWith('2026-04-30'),
    `March 31 + 1 month should clamp to 2026-04-30, got ${apr30.toISOString()}`
  );

  const may31 = addPeriod(apr30, BillingPeriod.MONTHLY, jan31);
  assert(
    may31.toISOString().startsWith('2026-05-31'),
    `April 30 + 1 month with anchor should recover to 2026-05-31, got ${may31.toISOString()}`
  );

  // Leap day recovery
  const leapDayAnchor = new Date('2024-02-29T00:00:00.000Z');
  const leap2025 = addPeriod(leapDayAnchor, BillingPeriod.YEARLY, leapDayAnchor);
  assert(leap2025.toISOString().startsWith('2025-02-28'), '2025 should clamp to Feb 28');
  const leap2028 = addPeriod(
    addPeriod(addPeriod(leap2025, BillingPeriod.YEARLY, leapDayAnchor), BillingPeriod.YEARLY, leapDayAnchor),
    BillingPeriod.YEARLY,
    leapDayAnchor
  );
  assert(leap2028.toISOString().startsWith('2028-02-29'), '2028 should recover leap day Feb 29');
  console.log('  ✔ Date clamping and anchor recovery math verified 100%');

  // --- PART 2: Database Setup & Seed Fixtures ---
  console.log('\n▶ TEST 2: Preparing Test Database Fixtures');
  // Clean test tables
  await prisma.payment.deleteMany({});
  await prisma.invoiceLine.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.subscriptionDiscount.deleteMany({});
  await prisma.subscriptionLine.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.quotationTemplateLine.deleteMany({});
  await prisma.quotationTemplate.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.plan.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.counter.deleteMany({});

  // 1. Create Users & Customers
  const userAdmin = await prisma.user.create({
    data: { email: 'admin@brightloop.test', passwordHash: 'hash', name: 'Admin User', role: 'ADMIN' },
  });
  const userStaff = await prisma.user.create({
    data: { email: 'staff@brightloop.test', passwordHash: 'hash', name: 'Staff User', role: 'STAFF' },
  });
  const userCust1 = await prisma.user.create({
    data: { email: 'cust1@brightloop.test', passwordHash: 'hash', name: 'Customer One', role: 'CUSTOMER' },
  });
  const customer1 = await prisma.customer.create({
    data: { userId: userCust1.id, companyName: 'Company A Corp', phone: '1234567890' },
  });

  const userCust2 = await prisma.user.create({
    data: { email: 'cust2@brightloop.test', passwordHash: 'hash', name: 'Customer Two', role: 'CUSTOMER' },
  });
  const customer2 = await prisma.customer.create({
    data: { userId: userCust2.id, companyName: 'Company B Inc', phone: '9876543210' },
  });

  // 2. Create Plans (Pausable/Renewable and Non-Pausable/Non-Renewable)
  const planStandard = await prisma.plan.create({
    data: {
      name: 'Standard Cloud Plan',
      price: 50000,
      billingPeriod: BillingPeriod.MONTHLY,
      minQuantity: 2, // Min quantity = 2 for edge case test!
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      pausable: true,
      renewable: true,
      closable: true,
      autoClose: false,
    },
  });

  const planRestricted = await prisma.plan.create({
    data: {
      name: 'Strict Enterprise Plan',
      price: 150000,
      billingPeriod: BillingPeriod.MONTHLY,
      minQuantity: 1,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      pausable: false, // NOT pausable
      renewable: false, // NOT renewable
      closable: false,
      autoClose: false,
    },
  });

  // 3. Create Products and Variants
  const productA = await prisma.product.create({
    data: {
      name: 'Brightloop Core Suite',
      type: 'service',
      salesPrice: 20000,
      costPrice: 5000,
      active: true,
    },
  });

  const variantA1 = await prisma.productVariant.create({
    data: {
      productId: productA.id,
      attribute: 'License Tier',
      value: 'Pro',
      extraPrice: 5600, // +₹56.00 extra price
    },
  });

  const productB = await prisma.product.create({
    data: {
      name: 'Addon Analytics',
      type: 'addon',
      salesPrice: 10000,
      costPrice: 2000,
      active: true,
    },
  });

  // Generate JWTs
  const adminToken = jwt.sign({ id: userAdmin.id, email: userAdmin.email, role: 'ADMIN' }, env.JWT_SECRET);
  const staffToken = jwt.sign({ id: userStaff.id, email: userStaff.email, role: 'STAFF' }, env.JWT_SECRET);
  const cust1Token = jwt.sign(
    { id: userCust1.id, email: userCust1.email, role: 'CUSTOMER', customerId: customer1.id },
    env.JWT_SECRET
  );
  const cust2Token = jwt.sign(
    { id: userCust2.id, email: userCust2.email, role: 'CUSTOMER', customerId: customer2.id },
    env.JWT_SECRET
  );
  console.log('  ✔ Database fixtures initialized');

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`  ✔ HTTP server running on ${baseUrl}`);

  try {
    // --- PART 3: Quotation Templates CRUD ---
    console.log('\n▶ TEST 3: Quotation Templates Module');

    // Negative: variant mismatch check
    const badVariantRes = await request(baseUrl, 'POST', '/api/templates', adminToken, {
      name: 'Invalid Template',
      planId: planStandard.id,
      validityDays: 15,
      lines: [
        {
          productId: productB.id,
          variantId: variantA1.id, // variantA1 belongs to productA, not productB!
          quantity: 2,
        },
      ],
    });
    assert(badVariantRes.status === 400, `Expected 400 on variant mismatch, got ${badVariantRes.status}`);
    console.log('  ✔ Variant integrity check (mismatch rejected) verified');

    // Create valid template
    const templateRes = await request(baseUrl, 'POST', '/api/templates', adminToken, {
      name: 'Standard Onboarding Quote',
      planId: planStandard.id,
      validityDays: 30,
      lines: [
        {
          productId: productA.id,
          variantId: variantA1.id,
          quantity: 5,
        },
      ],
    });
    assert(templateRes.status === 201, `Expected 201 creating template, got ${templateRes.status}`);
    const template = templateRes.body.data;
    assert(template.name === 'Standard Onboarding Quote', 'Template name mismatch');
    assert(template.lines.length === 1, 'Template line count mismatch');
    console.log(`  ✔ Created Quotation Template: ${template.name} (id: ${template.id})`);

    // List templates
    const listTemplatesRes = await request(baseUrl, 'GET', '/api/templates', staffToken);
    assert(listTemplatesRes.status === 200, `Expected 200 listing templates, got ${listTemplatesRes.status}`);
    assert(listTemplatesRes.body.data.length >= 1, 'Template list empty');
    console.log('  ✔ Templates listing verified');

    // --- PART 4: Subscriptions Creation (from template & sequential numbering) ---
    console.log('\n▶ TEST 4: Subscription Creation from Template & Sequential Numbering');
    const subFromTemplateRes = await request(baseUrl, 'POST', '/api/subscriptions', staffToken, {
      customerId: customer1.id,
      templateId: template.id,
      startDate: '2026-02-01T00:00:00.000Z',
    });
    assert(subFromTemplateRes.status === 201, `Expected 201, got ${subFromTemplateRes.status}`);
    const sub1 = subFromTemplateRes.body.data;
    assert(sub1.number === 'SUB-000001', `Expected number SUB-000001, got ${sub1.number}`);
    assert(sub1.status === SubscriptionStatus.DRAFT, `Expected status DRAFT, got ${sub1.status}`);
    assert(sub1.lines.length === 1, 'Expected 1 copied line item');
    assert(
      sub1.lines[0].unitPrice === 25600,
      `Expected unitPrice = salesPrice + extraPrice = 20000 + 5600 = 25600, got ${sub1.lines[0].unitPrice}`
    );
    assert(sub1.quotationExpiryDate !== null, 'Quotation expiry date must be set from validityDays');
    console.log(`  ✔ Subscription created from template: ${sub1.number} with unitPrice: ${sub1.lines[0].unitPrice} paise`);

    // Create 2nd subscription manually to verify sequential numbering
    const sub2Res = await request(baseUrl, 'POST', '/api/subscriptions', staffToken, {
      customerId: customer2.id,
      planId: planRestricted.id,
      lines: [{ productId: productB.id, quantity: 1 }],
    });
    assert(sub2Res.status === 201, `Expected 201, got ${sub2Res.status}`);
    assert(sub2Res.body.data.number === 'SUB-000002', `Expected SUB-000002, got ${sub2Res.body.data.number}`);
    console.log(`  ✔ Second subscription sequentially numbered: ${sub2Res.body.data.number}`);

    // --- PART 5: Edge Case 1 - Illegal State Jump ---
    console.log('\n▶ TEST 5: Edge Case 1 - Illegal State Jump Rejection');
    const jumpRes = await request(baseUrl, 'POST', `/api/subscriptions/${sub1.id}/transition`, staffToken, {
      to: 'ACTIVE', // DRAFT -> ACTIVE is illegal!
    });
    assert(jumpRes.status === 409, `Expected 409 Conflict on DRAFT -> ACTIVE jump, got ${jumpRes.status}`);
    console.log('  ✔ DRAFT -> ACTIVE illegal jump correctly rejected with HTTP 409');

    // --- PART 6: Edge Case 3 - Minimum Quantity Validation ---
    console.log('\n▶ TEST 6: Edge Case 3 - Minimum Quantity Validation');
    // Move sub1 DRAFT -> QUOTATION
    const toQuoteRes = await request(baseUrl, 'POST', `/api/subscriptions/${sub1.id}/transition`, staffToken, {
      to: 'QUOTATION',
    });
    assert(toQuoteRes.status === 200, `Expected 200 moving to QUOTATION, got ${toQuoteRes.status}`);
    console.log('  ✔ DRAFT -> QUOTATION transitioned successfully');

    // Create a sub with quantity 1 on planStandard (which requires minQuantity = 2)
    const lowQtySubRes = await request(baseUrl, 'POST', '/api/subscriptions', staffToken, {
      customerId: customer1.id,
      planId: planStandard.id,
      lines: [{ productId: productB.id, quantity: 1 }], // Below minQuantity 2!
    });
    const lowQtySub = lowQtySubRes.body.data;
    // Move to QUOTATION
    await request(baseUrl, 'POST', `/api/subscriptions/${lowQtySub.id}/transition`, staffToken, { to: 'QUOTATION' });
    // Attempt QUOTATION -> CONFIRMED with quantity < minQuantity
    const failMinQtyRes = await request(baseUrl, 'POST', `/api/subscriptions/${lowQtySub.id}/transition`, staffToken, {
      to: 'CONFIRMED',
    });
    assert(
      failMinQtyRes.status === 409,
      `Expected 409 Conflict when quantity < plan.minQuantity, got ${failMinQtyRes.status}`
    );
    console.log('  ✔ Quantity < plan.minQuantity correctly rejected with HTTP 409');

    // --- PART 7: Full State Machine Progression ---
    console.log('\n▶ TEST 7: Full Legal State Machine Progression');
    // sub1 has quantity 5 >= plan.minQuantity (2), so it should succeed
    const toConfirmRes = await request(baseUrl, 'POST', `/api/subscriptions/${sub1.id}/transition`, staffToken, {
      to: 'CONFIRMED',
    });
    assert(toConfirmRes.status === 200, `Expected 200 on QUOTATION -> CONFIRMED, got ${toConfirmRes.status}`);

    // CONFIRMED -> ACTIVE: side effect nextInvoiceDate = startDate
    const toActiveRes = await request(baseUrl, 'POST', `/api/subscriptions/${sub1.id}/transition`, staffToken, {
      to: 'ACTIVE',
    });
    assert(toActiveRes.status === 200, `Expected 200 on CONFIRMED -> ACTIVE, got ${toActiveRes.status}`);
    assert(
      toActiveRes.body.data.nextInvoiceDate !== null,
      'nextInvoiceDate must be set to startDate on ACTIVE transition'
    );
    console.log(`  ✔ Subscription activated: status = ACTIVE, nextInvoiceDate = ${toActiveRes.body.data.nextInvoiceDate}`);

    // --- PART 8: Edge Case 2 - Editing Post-Draft ---
    console.log('\n▶ TEST 8: Edge Case 2 - Post-Draft Editing Rejection');
    const editActiveRes = await request(baseUrl, 'PATCH', `/api/subscriptions/${sub1.id}`, staffToken, {
      paymentTermDays: 30,
    });
    assert(
      editActiveRes.status === 409,
      `Expected 409 Conflict editing ACTIVE subscription, got ${editActiveRes.status}`
    );
    console.log('  ✔ Editing post-draft subscription correctly rejected with HTTP 409');

    // --- PART 9: Lifecycle Actions: Pause, Resume, Renew ---
    console.log('\n▶ TEST 9: Lifecycle Actions: Pause, Resume, Renew');

    // 1. Pause on pausable plan
    const pauseRes = await request(baseUrl, 'POST', `/api/subscriptions/${sub1.id}/pause`, staffToken);
    assert(pauseRes.status === 200, `Expected 200 on pause, got ${pauseRes.status}`);
    assert(pauseRes.body.data.pausedAt !== null, 'pausedAt must be non-null');
    console.log('  ✔ Subscription paused successfully (pausedAt set)');

    // Attempting to pause already paused subscription -> 409
    const doublePauseRes = await request(baseUrl, 'POST', `/api/subscriptions/${sub1.id}/pause`, staffToken);
    assert(doublePauseRes.status === 409, 'Double pause must return 409');

    // 2. Resume
    const resumeRes = await request(baseUrl, 'POST', `/api/subscriptions/${sub1.id}/resume`, staffToken);
    assert(resumeRes.status === 200, `Expected 200 on resume, got ${resumeRes.status}`);
    assert(resumeRes.body.data.pausedAt === null, 'pausedAt must be cleared on resume');
    console.log('  ✔ Subscription resumed successfully (pausedAt cleared)');

    // 3. Pause on NON-pausable plan -> 409
    // Move sub2 to ACTIVE first
    await request(baseUrl, 'POST', `/api/subscriptions/${lowQtySub.id}/transition`, staffToken, { to: 'CONFIRMED' }); // wait, lowQtySub is low qty
    // Let's create an active sub on planRestricted
    const subRestrictedRes = await request(baseUrl, 'POST', '/api/subscriptions', staffToken, {
      customerId: customer2.id,
      planId: planRestricted.id,
      lines: [{ productId: productB.id, quantity: 2 }],
    });
    const subRestricted = subRestrictedRes.body.data;
    await request(baseUrl, 'POST', `/api/subscriptions/${subRestricted.id}/transition`, staffToken, { to: 'QUOTATION' });
    await request(baseUrl, 'POST', `/api/subscriptions/${subRestricted.id}/transition`, staffToken, { to: 'CONFIRMED' });
    await request(baseUrl, 'POST', `/api/subscriptions/${subRestricted.id}/transition`, staffToken, { to: 'ACTIVE' });

    const failPauseRes = await request(baseUrl, 'POST', `/api/subscriptions/${subRestricted.id}/pause`, staffToken);
    assert(failPauseRes.status === 409, `Expected 409 pausing non-pausable plan, got ${failPauseRes.status}`);
    console.log('  ✔ Pause on non-pausable plan correctly rejected with HTTP 409');

    // 4. Renew on renewable plan -> Clones into fresh DRAFT linked via renewedFromId
    const renewRes = await request(baseUrl, 'POST', `/api/subscriptions/${sub1.id}/renew`, staffToken);
    assert(renewRes.status === 201, `Expected 201 on renew, got ${renewRes.status}`);
    const renewedSub = renewRes.body.data;
    assert(renewedSub.status === SubscriptionStatus.DRAFT, 'Renewed subscription must be DRAFT');
    assert(renewedSub.renewedFromId === sub1.id, 'Renewed subscription must link to original via renewedFromId');
    assert(renewedSub.lines.length === sub1.lines.length, 'Renewed lines must be copied');

    // Verify original remains untouched
    const originalCheck = await request(baseUrl, 'GET', `/api/subscriptions/${sub1.id}`, staffToken);
    assert(originalCheck.body.data.status === SubscriptionStatus.ACTIVE, 'Original subscription must remain ACTIVE');
    console.log(`  ✔ Renewed subscription cloned: ${renewedSub.number} linked to ${sub1.number}; original untouched`);

    // 5. Renew on NON-renewable plan -> 409
    const failRenewRes = await request(baseUrl, 'POST', `/api/subscriptions/${subRestricted.id}/renew`, staffToken);
    assert(failRenewRes.status === 409, `Expected 409 renewing non-renewable plan, got ${failRenewRes.status}`);
    console.log('  ✔ Renew on non-renewable plan correctly rejected with HTTP 409');

    // --- PART 10: Edge Case 4 - Customer Isolation ---
    console.log('\n▶ TEST 10: Edge Case 4 - Customer Isolation Scoping');
    // Customer 1 querying Customer 1's subscription -> 200
    const ownSubRes = await request(baseUrl, 'GET', `/api/subscriptions/${sub1.id}`, cust1Token);
    assert(ownSubRes.status === 200, `Expected 200 for customer 1 on own sub, got ${ownSubRes.status}`);

    // Customer 1 querying Customer 2's subscription -> MUST RETURN 404 NOT FOUND
    const foreignSubRes = await request(baseUrl, 'GET', `/api/subscriptions/${subRestricted.id}`, cust1Token);
    assert(
      foreignSubRes.status === 404,
      `Expected 404 when Customer 1 queries Customer 2's subscription, got ${foreignSubRes.status}`
    );
    console.log('  ✔ Customer isolation verified: foreign subscription returned HTTP 404 Not Found');

    // Customer Portal: /api/me/subscriptions
    const mySubsRes = await request(baseUrl, 'GET', '/api/me/subscriptions', cust1Token);
    assert(mySubsRes.status === 200, `Expected 200 for /api/me/subscriptions, got ${mySubsRes.status}`);
    assert(
      mySubsRes.body.data.every((s: any) => s.customerId === customer1.id),
      'All subscriptions in /api/me/subscriptions must belong to customer 1'
    );
    console.log(`  ✔ Customer portal /api/me/subscriptions returned ${mySubsRes.body.data.length} scoped subscriptions`);

    // Customer Portal: /api/me/subscriptions/:id (Customer-owned detail)
    const mySubDetailRes = await request(baseUrl, 'GET', `/api/me/subscriptions/${sub1.id}`, cust1Token);
    assert(mySubDetailRes.status === 200, `Expected 200 for /api/me/subscriptions/${sub1.id}, got ${mySubDetailRes.status}`);
    assert(mySubDetailRes.body.data.id === sub1.id, 'Expected customer detail to return matching subscription');
    
    // Invariant: Never expose product cost prices in customer payloads
    for (const line of mySubDetailRes.body.data.lines) {
      assert(line.product.costPrice === undefined, 'Security Invariant: product costPrice must NEVER be exposed in customer payloads');
    }
    console.log('  ✔ Customer portal detail /api/me/subscriptions/:id verified (costPrice hidden)');

    // Foreign customer accessing /api/me/subscriptions/:id returns 404
    const foreignMeDetailRes = await request(baseUrl, 'GET', `/api/me/subscriptions/${subRestricted.id}`, cust1Token);
    assert(foreignMeDetailRes.status === 404, `Expected 404 on /api/me/subscriptions/:id for foreign sub, got ${foreignMeDetailRes.status}`);
    console.log('  ✔ Customer portal /api/me/subscriptions/:id customer isolation verified (404)');

    // --- PART 11: Person 3 Shared Helper Functions ---
    console.log('\n▶ TEST 11: Person 3 Helper Function Signatures (nextPeriod & number)');
    const { nextPeriod } = await import('../src/utils/dates.js');
    const { number } = await import('../src/utils/numbering.js');
    const testNextPeriod = nextPeriod(new Date('2026-01-31T00:00:00.000Z'), 'MONTHLY', new Date('2026-01-31T00:00:00.000Z'));
    assert(testNextPeriod.toISOString().startsWith('2026-02-28'), 'nextPeriod should clamp Jan 31 to Feb 28');
    
    const invoiceNumber = await prisma.$transaction(async (tx) => {
      return number(tx, 'INV');
    });
    assert(invoiceNumber.startsWith('INV-'), `Expected INV- prefix, got ${invoiceNumber}`);
    console.log(`  ✔ Shared helpers nextPeriod and number verified (generated ${invoiceNumber})`);

    // --- PART 12: Active -> Closed Transition ---
    console.log('\n▶ TEST 12: Closing Subscription (Clears nextInvoiceDate)');
    const toClosedRes = await request(baseUrl, 'POST', `/api/subscriptions/${sub1.id}/transition`, staffToken, {
      to: 'CLOSED',
    });
    assert(toClosedRes.status === 200, `Expected 200 on ACTIVE -> CLOSED, got ${toClosedRes.status}`);
    assert(toClosedRes.body.data.nextInvoiceDate === null, 'nextInvoiceDate must be cleared on CLOSED');
    console.log('  ✔ Closed subscription cleared nextInvoiceDate');

    console.log('\n======================================================');
    console.log('🎉 ALL 12 VERIFICATION TESTS PASSED SUCCESSFULLY! 100%');
    console.log('======================================================\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
