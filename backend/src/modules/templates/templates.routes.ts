import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createTemplateSchema,
  getTemplateParamsSchema,
  listTemplatesQuerySchema,
} from './templates.schema.js';
import {
  createTemplateHandler,
  getTemplatesHandler,
  getTemplateByIdHandler,
  deleteTemplateHandler,
} from './templates.controller.js';

export const templatesRouter = Router();

// Quotation templates endpoints
templatesRouter.post(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  validate(createTemplateSchema),
  createTemplateHandler
);

templatesRouter.get(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(listTemplatesQuerySchema),
  getTemplatesHandler
);

templatesRouter.get(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(getTemplateParamsSchema),
  getTemplateByIdHandler
);

templatesRouter.delete(
  '/:id',
  authMiddleware,
  requireRole('ADMIN'),
  validate(getTemplateParamsSchema),
  deleteTemplateHandler
);
