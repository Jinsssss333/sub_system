import { z } from 'zod';
import { BillingPeriod } from '@prisma/client';

export const createPlanSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Plan name is required'),
      price: z.number().int().positive('Plan price must be a positive integer in paise'),
      billingPeriod: z.nativeEnum(BillingPeriod, {
        errorMap: () => ({
          message: 'Invalid billing period. Must be DAILY, WEEKLY, MONTHLY, or YEARLY',
        }),
      }),
      minQuantity: z.number().int().min(1, 'Minimum quantity must be at least 1').default(1),
      startDate: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
        .transform((val) => new Date(val)),
      endDate: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
        .nullable()
        .optional()
        .transform((val) => (val ? new Date(val) : null)),
      autoClose: z.boolean().optional().default(false),
      closable: z.boolean().optional().default(true),
      pausable: z.boolean().optional().default(false),
      renewable: z.boolean().optional().default(true),
    })
    .strict()
    .refine(
      (data) => {
        if (data.endDate && data.startDate) {
          return data.endDate > data.startDate;
        }
        return true;
      },
      {
        message: 'End date must be after start date',
        path: ['endDate'],
      }
    ),
});

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

