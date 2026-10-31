import { DiscountScope, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { discountBody, paginationQuery } from '@brightloop/shared';
import { prisma } from '../../config/db.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../utils/errors.js';

export const discountsRouter = Router();

const listSchema = z.object({ query: paginationQuery.extend({ scope: z.nativeEnum(DiscountScope).optional() }) });
const idSchema = z.object({ params: z.object({ id: z.string().uuid() }) });
const createSchema = z.object({ body: discountBody });

const include = { products: { include: { product: { select: { id: true, name: true } } } } } satisfies Prisma.DiscountInclude;

discountsRouter.get('/', authMiddleware, requireRole('ADMIN', 'STAFF'), validate(listSchema), async (req, res, next) => {
  try {
    const { page, pageSize, q, scope } = req.query as unknown as z.infer<typeof listSchema>['query'];
    const where: Prisma.DiscountWhereInput = {
      ...(scope ? { scope } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };
    const [total, data] = await Promise.all([
      prisma.discount.count({ where }),
      prisma.discount.findMany({ where, include, orderBy: [{ endDate: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    res.json({ data, meta: { page, pageSize, total } });
  } catch (error) {
    next(error);
  }
});

discountsRouter.get('/:id', authMiddleware, requireRole('ADMIN', 'STAFF'), validate(idSchema), async (req, res, next) => {
  try {
    const discount = await prisma.discount.findUnique({ where: { id: req.params.id }, include });
    if (!discount) throw ApiError.notFound('Discount not found', 'DISCOUNT_NOT_FOUND');
    res.json({ data: discount });
  } catch (error) {
    next(error);
  }
});

discountsRouter.post('/', authMiddleware, requireRole('ADMIN'), validate(createSchema), async (req, res, next) => {
  try {
    const input = req.body as z.infer<typeof discountBody>;
    const productIds = input.scope === 'PRODUCT' ? [...new Set(input.productIds)] : [];
    if (productIds.length > 0) {
      const found = await prisma.product.count({ where: { id: { in: productIds } } });
      if (found !== productIds.length) throw ApiError.badRequest('One or more products do not exist', 'PRODUCT_NOT_FOUND');
    }
    const discount = await prisma.discount.create({
      data: {
        name: input.name,
        type: input.type,
        value: input.value,
        scope: input.scope,
        minPurchase: input.minPurchase ?? null,
        minQuantity: input.minQuantity ?? null,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        usageLimit: input.usageLimit ?? null,
        products: { create: productIds.map((productId) => ({ productId })) },
      },
      include,
    });
    res.status(201).json({ data: discount });
  } catch (error) {
    next(error);
  }
});
