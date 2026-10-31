import { z } from 'zod';
import { productBody, variantBody } from '@brightloop/shared';

export const createProductSchema = z.object({ body: productBody });

export const updateProductSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid product ID') }),
  body: productBody.partial().strict(),
});

export const createVariantSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid product ID') }),
  body: variantBody,
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
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type CreateVariantInput = z.infer<typeof createVariantSchema>['body'];
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>['query'];

