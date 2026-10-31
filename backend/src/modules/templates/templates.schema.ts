import { z } from 'zod';
import { paginationQuery, templateBody, templateLineBody } from '@brightloop/shared';

export const createTemplateLineSchema = templateLineBody;

export const createTemplateSchema = z.object({ body: templateBody });

export const listTemplatesQuerySchema = z.object({ query: paginationQuery });

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
