import { describe, expect, it } from 'vitest';
import { calculateInvoicePricing, calculateTaxAmount, roundHalfUp } from '../src/utils/pricing.js';
import { addPeriod, calculatePeriodEnd } from '../src/utils/dates.js';

const line = (id: string, unitPrice: number, quantity = 1, taxRateBps = 0, productId = id) => ({ id, productId, quantity, unitPrice, taxRateBps });

describe('pricing (pure)', () => {
  it('rounds exact halves up and everything else to nearest', () => {
    expect(roundHalfUp(5n, 10n)).toBe(1n);
    expect(roundHalfUp(4n, 10n)).toBe(0n);
    expect(calculateTaxAmount(25, 1800)).toBe(5); // 4.5 -> 5
    expect(calculateTaxAmount(24, 1800)).toBe(4); // 4.32 -> 4
  });

  it('applies a product discount only to matching lines', () => {
    const result = calculateInvoicePricing([line('a', 10_000), line('b', 10_000)], [{ id: 'd', scope: 'PRODUCT', type: 'PERCENT', value: 5000, productIds: ['a'] }]);
    expect(result.lines.map((l) => l.discountAmount)).toEqual([5_000, 0]);
    expect(result.total).toBe(15_000);
  });

  it('applies PRODUCT discounts before SUBSCRIPTION discounts regardless of input order', () => {
    const discounts = [
      { id: 'z-sub', scope: 'SUBSCRIPTION' as const, type: 'PERCENT' as const, value: 1000 },
      { id: 'a-prod', scope: 'PRODUCT' as const, type: 'FIXED' as const, value: 2_000, productIds: ['a'] },
    ];
    const forward = calculateInvoicePricing([line('a', 10_000)], discounts);
    const reverse = calculateInvoicePricing([line('a', 10_000)], [...discounts].reverse());
    // 10,000 - 2,000 = 8,000; then 10% = 800 -> discount 2,800
    expect(forward.discountTotal).toBe(2_800);
    expect(reverse).toEqual(forward);
    expect(forward.appliedDiscountIds).toEqual(['a-prod', 'z-sub']);
  });

  it('never discounts below zero and taxes the net amount', () => {
    const result = calculateInvoicePricing([line('a', 1_000, 1, 1800)], [{ id: 'd', scope: 'SUBSCRIPTION', type: 'FIXED', value: 5_000 }]);
    expect(result.discountTotal).toBe(1_000);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it('skips discounts whose minimum purchase or quantity is not met', () => {
    const minPurchase = calculateInvoicePricing([line('a', 1_000)], [{ id: 'd', scope: 'SUBSCRIPTION', type: 'FIXED', value: 100, minPurchase: 2_000 }]);
    expect(minPurchase.discountTotal).toBe(0);
    expect(minPurchase.appliedDiscountIds).toEqual([]);
    const minQty = calculateInvoicePricing([line('a', 1_000, 2)], [{ id: 'd', scope: 'SUBSCRIPTION', type: 'FIXED', value: 100, minQuantity: 3 }]);
    expect(minQty.discountTotal).toBe(0);
  });

  it('keeps totals consistent: subtotal - discount + tax = total, and lines sum to totals', () => {
    const result = calculateInvoicePricing(
      [line('a', 33_333, 3, 1800), line('b', 7_777, 1, 500), line('c', 1, 7, 1200)],
      [{ id: 's', scope: 'SUBSCRIPTION', type: 'PERCENT', value: 333 }],
    );
    expect(result.subtotal - result.discountTotal + result.taxTotal).toBe(result.total);
    expect(result.lines.reduce((sum, l) => sum + l.amount, 0)).toBe(result.total);
  });

  it('rejects invalid inputs instead of silently mis-pricing', () => {
    expect(() => calculateInvoicePricing([], [])).toThrow();
    expect(() => calculateInvoicePricing([line('a', 1.5)], [])).toThrow();
    expect(() => calculateInvoicePricing([line('a', 100, 0)], [])).toThrow();
    expect(() => calculateInvoicePricing([line('a', 100, 1, 10_001)], [])).toThrow();
    expect(() => calculateInvoicePricing([line('a', 2_000_000_000, 2)], [])).toThrow(/range/);
  });
});

describe('dates (pure)', () => {
  it('computes period ends for each billing period', () => {
    const start = new Date('2026-03-01');
    expect(calculatePeriodEnd(start, 'DAILY', start).toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(calculatePeriodEnd(start, 'WEEKLY', start).toISOString().slice(0, 10)).toBe('2026-03-07');
    expect(calculatePeriodEnd(start, 'MONTHLY', start).toISOString().slice(0, 10)).toBe('2026-03-31');
    expect(calculatePeriodEnd(start, 'YEARLY', start).toISOString().slice(0, 10)).toBe('2027-02-28');
  });

  it('never drifts a month-end anchor over 12 months', () => {
    const anchor = new Date('2026-01-31');
    let cursor = anchor;
    const seen: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      cursor = addPeriod(cursor, 'MONTHLY', anchor);
      seen.push(cursor.toISOString().slice(5, 10));
    }
    expect(seen).toEqual(['02-28', '03-31', '04-30', '05-31', '06-30', '07-31', '08-31', '09-30', '10-31', '11-30', '12-31', '01-31']);
  });
});
