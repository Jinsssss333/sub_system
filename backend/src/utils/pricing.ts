/** Pricing math uses integer paise and basis points only. */
export type DiscountScope = 'PRODUCT' | 'SUBSCRIPTION';
export type DiscountType = 'FIXED' | 'PERCENT';

export interface PricingLineInput {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRateBps: number;
}

export interface PricingDiscountInput {
  id: string;
  scope: DiscountScope;
  type: DiscountType;
  value: number;
  minPurchase?: number | null;
  minQuantity?: number | null;
  productIds?: string[];
}

export interface PricedLine extends PricingLineInput {
  gross: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  amount: number;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  appliedDiscountIds: string[];
}

const MAX_DATABASE_INT = 2_147_483_647n;

function asBigInt(value: number, field: string): bigint {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer`);
  return BigInt(value);
}

function asDatabaseInt(value: bigint, field: string): number {
  if (value < 0n || value > MAX_DATABASE_INT) throw new Error(`${field} exceeds the supported database money range`);
  return Number(value);
}

/** Round a non-negative fraction to the nearest paise, with halves rounded up. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error('roundHalfUp requires non-negative values');
  return (numerator + denominator / 2n) / denominator;
}

export function calculateLineBaseAmount(quantity: number, unitPrice: number): number {
  return asDatabaseInt(asBigInt(quantity, 'quantity') * asBigInt(unitPrice, 'unitPrice'), 'line amount');
}

export function calculatePercentDiscount(amount: number, rateBps: number): number {
  return asDatabaseInt(roundHalfUp(asBigInt(amount, 'amount') * asBigInt(rateBps, 'rateBps'), 10_000n), 'discount');
}

export function calculateTaxAmount(discountedAmount: number, rateBps: number): number {
  return asDatabaseInt(roundHalfUp(asBigInt(discountedAmount, 'discountedAmount') * asBigInt(rateBps, 'rateBps'), 10_000n), 'tax');
}

function allocateProportionally(balances: bigint[], requested: bigint): bigint[] {
  const total = balances.reduce((sum, balance) => sum + balance, 0n);
  const discount = requested > total ? total : requested;
  if (discount === 0n || total === 0n) return balances.map(() => 0n);
  const allocations = balances.map((balance, index) => {
    const numerator = discount * balance;
    return { index, amount: numerator / total, remainder: numerator % total };
  });
  let remainder = discount - allocations.reduce((sum, item) => sum + item.amount, 0n);
  allocations.sort((left, right) => left.remainder === right.remainder ? left.index - right.index : (left.remainder > right.remainder ? -1 : 1));
  for (const allocation of allocations) {
    if (remainder === 0n) break;
    if (allocation.amount < balances[allocation.index]) {
      allocation.amount += 1n;
      remainder -= 1n;
    }
  }
  const result = balances.map(() => 0n);
  for (const allocation of allocations) result[allocation.index] = allocation.amount;
  return result;
}

function discountValue(type: DiscountType, value: number, eligibleTotal: bigint): bigint {
  const rawValue = asBigInt(value, 'discount value');
  if (type === 'FIXED') return rawValue > eligibleTotal ? eligibleTotal : rawValue;
  if (rawValue > 10_000n) throw new Error('percentage discount cannot exceed 10000 basis points');
  const calculated = roundHalfUp(eligibleTotal * rawValue, 10_000n);
  return calculated > eligibleTotal ? eligibleTotal : calculated;
}

export function calculateInvoicePricing(inputLines: PricingLineInput[], inputDiscounts: PricingDiscountInput[]): PricingResult {
  if (inputLines.length === 0) throw new Error('an invoice needs at least one line');
  const lines = inputLines.map((line) => {
    const quantity = asBigInt(line.quantity, 'quantity');
    const unitPrice = asBigInt(line.unitPrice, 'unitPrice');
    const taxRateBps = asBigInt(line.taxRateBps, 'taxRateBps');
    if (quantity === 0n || taxRateBps > 10_000n) throw new Error('quantity must be positive and tax rate cannot exceed 10000 basis points');
    return { ...line, gross: quantity * unitPrice, discount: 0n, taxRateBps };
  });
  const appliedDiscountIds: string[] = [];
  const orderedDiscounts = [...inputDiscounts].sort((left, right) => left.scope !== right.scope ? (left.scope === 'PRODUCT' ? -1 : 1) : left.id.localeCompare(right.id));
  for (const discount of orderedDiscounts) {
    const eligibleIndexes = lines.map((line, index) => ({ line, index })).filter(({ line }) => discount.scope === 'SUBSCRIPTION' || discount.productIds?.includes(line.productId));
    if (eligibleIndexes.length === 0) continue;
    const balances = eligibleIndexes.map(({ line }) => line.gross - line.discount);
    const eligibleTotal = balances.reduce((sum, balance) => sum + balance, 0n);
    const eligibleQuantity = eligibleIndexes.reduce((sum, { line }) => sum + BigInt(line.quantity), 0n);
    if (eligibleTotal === 0n) continue;
    if (discount.minPurchase != null && eligibleTotal < asBigInt(discount.minPurchase, 'minimum purchase')) continue;
    if (discount.minQuantity != null && eligibleQuantity < asBigInt(discount.minQuantity, 'minimum quantity')) continue;
    const allocations = allocateProportionally(balances, discountValue(discount.type, discount.value, eligibleTotal));
    if (allocations.every((amount) => amount === 0n)) continue;
    eligibleIndexes.forEach(({ index }, allocationIndex) => { lines[index].discount += allocations[allocationIndex]; });
    appliedDiscountIds.push(discount.id);
  }
  const pricedLines: PricedLine[] = lines.map((line) => {
    const taxableAmount = line.gross - line.discount;
    const taxAmount = roundHalfUp(taxableAmount * line.taxRateBps, 10_000n);
    return { id: line.id, productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, taxRateBps: Number(line.taxRateBps), gross: asDatabaseInt(line.gross, 'line gross'), discountAmount: asDatabaseInt(line.discount, 'line discount'), taxableAmount: asDatabaseInt(taxableAmount, 'line taxable amount'), taxAmount: asDatabaseInt(taxAmount, 'line tax'), amount: asDatabaseInt(taxableAmount + taxAmount, 'line total') };
  });
  const subtotal = pricedLines.reduce((sum, line) => sum + BigInt(line.gross), 0n);
  const discountTotal = pricedLines.reduce((sum, line) => sum + BigInt(line.discountAmount), 0n);
  const taxTotal = pricedLines.reduce((sum, line) => sum + BigInt(line.taxAmount), 0n);
  return { lines: pricedLines, subtotal: asDatabaseInt(subtotal, 'invoice subtotal'), discountTotal: asDatabaseInt(discountTotal, 'invoice discount total'), taxTotal: asDatabaseInt(taxTotal, 'invoice tax total'), total: asDatabaseInt(subtotal - discountTotal + taxTotal, 'invoice total'), appliedDiscountIds };
}
