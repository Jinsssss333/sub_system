import { InvoiceStatus, Role, SubscriptionStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';

export const reportsRouter = Router();

reportsRouter.get('/summary', authMiddleware, requireRole(Role.ADMIN, Role.STAFF), async (_req, res, next) => {
  try {
    const today = new Date();
    const [activeSubscriptions, revenue, outstandingResult, overdueCount] = await Promise.all([
      prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE, pausedAt: null } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.$queryRaw<Array<{ outstanding: bigint }>>`
        SELECT COALESCE(SUM(total - "amountPaid"), 0)::bigint AS outstanding
        FROM "Invoice"
        WHERE status = 'CONFIRMED'
      `,
      prisma.invoice.count({
        where: {
          status: InvoiceStatus.CONFIRMED,
          dueDate: { lt: today },
        },
      }),
    ]);

    const revenueCollected = revenue._sum.amount ?? 0;
    const outstanding = Number(outstandingResult[0]?.outstanding ?? 0n);

    res.json({
      data: {
        activeSubscriptions,
        revenueCollected,
        outstanding,
        overdueCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

const overdueQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

reportsRouter.get('/overdue', authMiddleware, requireRole(Role.ADMIN, Role.STAFF), validate(overdueQuerySchema), async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const today = new Date();

    const where = {
      status: InvoiceStatus.CONFIRMED,
      dueDate: { lt: today },
    };

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: { include: { user: true } }, lines: true },
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
});
