import { DiscountScope, InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { addPeriod } from '../../utils/dates.js';
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

export async function generateInvoice(subscriptionId: string, today = new Date()) {
  const billingDate = dayStart(today);
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
    if (subscription.status !== 'ACTIVE' || subscription.pausedAt || !subscription.nextInvoiceDate || subscription.nextInvoiceDate > billingDate) {
      throw new FinanceError('Subscription is not due for billing', 409, 'SUBSCRIPTION_NOT_DUE');
    }

    const periodStart = subscription.nextInvoiceDate;
    const existing = await tx.invoice.findUnique({ where: { subscriptionId_periodStart: { subscriptionId, periodStart } } });
    const nextInvoiceDate = addPeriod(periodStart, subscription.plan.billingPeriod);
    if (existing) {
      await tx.subscription.update({ where: { id: subscriptionId }, data: { nextInvoiceDate } });
      return existing;
    }

    const productIds = subscription.lines.map((line) => line.productId);
    const candidates = await tx.discount.findMany({
      where: {
        startDate: { lte: periodStart }, endDate: { gte: periodStart },
        OR: [
          { scope: DiscountScope.PRODUCT, products: { some: { productId: { in: productIds } } } },
          { scope: DiscountScope.SUBSCRIPTION, subscriptions: { some: { subscriptionId } } },
        ],
      },
      include: { products: true },
    });
    await lockDiscounts(tx, candidates.map((discount) => discount.id));
    const discounts = candidates.filter((discount) => discount.usageLimit === null || discount.timesUsed < discount.usageLimit);
    const pricing = calculateInvoicePricing(
      subscription.lines.map((line) => ({
        id: line.id, productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, taxRateBps: line.tax?.rateBps ?? 0,
      })),
      discounts.map((discount) => ({
        id: discount.id, scope: discount.scope, type: discount.type, value: discount.value,
        minPurchase: discount.minPurchase, minQuantity: discount.minQuantity,
        productIds: discount.products.map((product) => product.productId),
      })),
    );
    for (const discountId of pricing.appliedDiscountIds) {
      await tx.discount.update({ where: { id: discountId }, data: { timesUsed: { increment: 1 } } });
    }

    const number = await nextInvoiceNumber(tx);
    const byLineId = new Map(subscription.lines.map((line) => [line.id, line]));
    const periodEnd = new Date(nextInvoiceDate.getTime() - 1);
    const invoice = await tx.invoice.create({
      data: {
        number, subscriptionId, customerId: subscription.customerId,
        customerName: subscription.customer.companyName ?? subscription.customer.user.name,
        customerAddress: subscription.customer.address,
        periodStart, periodEnd, status: InvoiceStatus.DRAFT,
        subtotal: pricing.subtotal, discountTotal: pricing.discountTotal, taxTotal: pricing.taxTotal, total: pricing.total,
        issueDate: billingDate, dueDate: new Date(billingDate.getTime() + subscription.paymentTermDays * 86_400_000),
        lines: { create: pricing.lines.map((line) => {
          const source = byLineId.get(line.id);
          if (!source) throw new FinanceError('Subscription line was not found', 500);
          const variant = source.variant ? ` (${source.variant.attribute}: ${source.variant.value})` : '';
          return { productId: source.productId, description: `${source.product.name}${variant}`, quantity: line.quantity, unitPrice: line.unitPrice,
            discountAmount: line.discountAmount, taxRateBps: line.taxRateBps, taxAmount: line.taxAmount, amount: line.amount };
        }) },
      },
      include: { lines: true },
    });
    await tx.subscription.update({ where: { id: subscriptionId }, data: { nextInvoiceDate } });
    return invoice;
  });
}

export async function confirmInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  if (invoice.status !== 'DRAFT') throw new FinanceError('Only draft invoices can be confirmed', 409, 'INVALID_INVOICE_STATE');
  return prisma.invoice.update({ where: { id: invoiceId }, data: { status: invoice.total === 0 ? 'PAID' : 'CONFIRMED' } });
}

export async function cancelInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  if (invoice.amountPaid !== 0 || !['DRAFT', 'CONFIRMED'].includes(invoice.status)) {
    throw new FinanceError('Only unpaid draft or confirmed invoices can be cancelled', 409, 'INVALID_INVOICE_STATE');
  }
  return prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'CANCELLED' } });
}
