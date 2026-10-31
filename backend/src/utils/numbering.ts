import { prisma } from '../config/db.js';

export async function getNextSequenceNumber(prefix: string, key: string): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });

  const padded = counter.value.toString().padStart(6, '0');
  return `${prefix}-${padded}`;
}
