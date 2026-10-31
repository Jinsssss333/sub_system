import { Role } from '@prisma/client';
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { prisma } from '../../config/db.js';

export const reportsRouter = Router();
reportsRouter.get('/summary', authMiddleware, requireRole(Role.ADMIN, Role.STAFF), async (_req, res, next) => {
  try {
    const today = new Date();
    const [activeSubscriptions, revenue, outstanding, overdueInvoices] = await Promise.all([
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.$queryRaw<Array<{ outstanding: bigint }>>`SELECT COALESCE(SUM(total - "amountPaid"), 0)::bigint AS outstanding FROM "Invoice" WHERE status = 'CONFIRMED'`,
      prisma.invoice.findMany({ where: { status: 'CONFIRMED', dueDate: { lt: today } }, orderBy: { dueDate: 'asc' }, include: { customer: true } }),
    ]);
    res.json({ activeSubscriptions, revenueCollected: revenue._sum.amount ?? 0, totalOutstanding: Number(outstanding[0]?.outstanding ?? 0n), overdueInvoices });
  } catch (error) { next(error); }
});
