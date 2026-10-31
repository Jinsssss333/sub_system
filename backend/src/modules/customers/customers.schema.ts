import { z } from 'zod';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;

export const createCustomerSchema = z.object({
  body: z.object({
    companyName: z.string().trim().optional(),
    name: z.string().trim().min(1, 'Contact person name is required'),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z
      .string()
      .regex(
        passwordRegex,
        'Password must be at least 9 characters with at least one uppercase letter, one lowercase letter, and one special character'
      )
      .optional()
      .default('Customer@1234'),
    phone: z.string().trim().optional(),
    address: z.string().trim().optional(),
  }).strict(),
});

export const listCustomersQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>['query'];
