import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as plansController from './plans.controller.js';
import {
  createPlanSchema,
  getPlanParamsSchema,
  listPlansQuerySchema,
} from './plans.schema.js';

export const plansRouter = Router();

plansRouter.get(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(listPlansQuerySchema),
  plansController.list
);

plansRouter.get(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(getPlanParamsSchema),
  plansController.getById
);

plansRouter.post(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  validate(createPlanSchema),
  plansController.create
);
