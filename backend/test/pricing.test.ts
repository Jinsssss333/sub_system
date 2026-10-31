import { describe, expect, it } from 'vitest';
import { calculateInvoicePricing } from '../src/utils/pricing.js';

describe('invoice pricing', () => {
  it('applies product discounts before subscription discounts and taxes the net amount', () => {
    const result = calculateInvoicePricing(
      [{ id: 'a', productId: 'p1', quantity: 1, unitPrice: 10_000, taxRateBps: 1_800 }],
      [
        { id: 'product', scope: 'PRODUCT', type: 'FIXED', value: 1_000, productIds: ['p1'] },
        { id: 'subscription', scope: 'SUBSCRIPTION', type: 'PERCENT', value: 1_000 },
      ],
    );
    expect(result.discountTotal).toBe(1_900);
    expect(result.taxTotal).toBe(1_458);
    expect(result.total).toBe(9_558);
  });

  it('allocates a subscription discount exactly without losing paise', () => {
    const result = calculateInvoicePricing(
      [
        { id: 'a', productId: 'a', quantity: 1, unitPrice: 1, taxRateBps: 0 },
        { id: 'b', productId: 'b', quantity: 1, unitPrice: 2, taxRateBps: 0 },
      ],
      [{ id: 'subscription', scope: 'SUBSCRIPTION', type: 'FIXED', value: 2 }],
    );
    expect(result.discountTotal).toBe(2);
    expect(result.lines.reduce((sum, line) => sum + line.discountAmount, 0)).toBe(2);
  });

  it('rounds half-up tax in paise', () => {
    const result = calculateInvoicePricing([{ id: 'a', productId: 'a', quantity: 1, unitPrice: 1, taxRateBps: 5_000 }], []);
    expect(result.taxTotal).toBe(1);
  });
});
