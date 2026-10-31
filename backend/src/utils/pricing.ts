/**
 * Pricing math pure utilities (Money in Paise, Taxes in Basis Points)
 */

export function calculateLineBaseAmount(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

export function calculatePercentDiscount(amount: number, rateBps: number): number {
  // rateBps: 1000 = 10%
  return Math.round((amount * rateBps) / 10000);
}

export function calculateTaxAmount(discountedAmount: number, rateBps: number): number {
  // Rounded half-up
  return Math.round((discountedAmount * rateBps) / 10000);
}

