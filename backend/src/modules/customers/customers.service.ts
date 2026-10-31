import bcrypt from 'bcryptjs';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/errors.js';
import { AuthUser } from '../../middleware/auth.js';
import { CreateCustomerInput, ListCustomersQuery } from './customers.schema.js';

export async function listCustomers(query: ListCustomersQuery) {
  const { q, page = 1, pageSize = 20 } = query;
  const skip = (page - 1) * pageSize;
  const take = Math.min(pageSize, 100);

  const where: any = {};
  if (q && q.trim().length > 0) {
    const search = q.trim();
    where.OR = [
      { companyName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  const data = customers.map((c) => ({
    id: c.id,
    companyName: c.companyName,
    phone: c.phone,
    address: c.address,
    user: {
      id: c.user.id,
      name: c.user.name,
      email: c.user.email,
      role: c.user.role,
      createdAt: c.user.createdAt,
    },
  }));

  return {
    data,
    meta: {
      page,
      pageSize: take,
      total,
    },
  };
}

export async function createCustomer(input: CreateCustomerInput) {
  const normalizedEmail = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new ApiError(409, 'CONFLICT', 'A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: input.name,
        passwordHash,
        role: 'CUSTOMER',
      },
    });

    const customer = await tx.customer.create({
      data: {
        userId: user.id,
        companyName: input.companyName,
        phone: input.phone,
        address: input.address,
      },
    });

    return {
      id: customer.id,
      companyName: customer.companyName,
      phone: customer.phone,
      address: customer.address,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  });

  return result;
}

export async function getCustomerById(id: string, requestingUser: AuthUser) {
  if (requestingUser.role === 'CUSTOMER' && requestingUser.customerId !== id) {
    throw new ApiError(404, 'NOT_FOUND', 'Customer not found');
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) {
    throw new ApiError(404, 'NOT_FOUND', 'Customer not found');
  }

  return {
    id: customer.id,
    companyName: customer.companyName,
    phone: customer.phone,
    address: customer.address,
    user: {
      id: customer.user.id,
      name: customer.user.name,
      email: customer.user.email,
      role: customer.user.role,
      createdAt: customer.user.createdAt,
    },
  };
}

