import { PaymentMethod, Prisma, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { paymentBody } from '@brightloop/shared';
import { prisma } from '../../config/db.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { recordPayment } from './payments.service.js';

export const paymentsRouter = Router();

const paymentSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: paymentBody });
const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    method: z.nativeEnum(PaymentMethod).optional(),
    q: z.string().trim().max(100).optional(),
  }),
});

// Paginated payment ledger for staff.
paymentsRouter.get('/', authMiddleware, requireRole(Role.ADMIN, Role.STAFF), validate(listSchema), async (req, res, next) => {
  try {
    const { page, pageSize, method, q } = req.query as unknown as z.infer<typeof listSchema>['query'];
    const where: Prisma.PaymentWhereInput = {
      ...(method ? { method } : {}),
      ...(q ? { invoice: { OR: [{ number: { contains: q, mode: 'insensitive' } }, { customerName: { contains: q, mode: 'insensitive' } }] } } : {}),
    };
    const [total, data] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { invoice: { select: { id: true, number: true, customerName: true, total: true, status: true } } },
      }),
    ]);
    res.json({ data, meta: { page, pageSize, total } });
  } catch (error) {
    next(error);
  }
});

const record = [
  authMiddleware,
  requireRole(Role.ADMIN, Role.STAFF),
  validate(paymentSchema),
  async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    try {
      const result = await recordPayment(req.params.id, { ...req.body, paidOn: new Date(req.body.paidOn) });
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
];

// Aliases kept for the team's existing clients.
paymentsRouter.post('/invoices/:id/payments', ...record);
paymentsRouter.post('/:id/payments', ...record);
