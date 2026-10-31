import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/errors.js';
import {
  CreateProductInput,
  CreateVariantInput,
  UpdateProductInput,
  ListProductsQuery,
} from './products.schema.js';

export async function listProducts(query: ListProductsQuery) {
  const { q, page = 1, pageSize = 20, active } = query;
  const skip = (page - 1) * pageSize;
  const take = Math.min(pageSize, 100);

  const where: any = {};
  if (q && q.trim().length > 0) {
    const search = q.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { type: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (active !== undefined) {
    where.active = active;
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take,
      include: {
        variants: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    data: products,
    meta: {
      page,
      pageSize: take,
      total,
    },
  };
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: true,
    },
  });

  if (!product) {
    throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  }

  return product;
}

export async function createProduct(input: CreateProductInput) {
  const product = await prisma.product.create({
    data: {
      name: input.name,
      type: input.type,
      salesPrice: input.salesPrice,
      costPrice: input.costPrice,
      notes: input.notes,
      active: input.active,
    },
    include: {
      variants: true,
    },
  });

  return product;
}

export async function createVariant(productId: string, input: CreateVariantInput) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  }

  try {
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        attribute: input.attribute,
        value: input.value,
        extraPrice: input.extraPrice,
      },
    });

    return variant;
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'CONFLICT', `Variant with attribute "${input.attribute}" and value "${input.value}" already exists for this product`);
    }
    throw error;
  }
}


export async function updateProduct(id: string, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  return prisma.product.update({ where: { id }, data: input, include: { variants: true } });
}
