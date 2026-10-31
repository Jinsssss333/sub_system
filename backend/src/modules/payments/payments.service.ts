import { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { FinanceError } from '../invoices/invoices.service.js';

export interface PaymentInput { method: PaymentMethod; amount: number; paidOn: Date; note?: string; }

export async function recordPayment(invoiceId: string, input: PaymentInput) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new FinanceError('Payment amount must be a positive integer', 400, 'INVALID_PAYMENT_AMOUNT');
  if (input.paidOn > new Date()) throw new FinanceError('Payment date cannot be in the future', 400, 'INVALID_PAYMENT_DATE');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    if (invoice.status !== 'CONFIRMED') throw new FinanceError('Payments can only be recorded for confirmed invoices', 409, 'INVALID_INVOICE_STATE');
    const outstanding = invoice.total - invoice.amountPaid;
    if (input.amount > outstanding) throw new FinanceError('Payment exceeds the outstanding balance', 400, 'OVERPAYMENT');
    const amountPaid = invoice.amountPaid + input.amount;
    const payment = await tx.payment.create({ data: { invoiceId, method: input.method, amount: input.amount, paidOn: input.paidOn, note: input.note } });
    const updatedInvoice = await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid, status: amountPaid === invoice.total ? 'PAID' : 'CONFIRMED' } });
    return { payment, invoice: updatedInvoice };
  });
}
