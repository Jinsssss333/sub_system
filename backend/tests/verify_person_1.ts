import http from 'http';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

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
  console.log('🚀 RUNNING COMPREHENSIVE PERSON 1 VERIFICATION SUITE');
  console.log('   (Identity, Catalog, Roles & Integration)');
  console.log('======================================================\n');

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`  ✔ HTTP server running on ${baseUrl}`);

  let createdStaffUserId: string | null = null;
  let createdCustomerId: string | null = null;
  let createdCustomerUserId: string | null = null;
  let createdProductId: string | null = null;
  let createdPlanId: string | null = null;
  let createdTaxId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Seeded Accounts Login & Invalid Login Handling
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 1: Seeded Accounts Login & Credentials Check');

    // 1a. Admin login
    const adminLoginRes = await request(baseUrl, 'POST', '/api/auth/login', undefined, {
      email: 'admin@brightloop.test',
      password: 'Admin@1234',
    });
    assert(adminLoginRes.status === 200, `Admin login failed with status ${adminLoginRes.status}`);
    assert(adminLoginRes.body.data?.token, 'Admin login response missing token');
    assert(adminLoginRes.body.data?.user?.role === 'ADMIN', 'Admin role mismatch');
    assert(!adminLoginRes.body.data?.user?.passwordHash, 'Password hash leaked in login response!');
    const adminToken = adminLoginRes.body.data.token;
    console.log('  ✔ Admin login successful');

    // 1b. Staff login
    const staffLoginRes = await request(baseUrl, 'POST', '/api/auth/login', undefined, {
      email: 'staff@brightloop.test',
      password: 'Staff@1234',
    });
    assert(staffLoginRes.status === 200, `Staff login failed with status ${staffLoginRes.status}`);
    assert(staffLoginRes.body.data?.user?.role === 'STAFF', 'Staff role mismatch');
    const staffToken = staffLoginRes.body.data.token;
    console.log('  ✔ Staff login successful');

    // 1c. Customer login
    const customerLoginRes = await request(baseUrl, 'POST', '/api/auth/login', undefined, {
      email: 'customer@brightloop.test',
      password: 'Customer@1234',
    });
    assert(customerLoginRes.status === 200, `Customer login failed with status ${customerLoginRes.status}`);
    assert(customerLoginRes.body.data?.user?.role === 'CUSTOMER', 'Customer role mismatch');
    assert(customerLoginRes.body.data?.user?.customerId, 'Customer login missing customerId');
    const customerToken = customerLoginRes.body.data.token;
    const customerId = customerLoginRes.body.data.user.customerId;
    console.log('  ✔ Customer login successful');

    // 1d. Negative: wrong password
    const wrongPassRes = await request(baseUrl, 'POST', '/api/auth/login', undefined, {
      email: 'admin@brightloop.test',
      password: 'WrongPassword@999',
    });
    assert(wrongPassRes.status === 401, `Expected 401 for wrong password, got ${wrongPassRes.status}`);
    console.log('  ✔ Invalid credentials cleanly rejected with 401');

    // -------------------------------------------------------------------------
    // TEST 2: Current User Endpoint (GET /api/auth/me)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 2: Current User Profile (GET /api/auth/me)');
    const meRes = await request(baseUrl, 'GET', '/api/auth/me', customerToken);
    assert(meRes.status === 200, `GET /api/auth/me failed with status ${meRes.status}`);
    assert(meRes.body.data?.email === 'customer@brightloop.test', 'User email mismatch in /me');
    assert(meRes.body.data?.role === 'CUSTOMER', 'User role mismatch in /me');
    assert(meRes.body.data?.customer?.id === customerId, 'Customer profile mismatch in /me');
    assert(!meRes.body.data?.passwordHash, 'Password hash leaked in /me');
    console.log('  ✔ GET /api/auth/me verified');

    // -------------------------------------------------------------------------
    // TEST 3: Role Boundaries & Customer Isolation
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 3: Role Boundaries & Security Guards');

    // 3a. Customer cannot create a product (Admin only)
    const custCreateProdRes = await request(baseUrl, 'POST', '/api/products', customerToken, {
      name: 'Hacked Product',
      type: 'HARDWARE',
      salesPrice: 1000,
      costPrice: 500,
    });
    assert(
      custCreateProdRes.status === 403,
      `Customer should receive 403 on POST /api/products, got ${custCreateProdRes.status}`
    );
    console.log('  ✔ Customer blocked from product creation (403 Forbidden)');

    // 3b. Customer cannot list other customers (Staff/Admin only)
    const custListCustRes = await request(baseUrl, 'GET', '/api/customers', customerToken);
    assert(
      custListCustRes.status === 403,
      `Customer should receive 403 on GET /api/customers, got ${custListCustRes.status}`
    );
    console.log('  ✔ Customer blocked from listing customers (403 Forbidden)');

    // 3c. Customer cannot list users (Admin only)
    const custListUsersRes = await request(baseUrl, 'GET', '/api/users', customerToken);
    assert(
      custListUsersRes.status === 403,
      `Customer should receive 403 on GET /api/users, got ${custListUsersRes.status}`
    );
    console.log('  ✔ Customer blocked from listing users (403 Forbidden)');

    // 3d. Customer accessing another customer's record returns 404 (isolation)
    const otherCustRes = await request(
      baseUrl,
      'GET',
      '/api/customers/00000000-0000-0000-0000-000000000000',
      customerToken
    );
    assert(
      otherCustRes.status === 404,
      `Customer accessing another customer should return 404, got ${otherCustRes.status}`
    );
    console.log('  ✔ Cross-customer isolation enforced (404 Not Found)');

    // 3e. Customer can view their own profile
    const ownCustRes = await request(baseUrl, 'GET', `/api/customers/${customerId}`, customerToken);
    assert(
      ownCustRes.status === 200,
      `Customer viewing own profile should return 200, got ${ownCustRes.status}`
    );
    assert(ownCustRes.body.data?.id === customerId, 'Profile ID mismatch');
    console.log('  ✔ Customer can access own customer profile (200 OK)');

    // -------------------------------------------------------------------------
    // TEST 4: Customer Management (Staff / Admin)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 4: Customer Management Operations');

    // 4a. Staff lists customers
    const staffListCustRes = await request(baseUrl, 'GET', '/api/customers?page=1&pageSize=5', staffToken);
    assert(staffListCustRes.status === 200, `Staff listing customers failed: ${staffListCustRes.status}`);
    assert(Array.isArray(staffListCustRes.body.data), 'Expected array in data');
    assert(staffListCustRes.body.meta?.total >= 5, `Expected at least 5 customers, got ${staffListCustRes.body.meta?.total}`);
    assert(staffListCustRes.body.meta?.pageSize === 5, 'Page size mismatch');
    console.log('  ✔ Staff can list customers with pagination');

    // 4b. Staff creates a new customer (must return Customer ID)
    const newCustomerRes = await request(baseUrl, 'POST', '/api/customers', staffToken, {
      name: 'Wayne Enterprises Contact',
      companyName: 'Wayne Enterprises Pvt Ltd',
      email: 'contact@waynecorp.test',
      phone: '+91 9999911111',
      address: '100 Wayne Plaza, Gotham',
    });
    assert(newCustomerRes.status === 201, `Customer creation failed: ${newCustomerRes.status}`);
    assert(newCustomerRes.body.data?.id, 'Customer creation did not return customer ID');
    assert(newCustomerRes.body.data?.companyName === 'Wayne Enterprises Pvt Ltd', 'Company name mismatch');
    assert(newCustomerRes.body.data?.user?.email === 'contact@waynecorp.test', 'User email mismatch');
    createdCustomerId = newCustomerRes.body.data.id;
    createdCustomerUserId = newCustomerRes.body.data.user.id;
    console.log(`  ✔ Staff created customer returning customer ID: ${createdCustomerId}`);

    // 4c. Duplicate customer email fails with 409
    const dupCustomerRes = await request(baseUrl, 'POST', '/api/customers', staffToken, {
      name: 'Duplicate Wayne',
      email: 'contact@waynecorp.test',
    });
    assert(dupCustomerRes.status === 409, `Expected 409 for duplicate email, got ${dupCustomerRes.status}`);
    console.log('  ✔ Duplicate customer email rejected with 409 Conflict');

    // -------------------------------------------------------------------------
    // TEST 5: Products & Variants Catalog
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 5: Products & Variants Management');

    // 5a. Staff loads catalog
    const staffCatalogRes = await request(baseUrl, 'GET', '/api/products', staffToken);
    assert(staffCatalogRes.status === 200, `Staff loading catalog failed: ${staffCatalogRes.status}`);
    assert(Array.isArray(staffCatalogRes.body.data), 'Products data should be an array');
    console.log('  ✔ Staff can read product catalog');

    // 5b. Staff cannot create products (Admin only)
    const staffCreateProdRes = await request(baseUrl, 'POST', '/api/products', staffToken, {
      name: 'Staff Suite',
      type: 'SOFTWARE',
      salesPrice: 50000,
      costPrice: 20000,
    });
    assert(
      staffCreateProdRes.status === 403,
      `Staff should be forbidden from creating products, got ${staffCreateProdRes.status}`
    );
    console.log('  ✔ Staff blocked from creating products (403 Forbidden)');

    // 5c. Admin creates a new product
    const adminCreateProdRes = await request(baseUrl, 'POST', '/api/products', adminToken, {
      name: 'Brightloop Analytics Suite',
      type: 'SOFTWARE',
      salesPrice: 120000, // ₹1,200.00
      costPrice: 40000,  // ₹400.00
      notes: 'Real-time telemetry and reporting service',
    });
    assert(adminCreateProdRes.status === 201, `Admin product creation failed: ${adminCreateProdRes.status}`);
    assert(adminCreateProdRes.body.data?.id, 'Missing product ID');
    createdProductId = adminCreateProdRes.body.data.id;
    console.log(`  ✔ Admin created product: ${createdProductId}`);

    // 5d. Admin creates Odoo variant with exactly +56,000 paise (₹560)
    const odooVariantRes = await request(
      baseUrl,
      'POST',
      `/api/products/${createdProductId}/variants`,
      adminToken,
      {
        attribute: 'Integration',
        value: 'Odoo Connector',
        extraPrice: 56000, // ₹560.00 exactly
      }
    );
    assert(odooVariantRes.status === 201, `Variant creation failed: ${odooVariantRes.status}`);
    assert(
      odooVariantRes.body.data?.extraPrice === 56000,
      `Expected extraPrice 56000 paise, got ${odooVariantRes.body.data?.extraPrice}`
    );
    console.log('  ✔ Admin created Odoo variant with exactly 56000 paise (+₹560)');

    // 5e. Duplicate variant rejected with 409
    const dupVariantRes = await request(
      baseUrl,
      'POST',
      `/api/products/${createdProductId}/variants`,
      adminToken,
      {
        attribute: 'Integration',
        value: 'Odoo Connector',
        extraPrice: 56000,
      }
    );
    assert(dupVariantRes.status === 409, `Expected 409 for duplicate variant, got ${dupVariantRes.status}`);
    console.log('  ✔ Duplicate variant rejected with 409 Conflict');

    // 5f. Verify variants are included in product query
    const productDetailRes = await request(baseUrl, 'GET', `/api/products/${createdProductId}`, staffToken);
    assert(productDetailRes.status === 200, 'Failed to fetch product with variants');
    assert(
      productDetailRes.body.data?.variants?.some((v: any) => v.value === 'Odoo Connector'),
      'Product does not include created variant'
    );
    console.log('  ✔ Product query includes variants list');

    // -------------------------------------------------------------------------
    // TEST 6: Plans Management
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 6: Plans Management');

    // 6a. Staff reads plans
    const staffPlansRes = await request(baseUrl, 'GET', '/api/plans', staffToken);
    assert(staffPlansRes.status === 200, `Staff reading plans failed: ${staffPlansRes.status}`);
    assert(Array.isArray(staffPlansRes.body.data), 'Expected array of plans');
    console.log('  ✔ Staff can list subscription plans');

    // 6b. Admin creates a new plan
    const adminPlanRes = await request(baseUrl, 'POST', '/api/plans', adminToken, {
      name: 'Enterprise Cloud Quarterly',
      price: 600000, // ₹6,000.00
      billingPeriod: 'MONTHLY',
      minQuantity: 2,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
      autoClose: true,
      closable: true,
      pausable: false,
      renewable: true,
    });
    assert(adminPlanRes.status === 201, `Plan creation failed: ${adminPlanRes.status}`);
    assert(adminPlanRes.body.data?.id, 'Missing plan ID');
    assert(adminPlanRes.body.data?.price === 600000, 'Plan price mismatch');
    createdPlanId = adminPlanRes.body.data.id;
    console.log(`  ✔ Admin created plan: ${createdPlanId}`);

    // 6c. Negative: endDate before startDate fails validation
    const badPlanRes = await request(baseUrl, 'POST', '/api/plans', adminToken, {
      name: 'Invalid Date Plan',
      price: 100000,
      billingPeriod: 'MONTHLY',
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-01-01T00:00:00.000Z',
    });
    assert(badPlanRes.status === 400, `Expected 400 on invalid plan dates, got ${badPlanRes.status}`);
    console.log('  ✔ Invalid plan dates rejected with 400 Validation Error');

    // -------------------------------------------------------------------------
    // TEST 7: Taxes Management
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 7: Taxes Module (GST 18% = 1800 bps)');

    // 7a. Verify seeded GST 18% exists
    const taxesListRes = await request(baseUrl, 'GET', '/api/taxes', staffToken);
    assert(taxesListRes.status === 200, `Taxes list failed: ${taxesListRes.status}`);
    const gst18 = taxesListRes.body.data?.find((t: any) => t.rateBps === 1800);
    assert(gst18, 'GST 18% (1800 bps) not found in taxes list');
    console.log(`  ✔ Verified GST 18% tax exists with rateBps: ${gst18.rateBps}`);

    // 7b. Admin creates a new custom tax
    const adminTaxRes = await request(baseUrl, 'POST', '/api/taxes', adminToken, {
      name: 'Swachh Bharat Cess 0.5%',
      rateBps: 50,
      active: true,
    });
    assert(adminTaxRes.status === 201, `Tax creation failed: ${adminTaxRes.status}`);
    createdTaxId = adminTaxRes.body.data.id;
    console.log(`  ✔ Admin created tax: ${createdTaxId}`);

    // 7c. Negative: tax rate > 10000 bps rejected
    const badTaxRes = await request(baseUrl, 'POST', '/api/taxes', adminToken, {
      name: 'Impossible Tax',
      rateBps: 15000,
    });
    assert(badTaxRes.status === 400, `Expected 400 on tax > 10000 bps, got ${badTaxRes.status}`);
    console.log('  ✔ Invalid tax rate > 10000 bps rejected with 400');

    // -------------------------------------------------------------------------
    // TEST 8: Users & Staff Management
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 8: Users & Staff Management');

    // 8a. Staff blocked from viewing all users
    const staffUsersRes = await request(baseUrl, 'GET', '/api/users', staffToken);
    assert(staffUsersRes.status === 403, `Staff should get 403 on /api/users, got ${staffUsersRes.status}`);
    console.log('  ✔ Staff blocked from viewing all users (403 Forbidden)');

    // 8b. Admin views all users
    const adminUsersRes = await request(baseUrl, 'GET', '/api/users', adminToken);
    assert(adminUsersRes.status === 200, `Admin listing users failed: ${adminUsersRes.status}`);
    assert(Array.isArray(adminUsersRes.body.data), 'Expected array in users list');
    console.log('  ✔ Admin can list users');

    // 8c. Admin creates a staff member
    const newStaffRes = await request(baseUrl, 'POST', '/api/users/staff', adminToken, {
      name: 'Diana Prince',
      email: 'diana.staff@brightloop.test',
      password: 'Staff@1234Secure',
    });
    assert(newStaffRes.status === 201, `Staff creation failed: ${newStaffRes.status}`);
    assert(newStaffRes.body.data?.role === 'STAFF', 'Created user is not STAFF');
    assert(!newStaffRes.body.data?.passwordHash, 'Password hash leaked in staff creation');
    createdStaffUserId = newStaffRes.body.data.id;
    console.log(`  ✔ Admin created staff member: ${createdStaffUserId}`);

    // 8d. Newly created staff can log in
    const newStaffLoginRes = await request(baseUrl, 'POST', '/api/auth/login', undefined, {
      email: 'diana.staff@brightloop.test',
      password: 'Staff@1234Secure',
    });
    assert(newStaffLoginRes.status === 200, `New staff login failed: ${newStaffLoginRes.status}`);
    assert(newStaffLoginRes.body.data?.user?.role === 'STAFF', 'Role mismatch for new staff');
    console.log('  ✔ Newly created staff member logged in successfully');

    console.log('\n======================================================');
    console.log('🎉 ALL PERSON 1 VERIFICATION CHECKS PASSED (100%)!');
    console.log('======================================================\n');
  } finally {
    // Cleanup test artifacts
    console.log('🧹 Cleaning up test records...');
    if (createdProductId) {
      await prisma.productVariant.deleteMany({ where: { productId: createdProductId } });
      await prisma.product.delete({ where: { id: createdProductId } }).catch(() => {});
    }
    if (createdPlanId) {
      await prisma.plan.delete({ where: { id: createdPlanId } }).catch(() => {});
    }
    if (createdTaxId) {
      await prisma.tax.delete({ where: { id: createdTaxId } }).catch(() => {});
    }
    if (createdCustomerId) {
      await prisma.customer.delete({ where: { id: createdCustomerId } }).catch(() => {});
    }
    if (createdCustomerUserId) {
      await prisma.user.delete({ where: { id: createdCustomerUserId } }).catch(() => {});
    }
    if (createdStaffUserId) {
      await prisma.user.delete({ where: { id: createdStaffUserId } }).catch(() => {});
    }
    console.log('✔ Cleanup complete.');

    server.close();
  }
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION TEST RUN FAILED:', err);
  process.exit(1);
});

