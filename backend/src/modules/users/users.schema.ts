import { z } from 'zod';
import { Role } from '@prisma/client';
import { createStaffBody } from '@brightloop/shared';

export const createStaffSchema = z.object({ body: createStaffBody });

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

