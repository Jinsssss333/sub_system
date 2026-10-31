import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/errors.js';
import { LoginInput, SignupInput } from './auth.schema.js';

export async function loginUser(input: LoginInput) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { customer: true },
  });

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const customerId = user.customer?.id;

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      customerId,
    },
    env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      customerId,
    },
  };
}

export async function signupUser(input: SignupInput) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists', 'DUPLICATE_EMAIL');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: input.name,
      role: Role.CUSTOMER,
      customer: {
        create: {
          companyName: input.companyName || input.name,
          phone: input.phone || null,
          address: input.address || null,
        },
      },
    },
    include: { customer: true },
  });

  const customerId = user.customer?.id;

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      customerId,
    },
    env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      customerId,
    },
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customer: true },
  });

  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customerId: user.customer?.id,
    customer: user.customer
      ? {
          id: user.customer.id,
          companyName: user.customer.companyName,
          phone: user.customer.phone,
          address: user.customer.address,
        }
      : null,
  };
}
