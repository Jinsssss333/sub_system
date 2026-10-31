import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

export async function getNextSequenceNumber(
  prefix: string,
  key: string,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx || prisma;
  const counter = await client.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });

  const padded = counter.value.toString().padStart(6, '0');
  return `${prefix}-${padded}`;
}

export async function getNextSubscriptionNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  return getNextSequenceNumber('SUB', 'subscription', tx);
}


