import { PaymentMethod } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { FinanceError } from '../invoices/invoices.service.js';

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  paidOn: Date;
  note?: string;
}

/**
 * Records a payment under a row lock on the invoice. The invoice must be CONFIRMED and the
 * amount must be positive and no more than the remaining balance; concurrent payments are
 * serialised by the lock, so two payments can never together exceed the total.
 */
export async function recordPayment(invoiceId: string, input: PaymentInput) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new FinanceError('Payment amount must be a positive whole number of paise', 400, 'INVALID_PAYMENT_AMOUNT');
  if (Number.isNaN(input.paidOn.getTime())) throw new FinanceError('Payment date is invalid', 400, 'INVALID_PAYMENT_DATE');
  if (input.paidOn.getTime() > Date.now() + 86_400_000) throw new FinanceError('Payment date cannot be in the future', 400, 'INVALID_PAYMENT_DATE');

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    if (invoice.status !== 'CONFIRMED') throw new FinanceError('Payments can only be recorded for confirmed invoices', 409, 'INVALID_INVOICE_STATE');
    const outstanding = invoice.total - invoice.amountPaid;
    if (input.amount > outstanding) throw new FinanceError(`Payment exceeds the outstanding balance of ${(outstanding / 100).toFixed(2)}`, 400, 'OVERPAYMENT');
    const amountPaid = invoice.amountPaid + input.amount;
    const payment = await tx.payment.create({ data: { invoiceId, method: input.method, amount: input.amount, paidOn: input.paidOn, note: input.note } });
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid, status: amountPaid === invoice.total ? 'PAID' : 'CONFIRMED' },
    });
    return { payment, invoice: updatedInvoice };
  });
}
