import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as usersController from './users.controller.js';
import { createStaffSchema, listUsersQuerySchema } from './users.schema.js';

export const usersRouter = Router();

usersRouter.get(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  validate(listUsersQuerySchema),
  usersController.list
);

usersRouter.post(
  '/staff',
  authMiddleware,
  requireRole('ADMIN'),
  validate(createStaffSchema),
  usersController.createStaff
);
