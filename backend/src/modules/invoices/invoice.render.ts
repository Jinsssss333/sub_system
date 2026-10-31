import { escapeHtml } from '../../utils/html.js';

export const formatPaise = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

const day = (value: Date) => value.toISOString().slice(0, 10);

interface PrintableInvoice {
  number: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  customer: { companyName: string | null; address: string | null; user: { name: string; email: string } };
  subscription: { number: string };
  lines: Array<{ description: string; quantity: number; unitPrice: number; discountAmount: number; taxRateBps: number; taxAmount: number; amount: number }>;
  payments: Array<{ paidOn: Date; method: string; amount: number }>;
}

/** Self-contained, print-ready invoice. All dynamic text passes through escapeHtml. */
export function renderInvoiceHtml(invoice: PrintableInvoice): string {
  const e = escapeHtml;
  const rows = invoice.lines
    .map(
      (line) => `<tr><td>${e(line.description)}</td><td class="num">${e(line.quantity)}</td><td class="num">${e(formatPaise(line.unitPrice))}</td><td class="num">${e(formatPaise(line.discountAmount))}</td><td class="num">${e((line.taxRateBps / 100).toFixed(2))}%</td><td class="num">${e(formatPaise(line.taxAmount))}</td><td class="num">${e(formatPaise(line.amount))}</td></tr>`,
    )
    .join('');
  const payments = invoice.payments.length
    ? `<h2>Payments</h2><table><thead><tr><th>Date</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>${invoice.payments
        .map((p) => `<tr><td>${e(day(p.paidOn))}</td><td>${e(p.method.replace('_', ' '))}</td><td class="num">${e(formatPaise(p.amount))}</td></tr>`)
        .join('')}</tbody></table>`
    : '';
  const customerName = invoice.customer.companyName ?? invoice.customer.user.name;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Invoice ${e(invoice.number)}</title>
<style>
  *{box-sizing:border-box} body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;margin:0;padding:40px;background:#fff}
  .sheet{max-width:820px;margin:0 auto} header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:24px}
  .brand{font-size:20px;font-weight:700;color:#4f46e5} h1{font-size:22px;margin:0} h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin:28px 0 8px}
  .muted{color:#64748b} .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px}
  table{width:100%;border-collapse:collapse} th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top} th{font-size:12px;color:#475569;text-transform:uppercase}
  .num{text-align:right;font-variant-numeric:tabular-nums} .totals{margin-left:auto;width:320px;margin-top:16px} .totals td{border:0;padding:4px 8px} .grand td{font-weight:700;font-size:16px;border-top:2px solid #0f172a}
  .badge{display:inline-block;padding:2px 10px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:12px;font-weight:600}
  @media print{body{padding:0} .noprint{display:none}}
</style></head>
<body><div class="sheet">
<header><div><div class="brand">Brightloop</div><div class="muted">Subscription Billing</div></div>
<div style="text-align:right"><h1>Invoice ${e(invoice.number)}</h1><span class="badge">${e(invoice.status)}</span></div></header>
<div class="meta">
  <div><h2>Billed to</h2><strong>${e(customerName)}</strong><br>${e(invoice.customer.user.email)}<br>${e(invoice.customer.address ?? '')}</div>
  <div><h2>Details</h2>Subscription: ${e(invoice.subscription.number)}<br>Period: ${e(day(invoice.periodStart))} to ${e(day(invoice.periodEnd))}<br>Issued: ${e(day(invoice.issueDate))}<br>Due: ${e(day(invoice.dueDate))}</div>
</div>
<h2>Items</h2>
<table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Discount</th><th class="num">Tax rate</th><th class="num">Tax</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals"><tbody>
<tr><td>Subtotal</td><td class="num">${e(formatPaise(invoice.subtotal))}</td></tr>
<tr><td>Discount</td><td class="num">−${e(formatPaise(invoice.discountTotal))}</td></tr>
<tr><td>Tax</td><td class="num">${e(formatPaise(invoice.taxTotal))}</td></tr>
<tr class="grand"><td>Total</td><td class="num">${e(formatPaise(invoice.total))}</td></tr>
<tr><td>Paid</td><td class="num">${e(formatPaise(invoice.amountPaid))}</td></tr>
<tr><td><strong>Balance due</strong></td><td class="num"><strong>${e(formatPaise(invoice.total - invoice.amountPaid))}</strong></td></tr>
</tbody></table>
${payments}
</div></body></html>`;
}
