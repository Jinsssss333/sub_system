import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    type: z.string().trim().min(1, 'Type is required'),
    salesPrice: z.number().int().min(0, 'Sales price must be a non-negative integer in paise'),
    costPrice: z.number().int().min(0, 'Cost price must be a non-negative integer in paise'),
    notes: z.string().trim().optional(),
    active: z.boolean().optional().default(true),
  }).strict(),
});

export const createVariantSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid product ID'),
  }),
  body: z.object({
    attribute: z.string().trim().min(1, 'Attribute is required'),
    value: z.string().trim().min(1, 'Value is required'),
    extraPrice: z.number().int().min(0, 'Extra price must be a non-negative integer in paise').default(0),
  }).strict(),
});

export const listProductsQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    active: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),
  }),
});

export const getProductParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid product ID'),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type CreateVariantInput = z.infer<typeof createVariantSchema>['body'];
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>['query'];

