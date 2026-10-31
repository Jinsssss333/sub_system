import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/errors.js';
import { CreateStaffInput, ListUsersQuery } from './users.schema.js';

export async function listUsers(query: ListUsersQuery) {
  const { q, page = 1, pageSize = 20, role } = query;
  const skip = (page - 1) * pageSize;
  const take = Math.min(pageSize, 100);

  const where: Prisma.UserWhereInput = {};
  if (q && q.trim().length > 0) {
    const search = q.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role) {
    where.role = role;
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data: users,
    meta: {
      page,
      pageSize: take,
      total,
    },
  };
}

export async function createStaff(input: CreateStaffInput) {
  const normalizedEmail = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw ApiError.conflict('A user with this email already exists', 'DUPLICATE_EMAIL');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.name,
      passwordHash,
      role: 'STAFF',
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}

