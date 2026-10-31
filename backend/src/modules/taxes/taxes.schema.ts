import { z } from 'zod';

export const createTaxSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Tax name is required'),
    rateBps: z
      .number()
      .int()
      .min(0, 'Tax rate in basis points must be at least 0')
      .max(10000, 'Tax rate in basis points cannot exceed 10000 (100%)'),
    active: z.boolean().optional().default(true),
  }).strict(),
});

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
