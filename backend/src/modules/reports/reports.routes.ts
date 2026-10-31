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
    const [activeSubscriptions, revenue, outstandingResult, overdueCount, overdueAmountResult, monthly, statusCounts, pausedSubscriptions] = await Promise.all([
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
      prisma.$queryRaw<Array<{ amount: bigint }>>`
        SELECT COALESCE(SUM(total - "amountPaid"), 0)::bigint AS amount
        FROM "Invoice" WHERE status = 'CONFIRMED' AND "dueDate" < ${today}
      `,
      prisma.$queryRaw<Array<{ month: string; collected: bigint }>>`
        SELECT to_char(date_trunc('month', "paidOn"), 'YYYY-MM') AS month, SUM(amount)::bigint AS collected
        FROM "Payment"
        WHERE "paidOn" >= date_trunc('month', ${today}::timestamp) - interval '5 months'
        GROUP BY 1 ORDER BY 1
      `,
      prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE, pausedAt: { not: null } } }),
    ]);

    const revenueCollected = revenue._sum.amount ?? 0;
    const outstanding = Number(outstandingResult[0]?.outstanding ?? 0n);
    const overdueAmount = Number(overdueAmountResult[0]?.amount ?? 0n);
    const subscriptionsByStatus = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all]));

    res.json({
      data: {
        activeSubscriptions,
        revenueCollected,
        outstanding,
        overdueCount,
        overdueAmount,
        pausedSubscriptions,
        subscriptionsByStatus,
        monthlyRevenue: monthly.map((row) => ({ month: row.month, collected: Number(row.collected) })),
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
        include: { customer: { select: { id: true, companyName: true, user: { select: { name: true, email: true } } } } },
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
