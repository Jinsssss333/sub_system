/**
 * Measures API latency against the seeded database (run `npm run db:seed` first).
 *   npm run bench               -> 50 samples per endpoint after 5 warm-up calls
 *   BENCH_SAMPLES=200 npm run bench
 * Fails (exit 1) if any endpoint's p95 is 2,000 ms or more.
 */
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

const SAMPLES = Number(process.env.BENCH_SAMPLES ?? 50);
const WARMUP = 5;
const BUDGET_MS = 2_000;

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

async function token(email: string, password: string) {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error(`Login failed for ${email}; did you run npm run db:seed?`);
  return ((await res.json()) as { data: { token: string } }).data.token;
}

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function measure(label: string, path: string, auth: string) {
  const time = async () => {
    const started = performance.now();
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${auth}` } });
    await res.arrayBuffer();
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
    return performance.now() - started;
  };
  for (let i = 0; i < WARMUP; i += 1) await time();
  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) samples.push(await time());
  samples.sort((a, b) => a - b);
  return { label, path, n: samples.length, p50: percentile(samples, 50), p95: percentile(samples, 95), max: samples[samples.length - 1] };
}

try {
  const [subs, invoices, payments] = await Promise.all([prisma.subscription.count(), prisma.invoice.count(), prisma.payment.count()]);
  const admin = await token('admin@brightloop.test', 'Admin@1234');
  const customer = await token('customer@brightloop.test', 'Customer@1234');
  const results = [];
  results.push(await measure('Subscriptions, page 1', '/subscriptions?page=1&pageSize=20', admin));
  results.push(await measure('Subscriptions, last page', `/subscriptions?page=${Math.ceil(subs / 20)}&pageSize=20`, admin));
  results.push(await measure('Subscriptions, search', '/subscriptions?q=Lotus&page=1&pageSize=20', admin));
  results.push(await measure('Subscriptions, ACTIVE filter', '/subscriptions?status=ACTIVE&page=1&pageSize=20', admin));
  results.push(await measure('Invoices, page 1', '/invoices?page=1&pageSize=20', admin));
  results.push(await measure('Invoices, last page', `/invoices?page=${Math.ceil(invoices / 20)}&pageSize=20`, admin));
  results.push(await measure('Invoices, search', '/invoices?q=INV-0100&page=1&pageSize=20', admin));
  results.push(await measure('Payments ledger', '/payments?page=1&pageSize=20', admin));
  results.push(await measure('Customers', '/customers?page=1&pageSize=20', admin));
  results.push(await measure('Finance summary', '/reports/summary', admin));
  results.push(await measure('Overdue invoices', '/reports/overdue?page=1&pageSize=20', admin));
  results.push(await measure('Customer: my subscriptions', '/me/subscriptions?page=1&pageSize=20', customer));
  results.push(await measure('Customer: my invoices', '/me/invoices?page=1&pageSize=20', customer));

  console.log(`\nDataset: ${subs} subscriptions, ${invoices} invoices, ${payments} payments. ${SAMPLES} samples per endpoint after ${WARMUP} warm-up calls.\n`);
  console.log('| Endpoint | n | p50 (ms) | p95 (ms) | max (ms) |');
  console.log('| --- | ---: | ---: | ---: | ---: |');
  for (const r of results) console.log(`| ${r.label} \`${r.path}\` | ${r.n} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.max.toFixed(1)} |`);
  const slow = results.filter((r) => r.p95 >= BUDGET_MS);
  if (slow.length) {
    console.error(`\n${slow.length} endpoint(s) exceeded the ${BUDGET_MS} ms p95 budget.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll endpoints within the ${BUDGET_MS} ms budget.`);
  }
} finally {
  server.close();
  await prisma.$disconnect();
}
