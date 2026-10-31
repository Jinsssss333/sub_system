import { z } from 'zod';
import { SubscriptionStatus } from '@prisma/client';

export const subscriptionLineInputSchema = z.object({
  productId: z.string().uuid({ message: 'Valid productId UUID is required' }),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1, { message: 'Quantity must be at least 1' }),
  taxId: z.string().uuid().nullable().optional(),
  unitPrice: z.number().int().min(0).optional(),
});

export const createSubscriptionSchema = z.object({
  body: z
    .object({
      customerId: z.string().uuid({ message: 'Valid customerId UUID is required' }),
      templateId: z.string().uuid().optional(),
      planId: z.string().uuid().optional(),
      startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
      expiryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
      quotationExpiryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
      paymentTermDays: z.number().int().min(0).default(0),
      lines: z.array(subscriptionLineInputSchema).optional(),
    })
    .refine((data) => data.templateId || (data.planId && data.lines && data.lines.length > 0), {
      message: 'Either templateId or both planId and at least one line item must be provided',
      path: ['templateId'],
    }),
});

export const updateSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    planId: z.string().uuid().optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    expiryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
    quotationExpiryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
    paymentTermDays: z.number().int().min(0).optional(),
    lines: z.array(subscriptionLineInputSchema).min(1).optional(),
  }),
});

export const transitionSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    to: z.nativeEnum(SubscriptionStatus, {
      errorMap: () => ({ message: 'Invalid target status. Must be DRAFT, QUOTATION, CONFIRMED, ACTIVE, or CLOSED' }),
    }),
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
