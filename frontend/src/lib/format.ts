import { formatINR, rupeesToPaise } from '@brightloop/shared';

export { formatINR, rupeesToPaise };

/** Paise → editable rupee string ("1499.50"). */
export const paiseToRupeeInput = (paise: number) => (paise / 100).toFixed(2);

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (value: string | Date | null | undefined) => (value ? dateFmt.format(new Date(value)) : '—');
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const bpsToPercent = (bps: number) => `${(bps / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
export const titleCase = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const periodLabel: Record<string, string> = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' };
export const isOverdue = (invoice: { status: string; dueDate: string }) => invoice.status === 'CONFIRMED' && new Date(invoice.dueDate) < new Date(todayIso());

/** Short Indian-style label for chart axes: ₹1.85 Cr, ₹96.4 L, ₹12.5K. Display only. */
export function compactINR(paise: number): string {
  const rupees = paise / 100;
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 });
  if (Math.abs(rupees) >= 1e7) return `₹${fmt(rupees / 1e7)} Cr`;
  if (Math.abs(rupees) >= 1e5) return `₹${fmt(rupees / 1e5)} L`;
  if (Math.abs(rupees) >= 1e3) return `₹${fmt(rupees / 1e3)}K`;
  return `₹${fmt(rupees)}`;
}

const METHOD_LABELS: Record<string, string> = { CASH: 'Cash', CARD: 'Card', UPI: 'UPI', BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque' };
export const methodLabel = (method: string) => METHOD_LABELS[method] ?? titleCase(method);
