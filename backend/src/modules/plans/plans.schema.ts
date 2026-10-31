import { z } from 'zod';
import { BillingPeriod } from '@prisma/client';
import { planBody } from '@brightloop/shared';

export const createPlanSchema = z.object({ body: planBody });

export const listPlansQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    billingPeriod: z.nativeEnum(BillingPeriod).optional(),
  }),
});

export const getPlanParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid plan ID'),
  }),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>['body'];
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>['query'];

