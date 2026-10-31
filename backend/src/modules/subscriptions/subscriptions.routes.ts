import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  transitionSubscriptionSchema,
  subscriptionQuerySchema,
  subscriptionParamsSchema,
} from './subscriptions.schema.js';
import {
  createSubscriptionHandler,
  getSubscriptionsHandler,
  getSubscriptionByIdHandler,
  updateSubscriptionHandler,
  transitionSubscriptionHandler,
  pauseSubscriptionHandler,
  resumeSubscriptionHandler,
  renewSubscriptionHandler,
  getMySubscriptionsHandler,
} from './subscriptions.controller.js';

export const subscriptionsRouter = Router();

// Customer portal route alias
subscriptionsRouter.get(
  '/me',
  authMiddleware,
  requireRole('CUSTOMER'),
  getMySubscriptionsHandler
);

// Create subscription (scratch or from template)
subscriptionsRouter.post(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(createSubscriptionSchema),
  createSubscriptionHandler
);

// List subscriptions (paginated with search & filters)
subscriptionsRouter.get(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(subscriptionQuerySchema),
  getSubscriptionsHandler
);

// Subscription detail view
subscriptionsRouter.get(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  validate(subscriptionParamsSchema),
  getSubscriptionByIdHandler
);

// Edit subscription (allowed ONLY while status is DRAFT)
subscriptionsRouter.patch(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(updateSubscriptionSchema),
  updateSubscriptionHandler
);

// Strict State Machine transitions
subscriptionsRouter.post(
  '/:id/transition',
  authMiddleware,
  requireRole('ADMIN', 'STAFF'),
  validate(transitionSubscriptionSchema),
  transitionSubscriptionHandler
);

// Lifecycle: Pause subscription
subscriptionsRouter.post(
  '/:id/pause',
  authMiddleware,
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  validate(subscriptionParamsSchema),
  pauseSubscriptionHandler
);

// Lifecycle: Resume subscription
subscriptionsRouter.post(
  '/:id/resume',
  authMiddleware,
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  validate(subscriptionParamsSchema),
  resumeSubscriptionHandler
);

// Lifecycle: Renew subscription
subscriptionsRouter.post(
  '/:id/renew',
  authMiddleware,
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  validate(subscriptionParamsSchema),
  renewSubscriptionHandler
);

// Dedicated router for GET /api/me/subscriptions
export const meSubscriptionsRouter = Router();
meSubscriptionsRouter.get(
  '/',
  authMiddleware,
  requireRole('CUSTOMER'),
  getMySubscriptionsHandler
);
