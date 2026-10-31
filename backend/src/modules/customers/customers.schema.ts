import { z } from 'zod';
import { customerBody } from '@brightloop/shared';

export const createCustomerSchema = z.object({ body: customerBody });

export const listCustomersQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>['query'];
