import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/errors.js';
import { CreatePlanInput, ListPlansQuery } from './plans.schema.js';

export async function listPlans(query: ListPlansQuery) {
  const { q, page = 1, pageSize = 20, billingPeriod } = query;
  const skip = (page - 1) * pageSize;
  const take = Math.min(pageSize, 100);

  const where: any = {};
  if (q && q.trim().length > 0) {
    where.name = { contains: q.trim(), mode: 'insensitive' };
  }
  if (billingPeriod) {
    where.billingPeriod = billingPeriod;
  }

  const [total, plans] = await Promise.all([
    prisma.plan.count({ where }),
    prisma.plan.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    data: plans,
    meta: {
      page,
      pageSize: take,
      total,
    },
  };
}

export async function getPlanById(id: string) {
  const plan = await prisma.plan.findUnique({
    where: { id },
  });

  if (!plan) {
    throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
  }

  return plan;
}

export async function createPlan(input: CreatePlanInput) {
  const plan = await prisma.plan.create({
    data: {
      name: input.name,
      price: input.price,
      billingPeriod: input.billingPeriod,
      minQuantity: input.minQuantity,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      autoClose: input.autoClose,
      closable: input.closable,
      pausable: input.pausable,
      renewable: input.renewable,
    },
  });

  return plan;
}

