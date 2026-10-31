import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/errors.js';
import { CreateTemplateInput, UpdateTemplateInput } from './templates.schema.js';

export class TemplatesService {
  /**
   * Validate that all referenced plans, products, and variants exist and are structurally valid.
   */
  private static async validateTemplateLines(
    planId: string,
    lines: { productId: string; variantId?: string | null; quantity: number }[]
  ) {
    // 1. Verify plan exists
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw ApiError.notFound(`Plan with id ${planId} not found`, 'PLAN_NOT_FOUND');
    }

    // 2. Verify all products and variants
    for (const line of lines) {
      const product = await prisma.product.findUnique({
        where: { id: line.productId },
      });
      if (!product) {
        throw ApiError.notFound(
          `Product with id ${line.productId} not found`,
          'PRODUCT_NOT_FOUND'
        );
      }

      if (line.variantId) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: line.variantId },
        });
        if (!variant) {
          throw ApiError.notFound(
            `Product variant with id ${line.variantId} not found`,
            'VARIANT_NOT_FOUND'
          );
        }
        if (variant.productId !== line.productId) {
          throw ApiError.badRequest(
            `Variant ${line.variantId} does not belong to product ${line.productId}`,
            'VARIANT_MISMATCH'
          );
        }
      }
    }
  }

  static async createTemplate(input: CreateTemplateInput) {
    await this.validateTemplateLines(input.planId, input.lines);

    return prisma.quotationTemplate.create({
      data: {
        name: input.name,
        planId: input.planId,
        validityDays: input.validityDays,
        lines: {
          create: input.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId || null,
            quantity: line.quantity,
          })),
        },
      },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });
  }

  static async getTemplates() {
    return prisma.quotationTemplate.findMany({
      orderBy: { name: 'asc' },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });
  }

  static async getTemplateById(id: string) {
    const template = await prisma.quotationTemplate.findUnique({
      where: { id },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!template) {
      throw ApiError.notFound(`Quotation template with id ${id} not found`, 'TEMPLATE_NOT_FOUND');
    }

    return template;
  }

  static async deleteTemplate(id: string) {
    const existing = await prisma.quotationTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound(`Quotation template with id ${id} not found`, 'TEMPLATE_NOT_FOUND');
    }

    await prisma.$transaction(async (tx) => {
      await tx.quotationTemplateLine.deleteMany({ where: { templateId: id } });
      await tx.quotationTemplate.delete({ where: { id } });
    });

    return { success: true };
  }
}
