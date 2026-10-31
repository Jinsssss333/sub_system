import { InvoiceStatus, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { sendEmail } from '../../config/mailer.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { cancelInvoice, confirmInvoice, FinanceError } from './invoices.service.js';

export const invoicesRouter = Router();
const idSchema = z.object({ params: z.object({ id: z.string().uuid() }) });
const listSchema = z.object({ query: z.object({ status: z.nativeEnum(InvoiceStatus).optional(), customerId: z.string().uuid().optional(), dueDate: z.coerce.date().optional() }) });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

invoicesRouter.get('/', authMiddleware, requireRole(Role.ADMIN, Role.STAFF, Role.CUSTOMER), validate(listSchema), async (req, res, next) => {
  try {
    const requestedCustomerId = req.query.customerId as string | undefined;
    if (req.user!.role === Role.CUSTOMER && (!req.user!.customerId || (requestedCustomerId && requestedCustomerId !== req.user!.customerId))) throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    const dueDate = req.query.dueDate as Date | undefined;
    const invoices = await prisma.invoice.findMany({ where: { status: req.query.status as InvoiceStatus | undefined, customerId: req.user!.role === Role.CUSTOMER ? req.user!.customerId : requestedCustomerId, ...(dueDate ? { dueDate: { gte: new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate())), lt: new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate() + 1)) } } : {}) }, include: { lines: true }, orderBy: { issueDate: 'desc' } });
    res.json({ data: invoices });
  } catch (error) { next(error); }
});
invoicesRouter.post('/:id/confirm', authMiddleware, requireRole(Role.ADMIN, Role.STAFF), validate(idSchema), async (req, res, next) => { try { res.json(await confirmInvoice(req.params.id)); } catch (error) { next(error); } });
invoicesRouter.post('/:id/cancel', authMiddleware, requireRole(Role.ADMIN, Role.STAFF), validate(idSchema), async (req, res, next) => { try { res.json(await cancelInvoice(req.params.id)); } catch (error) { next(error); } });
invoicesRouter.post('/:id/send', authMiddleware, requireRole(Role.ADMIN, Role.STAFF), validate(idSchema), async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { customer: { include: { user: true } } } });
    if (!invoice) throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    if (invoice.status === 'CANCELLED') throw new FinanceError('Cancelled invoices cannot be sent', 409, 'INVALID_INVOICE_STATE');
    await sendEmail({ to: invoice.customer.user.email, subject: `Brightloop invoice ${invoice.number}`, html: `<p>Invoice <strong>${escapeHtml(invoice.number)}</strong> total: ₹${(invoice.total / 100).toFixed(2)}</p>` });
    res.json({ message: 'Invoice email sent' });
  } catch (error) { next(error); }
});
