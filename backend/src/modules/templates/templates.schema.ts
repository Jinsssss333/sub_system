import { z } from 'zod';

export const createTemplateLineSchema = z.object({
  productId: z.string().uuid({ message: 'Valid productId UUID is required' }),
  variantId: z.string().uuid({ message: 'variantId must be a valid UUID' }).nullable().optional(),
  quantity: z.number().int().min(1, { message: 'Quantity must be at least 1' }),
});

export const createTemplateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, { message: 'Template name is required' }),
    planId: z.string().uuid({ message: 'Valid planId UUID is required' }),
    validityDays: z.number().int().min(1, { message: 'validityDays must be at least 1 day' }),
    lines: z.array(createTemplateLineSchema).min(1, { message: 'At least one line item is required' }),
  }),
});

export const updateTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
    planId: z.string().uuid().optional(),
    validityDays: z.number().int().min(1).optional(),
    lines: z.array(createTemplateLineSchema).min(1).optional(),
  }),
});

export const getTemplateParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>['body'];
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>['body'];
