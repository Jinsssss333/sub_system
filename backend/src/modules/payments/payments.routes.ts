import { PaymentMethod, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { recordPayment } from './payments.service.js';

export const paymentsRouter = Router();
const paymentSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ method: z.nativeEnum(PaymentMethod), amount: z.number().int().positive(), paidOn: z.coerce.date(), note: z.string().trim().max(1000).optional() }) });

paymentsRouter.post('/invoices/:id/payments', authMiddleware, requireRole(Role.ADMIN, Role.STAFF), validate(paymentSchema), async (req, res, next) => {
  try { res.status(201).json(await recordPayment(req.params.id, req.body)); } catch (error) { next(error); }
});
