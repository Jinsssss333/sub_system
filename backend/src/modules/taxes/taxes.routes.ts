import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as taxesController from './taxes.controller.js';
import {
  createTaxSchema,
  getTaxParamsSchema,
  listTaxesQuerySchema,
} from './taxes.schema.js';

export const taxesRouter = Router();

taxesRouter.get(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(listTaxesQuerySchema),
  taxesController.list
);

taxesRouter.get(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(getTaxParamsSchema),
  taxesController.getById
);

taxesRouter.post(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  validate(createTaxSchema),
  taxesController.create
);
