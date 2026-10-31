import { z } from 'zod';
import { createSubscriptionBody, subscriptionLineBody, transitionBody, updateSubscriptionBody } from '@brightloop/shared';
import { SubscriptionStatus } from '@prisma/client';

export const subscriptionLineInputSchema = subscriptionLineBody;

export const createSubscriptionSchema = z.object({ body: createSubscriptionBody });

export const updateSubscriptionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: updateSubscriptionBody,
});

export const transitionSubscriptionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: transitionBody,
});

export const myQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.nativeEnum(SubscriptionStatus).optional(),
  }),
});

export const subscriptionQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.nativeEnum(SubscriptionStatus).optional(),
    customerId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    q: z.string().trim().optional(),
  }),
});

export const subscriptionParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>['body'];
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>['body'];
export type SubscriptionQueryParams = z.infer<typeof subscriptionQuerySchema>['query'];
