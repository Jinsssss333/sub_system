import { DiscountScope, InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { addPeriod, calculatePeriodEnd } from '../../utils/dates.js';
import { calculateInvoicePricing } from '../../utils/pricing.js';

export class FinanceError extends Error {
  constructor(message: string, public readonly statusCode = 400, public readonly code = 'FINANCE_ERROR') {
    super(message);
  }
}

const dayStart = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

async function nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { key: 'invoice' },
    create: { key: 'invoice', value: 1 },
    update: { value: { increment: 1 } },
  });
  return `INV-${counter.value.toString().padStart(6, '0')}`;
}

async function lockSubscription(tx: Prisma.TransactionClient, subscriptionId: string) {
  await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id = ${subscriptionId} FOR UPDATE`;
}

async function lockDiscounts(tx: Prisma.TransactionClient, discountIds: string[]) {
  if (discountIds.length === 0) return;
  const ids = [...discountIds].sort();
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Discount" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
}

export async function generateInvoice(subscriptionId: string, requestedPeriod?: Date | string, today = new Date()) {
  const billingDate = dayStart(today);
  const targetPeriodStart = requestedPeriod
    ? dayStart(typeof requestedPeriod === 'string' ? new Date(requestedPeriod) : requestedPeriod)
    : null;

  return prisma.$transaction(async (tx) => {
    await lockSubscription(tx, subscriptionId);
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: { include: { user: true } },
        plan: true,
        lines: { include: { product: true, variant: true, tax: true } },
      },
    });
    if (!subscription) throw new FinanceError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');

    // 1. Idempotency: Return existing invoice for this period if already generated
    const effectivePeriodStart = targetPeriodStart ?? (subscription.nextInvoiceDate ? dayStart(subscription.nextInvoiceDate) : null);
    if (!effectivePeriodStart) {
      throw new FinanceError('Subscription has no scheduled billing period', 409, 'NO_BILLING_PERIOD');
    }

    const existing = await tx.invoice.findUnique({
      where: { subscriptionId_periodStart: { subscriptionId, periodStart: effectivePeriodStart } },
      include: { lines: true, customer: true, payments: true },
    });
    if (existing) {
      return existing;
    }

    // 2. Lifecycle and state checks
    if (subscription.status !== 'ACTIVE') {
      throw new FinanceError(`Subscription is not active (status: ${subscription.status})`, 409, 'SUBSCRIPTION_NOT_ACTIVE');
    }
    if (subscription.pausedAt) {
      throw new FinanceError('Subscription is currently paused', 409, 'SUBSCRIPTION_PAUSED');
    }
    if (!subscription.nextInvoiceDate) {
      throw new FinanceError('Subscription has no next invoice date', 409, 'SUBSCRIPTION_NOT_DUE');
    }

    const nextInvoiceDateDay = dayStart(subscription.nextInvoiceDate);
    if (targetPeriodStart && targetPeriodStart.getTime() !== nextInvoiceDateDay.getTime()) {
      throw new FinanceError(
        `Requested period start (${targetPeriodStart.toISOString().slice(0, 10)}) does not match subscription next invoice date (${nextInvoiceDateDay.toISOString().slice(0, 10)})`,
        409,
        'INVALID_PERIOD_START'
      );
    }

    if (nextInvoiceDateDay > billingDate) {
      throw new FinanceError('Subscription is not due for billing yet', 409, 'SUBSCRIPTION_NOT_DUE');
    }

    // 3. Service expiry policy
    const effectiveExpiryDate = subscription.expiryDate ?? subscription.plan.endDate;
    if (effectiveExpiryDate && nextInvoiceDateDay > dayStart(effectiveExpiryDate)) {
      if (subscription.plan.autoClose) {
        await tx.subscription.update({ where: { id: subscriptionId }, data: { status: 'CLOSED' } });
      }
      throw new FinanceError('Subscription has reached its expiry date and cannot be billed', 409, 'SUBSCRIPTION_EXPIRED');
    }

    const periodStart = nextInvoiceDateDay;
    const periodEnd = calculatePeriodEnd(periodStart, subscription.plan.billingPeriod, subscription.startDate);
    const nextInvoiceDate = addPeriod(periodStart, subscription.plan.billingPeriod, subscription.startDate);

    // 4. Calculate pricing for product lines
    const productIds = subscription.lines.map((line) => line.productId);
    const candidates = await tx.discount.findMany({
      where: {
        startDate: { lte: periodStart },
        endDate: { gte: periodStart },
        OR: [
          { scope: DiscountScope.PRODUCT, products: { some: { productId: { in: productIds } } } },
          { scope: DiscountScope.SUBSCRIPTION, subscriptions: { some: { subscriptionId } } },
        ],
      },
      include: { products: true },
    });
    await lockDiscounts(tx, candidates.map((discount) => discount.id));
    const discounts = candidates.filter((discount) => discount.usageLimit === null || discount.timesUsed < discount.usageLimit);

    const pricing = subscription.lines.length > 0
      ? calculateInvoicePricing(
          subscription.lines.map((line) => ({
            id: line.id,
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRateBps: line.tax?.rateBps ?? 0,
          })),
          discounts.map((discount) => ({
            id: discount.id,
            scope: discount.scope,
            type: discount.type,
            value: discount.value,
            minPurchase: discount.minPurchase,
            minQuantity: discount.minQuantity,
            productIds: discount.products.map((product) => product.productId),
          }))
        )
      : { lines: [], subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0, appliedDiscountIds: [] };

    for (const discountId of pricing.appliedDiscountIds) {
      await tx.discount.update({ where: { id: discountId }, data: { timesUsed: { increment: 1 } } });
    }

    // 5. Add recurring plan base fee line item (DECISIONS.md & README_PERSON_3)
    const planBaseFee = subscription.plan.price;
    const planLines = planBaseFee > 0
      ? [
          {
            productId: null,
            description: `Plan: ${subscription.plan.name} (Recurring Base Fee)`,
            quantity: 1,
            unitPrice: planBaseFee,
            discountAmount: 0,
            taxRateBps: 0,
            taxAmount: 0,
            amount: planBaseFee,
          },
        ]
      : [];

    const finalSubtotal = pricing.subtotal + planBaseFee;
    const finalDiscountTotal = pricing.discountTotal;
    const finalTaxTotal = pricing.taxTotal;
    const finalTotal = finalSubtotal - finalDiscountTotal + finalTaxTotal;

    const number = await nextInvoiceNumber(tx);
    const byLineId = new Map(subscription.lines.map((line) => [line.id, line]));

    const invoiceLinesData = [
      ...pricing.lines.map((line) => {
        const source = byLineId.get(line.id);
        if (!source) throw new FinanceError('Subscription line was not found', 500);
        const variant = source.variant ? ` (${source.variant.attribute}: ${source.variant.value})` : '';
        return {
          productId: source.productId,
          description: `${source.product.name}${variant}`,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount,
          taxRateBps: line.taxRateBps,
          taxAmount: line.taxAmount,
          amount: line.amount,
        };
      }),
      ...planLines,
    ];

    const invoice = await tx.invoice.create({
      data: {
        number,
        subscriptionId,
        customerId: subscription.customerId,
        customerName: subscription.customer.companyName ?? subscription.customer.user.name,
        customerAddress: subscription.customer.address,
        periodStart,
        periodEnd,
        status: InvoiceStatus.DRAFT,
        subtotal: finalSubtotal,
        discountTotal: finalDiscountTotal,
        taxTotal: finalTaxTotal,
        total: finalTotal,
        issueDate: billingDate,
        dueDate: new Date(billingDate.getTime() + subscription.paymentTermDays * 86_400_000),
        lines: { create: invoiceLinesData },
      },
      include: { lines: true, customer: true, payments: true },
    });

    await tx.subscription.update({ where: { id: subscriptionId }, data: { nextInvoiceDate } });
    return invoice;
  });
}

export async function confirmInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  if (invoice.status !== 'DRAFT') throw new FinanceError('Only draft invoices can be confirmed', 409, 'INVALID_INVOICE_STATE');
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: invoice.total === 0 ? 'PAID' : 'CONFIRMED' },
    include: { lines: true, customer: true, payments: true },
  });
}

export async function cancelInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  if (invoice.amountPaid !== 0 || !['DRAFT', 'CONFIRMED'].includes(invoice.status)) {
    throw new FinanceError('Only unpaid draft or confirmed invoices can be cancelled', 409, 'INVALID_INVOICE_STATE');
  }
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'CANCELLED' },
    include: { lines: true, customer: true, payments: true },
  });
}
