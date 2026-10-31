import { Request, Response, NextFunction } from 'express';
import { SubscriptionsService } from './subscriptions.service.js';
import { ApiError } from '../../utils/errors.js';
import { SubscriptionStatus } from '@prisma/client';
import { SubscriptionQueryParams } from './subscriptions.schema.js';

export async function createSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const subscription = await SubscriptionsService.createSubscription(req.body);
    return res.status(201).json({ data: subscription });
  } catch (error) {
    return next(error);
  }
}

export async function getSubscriptionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await SubscriptionsService.getSubscriptions(
      req.query as unknown as SubscriptionQueryParams
    );
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getSubscriptionByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // If user is a customer, enforce scoping to their customerId
    const customerIdScope = req.user?.role === 'CUSTOMER' ? req.user.customerId ?? '__none__' : undefined;
    const subscription = await SubscriptionsService.getSubscriptionById(
      req.params.id,
      customerIdScope
    );
    return res.json({ data: subscription });
  } catch (error) {
    return next(error);
  }
}

export async function updateSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const subscription = await SubscriptionsService.updateSubscription(req.params.id, req.body);
    return res.json({ data: subscription });
  } catch (error) {
    return next(error);
  }
}

export async function transitionSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const isCustomer = req.user?.role === 'CUSTOMER';
    const subscription = await SubscriptionsService.transitionSubscription(
      req.params.id,
      req.body.to,
      isCustomer,
      isCustomer ? req.user?.customerId ?? '__none__' : undefined
    );
    return res.json({ data: subscription });
  } catch (error) {
    return next(error);
  }
}

export async function pauseSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const customerIdScope = req.user?.role === 'CUSTOMER' ? req.user.customerId ?? '__none__' : undefined;
    const subscription = await SubscriptionsService.pauseSubscription(
      req.params.id,
      customerIdScope
    );
    return res.json({ data: subscription });
  } catch (error) {
    return next(error);
  }
}

export async function resumeSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const customerIdScope = req.user?.role === 'CUSTOMER' ? req.user.customerId ?? '__none__' : undefined;
    const subscription = await SubscriptionsService.resumeSubscription(
      req.params.id,
      customerIdScope
    );
    return res.json({ data: subscription });
  } catch (error) {
    return next(error);
  }
}

export async function renewSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const customerIdScope = req.user?.role === 'CUSTOMER' ? req.user.customerId ?? '__none__' : undefined;
    const subscription = await SubscriptionsService.renewSubscription(
      req.params.id,
      customerIdScope
    );
    return res.status(201).json({ data: subscription });
  } catch (error) {
    return next(error);
  }
}

export async function getMySubscriptionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const customerId = req.user?.customerId;
    if (!customerId) {
      throw ApiError.forbidden('User does not have an associated customer profile', 'NOT_A_CUSTOMER');
    }
    const { page, pageSize, status } = req.query as unknown as { page?: number; pageSize?: number; status?: SubscriptionStatus };
    return res.json(await SubscriptionsService.getCustomerSubscriptions(customerId, Number(page) || 1, Math.min(Number(pageSize) || 20, 100), status));
  } catch (error) {
    return next(error);
  }
}
