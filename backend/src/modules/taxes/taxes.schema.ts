import { z } from 'zod';
import { taxBody } from '@brightloop/shared';

export const createTaxSchema = z.object({ body: taxBody });

export const listTaxesQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(50),
    active: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),
  }),
});

export const getTaxParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid tax ID'),
  }),
});

export type CreateTaxInput = z.infer<typeof createTaxSchema>['body'];
export type ListTaxesQuery = z.infer<typeof listTaxesQuerySchema>['query'];

