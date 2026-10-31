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

  it('matches the exact Person 3 README hackathon example calculation', () => {
    // Product ₹1,000 (100000 paise) + variant ₹560 (56000 paise) = ₹1,560 (156000 paise)
    // Quantity 2 = ₹3,120 = 312000 paise
    // Plan base fee = ₹990 = 99000 paise
    // 18% tax on product line (1800 bps) = 312000 * 1800 / 10000 = 56160 paise (₹561.60)
    // Subtotal = 312000 + 99000 = 411000 paise
    // Total = 411000 + 56160 = 467160 paise (₹4,671.60)
    const productResult = calculateInvoicePricing(
      [{ id: 'line-1', productId: 'prod-odoo', quantity: 2, unitPrice: 156_000, taxRateBps: 1_800 }],
      []
    );
    const planBaseFee = 99_000;
    const subtotal = productResult.subtotal + planBaseFee;
    const total = subtotal - productResult.discountTotal + productResult.taxTotal;

    expect(productResult.lines[0].gross).toBe(312_000);
    expect(productResult.taxTotal).toBe(56_160);
    expect(subtotal).toBe(411_000);
    expect(total).toBe(467_160);
  });
});
