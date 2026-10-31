/**
 * Pricing math pure utilities (Money in integer Paise, Taxes in Basis Points)
 * All division is integer division to guarantee zero floating-point errors.
 */

export function calculateLineBaseAmount(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

export function calculatePercentDiscount(amount: number, rateBps: number): number {
  // rateBps: 1000 = 10%
  return Math.floor((amount * rateBps) / 10000);
}

export function calculateTaxAmount(discountedAmount: number, rateBps: number): number {
  // Half-up integer rounding: (amount * rateBps + 5000) / 10000
  return Math.floor((discountedAmount * rateBps + 5000) / 10000);
}
