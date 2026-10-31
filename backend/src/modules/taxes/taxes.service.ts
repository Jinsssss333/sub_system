import { prisma } from '../../config/db.js';
import { CreateTaxInput, ListTaxesQuery } from './taxes.schema.js';

export async function listTaxes(query: ListTaxesQuery) {
  const { q, page = 1, pageSize = 50, active } = query;
  const skip = (page - 1) * pageSize;
  const take = Math.min(pageSize, 100);

  const where: any = {};
  if (q && q.trim().length > 0) {
    where.name = { contains: q.trim(), mode: 'insensitive' };
  }
  if (active !== undefined) {
    where.active = active;
  }

  const [total, taxes] = await Promise.all([
    prisma.tax.count({ where }),
    prisma.tax.findMany({
      where,
      skip,
      take,
      orderBy: { rateBps: 'asc' },
    }),
  ]);

  return {
    data: taxes,
    meta: {
      page,
      pageSize: take,
      total,
    },
  };
}

export async function getTaxById(id: string) {
  const tax = await prisma.tax.findUnique({
    where: { id },
  });

  if (!tax) {
    const error: any = new Error('Tax not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return tax;
}

export async function createTax(input: CreateTaxInput) {
  const tax = await prisma.tax.create({
    data: {
      name: input.name,
      rateBps: input.rateBps,
      active: input.active,
    },
  });

  return tax;
}
