import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as productsController from './products.controller.js';
import {
  createProductSchema,
  createVariantSchema,
  getProductParamsSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from './products.schema.js';

export const productsRouter = Router();

productsRouter.get(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(listProductsQuerySchema),
  productsController.list
);

productsRouter.get(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(getProductParamsSchema),
  productsController.getById
);

productsRouter.post(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  validate(createProductSchema),
  productsController.create
);

productsRouter.post(
  '/:id/variants',
  authMiddleware,
  requireRole('ADMIN'),
  validate(createVariantSchema),
  productsController.addVariant
);

productsRouter.patch(
  '/:id',
  authMiddleware,
  requireRole('ADMIN'),
  validate(updateProductSchema),
  productsController.update
);
