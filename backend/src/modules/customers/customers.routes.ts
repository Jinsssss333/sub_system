import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as customersController from './customers.controller.js';
import { createCustomerSchema, listCustomersQuerySchema } from './customers.schema.js';

export const customersRouter = Router();

customersRouter.get(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(listCustomersQuerySchema),
  customersController.list
);

customersRouter.post(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(createCustomerSchema),
  customersController.create
);

customersRouter.get(
  '/:id',
  authMiddleware,
  customersController.getById
);
