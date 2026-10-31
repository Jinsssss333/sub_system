import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/errors.js';
import { sendEmail } from '../../config/mailer.js';
import { escapeHtml } from '../../utils/html.js';
import { ForgotPasswordInput, LoginInput, ResetPasswordInput, SignupInput } from './auth.schema.js';

const RESET_TTL_MS = 30 * 60 * 1000;
// Fixed hash so unknown-email logins spend the same bcrypt time as real ones.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.ob/ZDZVv2Mf1WuYEXb3NLQbwF6eG';

function issueToken(user: { id: string; email: string; role: Role }, customerId?: string) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, customerId }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function loginUser(input: LoginInput) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { customer: true },
  });

  const isPasswordValid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const customerId = user.customer?.id;

  const token = issueToken(user, customerId);

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

  const token = issueToken(user, customerId);

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

/**
 * Always resolves the same way whether or not the email exists (no account enumeration).
 * The raw token exists only in the emailed link; the database stores its SHA-256 hash.
 */
export async function requestPasswordReset(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  if (!user) return;

  const token = randomBytes(32).toString('hex');
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } }),
  ]);

  const link = `${env.APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your Brightloop password',
    text: `Hi ${user.name},\n\nReset your password within 30 minutes: ${link}\n\nIf you did not ask for this, ignore this email.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p><a href="${escapeHtml(link)}">Reset your password</a>. The link expires in 30 minutes and works once.</p><p>If you did not ask for this, ignore this email.</p>`,
  });
}

export async function resetPassword(input: ResetPasswordInput) {
  const tokenHash = hashResetToken(input.token);
  const passwordHash = await bcrypt.hash(input.password, 10);

  await prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest('This reset link is invalid or has expired', 'INVALID_RESET_TOKEN');
    }
    // Atomic single-use claim: only one concurrent request can flip usedAt.
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw ApiError.badRequest('This reset link is invalid or has expired', 'INVALID_RESET_TOKEN');
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
  });
}
