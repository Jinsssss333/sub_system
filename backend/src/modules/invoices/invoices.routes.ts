import { InvoiceStatus, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { sendEmail } from '../../config/mailer.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { cancelInvoice, confirmInvoice, generateInvoice, FinanceError } from './invoices.service.js';
import { recordPayment } from '../payments/payments.service.js';
import { PaymentMethod } from '@prisma/client';

export const invoicesRouter = Router();

const idSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const listInvoicesSchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    status: z.nativeEnum(InvoiceStatus).optional(),
    customerId: z.string().uuid().optional(),
    dueDate: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

const generateSubscriptionInvoiceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'periodStart must be YYYY-MM-DD format'),
  }),
});

const paymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    method: z.nativeEnum(PaymentMethod),
    amount: z.number().int().positive(),
    paidOn: z.coerce.date(),
    note: z.string().trim().max(1000).optional(),
  }),
});

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

// Customer self-service invoices helper
async function getCustomerInvoices(customerId: string, status?: InvoiceStatus, page = 1, pageSize = 10) {
  const where = {
    customerId,
    ...(status ? { status } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { issueDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { lines: true, payments: true },
    }),
  ]);
  return { data, meta: { page, pageSize, total } };
}

// Dedicated router for GET /api/me/invoices
export const meInvoicesRouter = Router();
meInvoicesRouter.get(
  '/',
  authMiddleware,
  requireRole(Role.CUSTOMER),
  async (req, res, next) => {
    try {
      if (!req.user!.customerId) {
        throw new FinanceError('Customer profile not associated with this account', 404, 'CUSTOMER_NOT_FOUND');
      }
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 10;
      const status = req.query.status as InvoiceStatus | undefined;
      const result = await getCustomerInvoices(req.user!.customerId, status, page, pageSize);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Dedicated router for POST /api/subscriptions/:id/invoices
export const subscriptionInvoicesRouter = Router();
subscriptionInvoicesRouter.post(
  '/:id/invoices',
  authMiddleware,
  requireRole(Role.ADMIN, Role.STAFF),
  validate(generateSubscriptionInvoiceSchema),
  async (req, res, next) => {
    try {
      const invoice = await generateInvoice(req.params.id, req.body.periodStart);
      res.status(201).json({ data: invoice });
    } catch (error) {
      next(error);
    }
  }
);

// Customer portal alias: GET /api/invoices/me
invoicesRouter.get('/me', authMiddleware, requireRole(Role.CUSTOMER), async (req, res, next) => {
  try {
    if (!req.user!.customerId) {
      throw new FinanceError('Customer profile not associated with this account', 404, 'CUSTOMER_NOT_FOUND');
    }
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const status = req.query.status as InvoiceStatus | undefined;
    const result = await getCustomerInvoices(req.user!.customerId, status, page, pageSize);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Admin/Staff list invoices (with q search, status filter, and pagination)
invoicesRouter.get(
  '/',
  authMiddleware,
  requireRole(Role.ADMIN, Role.STAFF),
  validate(listInvoicesSchema),
  async (req, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 10;
      const { q, status, customerId, dueDate } = req.query as {
        q?: string;
        status?: InvoiceStatus;
        customerId?: string;
        dueDate?: Date;
      };

      const where: any = {};
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;
      if (dueDate) {
        where.dueDate = {
          gte: new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate())),
          lt: new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate() + 1)),
        };
      }
      if (q) {
        where.OR = [
          { number: { contains: q, mode: 'insensitive' } },
          { customerName: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [total, invoices] = await Promise.all([
        prisma.invoice.count({ where }),
        prisma.invoice.findMany({
          where,
          orderBy: { issueDate: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { lines: true, customer: true, payments: true },
        }),
      ]);

      res.json({
        data: invoices,
        meta: {
          page,
          pageSize,
          total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Invoice detail view (with strict customer isolation: 404 on unowned)
invoicesRouter.get(
  '/:id',
  authMiddleware,
  requireRole(Role.ADMIN, Role.STAFF, Role.CUSTOMER),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: {
          lines: true,
          customer: { include: { user: true } },
          payments: { orderBy: { paidOn: 'desc' } },
          subscription: { include: { plan: true } },
        },
      });

      if (!invoice) {
        throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
      }

      // Customer isolation: 404 if accessing another customer's invoice
      if (req.user!.role === Role.CUSTOMER && invoice.customerId !== req.user!.customerId) {
        throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
      }

      res.json({ data: invoice });
    } catch (error) {
      next(error);
    }
  }
);

// DRAFT -> CONFIRMED
invoicesRouter.post(
  '/:id/confirm',
  authMiddleware,
  requireRole(Role.ADMIN, Role.STAFF),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const confirmed = await confirmInvoice(req.params.id);
      res.json({ data: confirmed });
    } catch (error) {
      next(error);
    }
  }
);

// Cancel unpaid invoice
invoicesRouter.post(
  '/:id/cancel',
  authMiddleware,
  requireRole(Role.ADMIN, Role.STAFF),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const cancelled = await cancelInvoice(req.params.id);
      res.json({ data: cancelled });
    } catch (error) {
      next(error);
    }
  }
);

// Record payment on invoice
invoicesRouter.post(
  '/:id/payments',
  authMiddleware,
  requireRole(Role.ADMIN, Role.STAFF),
  validate(paymentSchema),
  async (req, res, next) => {
    try {
      const result = await recordPayment(req.params.id, req.body);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Email invoice to Mailpit
invoicesRouter.post(
  '/:id/send',
  authMiddleware,
  requireRole(Role.ADMIN, Role.STAFF),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: { customer: { include: { user: true } } },
      });
      if (!invoice) throw new FinanceError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
      if (invoice.status === 'CANCELLED') throw new FinanceError('Cancelled invoices cannot be sent', 409, 'INVALID_INVOICE_STATE');

      await sendEmail({
        to: invoice.customer.user.email,
        subject: `Brightloop invoice ${invoice.number}`,
        html: `<p>Invoice <strong>${escapeHtml(invoice.number)}</strong> total: ₹${(invoice.total / 100).toFixed(2)}</p>`,
      });
      res.json({ data: { message: 'Invoice email sent' } });
    } catch (error) {
      next(error);
    }
  }
);
