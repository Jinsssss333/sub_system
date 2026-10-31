import { z } from 'zod';
import { Role } from '@prisma/client';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z
      .string()
      .regex(
        passwordRegex,
        'Password must be at least 9 characters with at least one uppercase letter, one lowercase letter, and one special character'
      ),
  }).strict(),
});

export const listUsersQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    role: z.nativeEnum(Role).optional(),
  }),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>['body'];
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>['query'];
