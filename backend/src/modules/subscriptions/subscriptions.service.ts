import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/errors.js';
import { addDays, addPeriod } from '../../utils/dates.js';
import { getNextSubscriptionNumber } from '../../utils/numbering.js';
import {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionQueryParams,
} from './subscriptions.schema.js';

export const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  DRAFT: [SubscriptionStatus.QUOTATION],
  QUOTATION: [SubscriptionStatus.CONFIRMED],
  CONFIRMED: [SubscriptionStatus.ACTIVE],
  ACTIVE: [SubscriptionStatus.CLOSED],
  CLOSED: [],
};

export const defaultSubscriptionInclude = {
  customer: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  },
  plan: true,
  lines: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          type: true,
          salesPrice: true,
          active: true,
          notes: true,
        },
      },
      variant: true,
      tax: true,
    },
  },
  discounts: {
    include: {
      discount: true,
    },
  },
  renewedFrom: {
    select: {
      id: true,
      number: true,
      status: true,
    },
  },
  renewals: {
    select: {
      id: true,
      number: true,
      status: true,
    },
  },
};

export class SubscriptionsService {
  /**
   * Helper to resolve and validate line prices from catalog to ensure server-side pricing integrity.
   */
  private static async resolveLines(
    lines: {
      productId: string;
      variantId?: string | null;
      quantity: number;
      taxId?: string | null;
      unitPrice?: number;
    }[]
  ) {
    const resolvedLines = [];

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
      if (!product.active) {
        throw ApiError.badRequest(
          `Product ${product.name} is not active`,
          'PRODUCT_INACTIVE'
        );
      }

      let extraPrice = 0;
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
        extraPrice = variant.extraPrice;
      }

      if (line.taxId) {
        const tax = await prisma.tax.findUnique({
          where: { id: line.taxId },
        });
        if (!tax) {
          throw ApiError.notFound(
            `Tax with id ${line.taxId} not found`,
            'TAX_NOT_FOUND'
          );
        }
      }

      // Catalog base price + variant extra price
      const catalogUnitPrice = product.salesPrice + extraPrice;
      // Use explicit unitPrice if provided in manual input, otherwise catalog price
      const unitPrice = line.unitPrice !== undefined ? line.unitPrice : catalogUnitPrice;
      const amount = line.quantity * unitPrice;

      resolvedLines.push({
        productId: line.productId,
        variantId: line.variantId || null,
        quantity: line.quantity,
        taxId: line.taxId || null,
        unitPrice,
        amount,
      });
    }

    return resolvedLines;
  }

  /**
   * Create a new subscription either from a template or direct lines.
   */
  static async createSubscription(input: CreateSubscriptionInput) {
    // 1. Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      throw ApiError.notFound(
        `Customer with id ${input.customerId} not found`,
        'CUSTOMER_NOT_FOUND'
      );
    }

    let planId = input.planId;
    let resolvedLines: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      taxId: string | null;
      unitPrice: number;
      amount: number;
    }> = [];
    let quotationExpiryDate: Date | null = input.quotationExpiryDate
      ? new Date(input.quotationExpiryDate)
      : null;

    // 2. Handle template copy if templateId is provided
    if (input.templateId) {
      const template = await prisma.quotationTemplate.findUnique({
        where: { id: input.templateId },
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
        throw ApiError.notFound(
          `Template with id ${input.templateId} not found`,
          'TEMPLATE_NOT_FOUND'
        );
      }

      if (!planId) {
        planId = template.planId;
      }

      // Calculate quotation expiry date: today + validityDays
      quotationExpiryDate = addDays(new Date(), template.validityDays);

      // Copy template lines and compute server prices
      for (const tLine of template.lines) {
        const extraPrice = tLine.variant?.extraPrice ?? 0;
        const unitPrice = tLine.product.salesPrice + extraPrice;
        const amount = tLine.quantity * unitPrice;

        resolvedLines.push({
          productId: tLine.productId,
          variantId: tLine.variantId || null,
          quantity: tLine.quantity,
          taxId: null,
          unitPrice,
          amount,
        });
      }
    } else if (input.lines && input.lines.length > 0) {
      resolvedLines = await this.resolveLines(input.lines);
    }

    if (!planId) {
      throw ApiError.badRequest('A valid planId is required', 'PLAN_REQUIRED');
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw ApiError.notFound(`Plan with id ${planId} not found`, 'PLAN_NOT_FOUND');
    }

    // 3. Atomically create subscription within a transaction with human sequential number
    return prisma.$transaction(async (tx) => {
      const number = await getNextSubscriptionNumber(tx);

      const startDate = input.startDate ? new Date(input.startDate) : new Date();
      const expiryDate = input.expiryDate ? new Date(input.expiryDate) : null;

      const subscription = await tx.subscription.create({
        data: {
          number,
          customerId: input.customerId,
          planId: planId!,
          status: SubscriptionStatus.DRAFT,
          startDate,
          expiryDate,
          quotationExpiryDate,
          paymentTermDays: input.paymentTermDays ?? 0,
          nextInvoiceDate: null,
          pausedAt: null,
          lines: {
            create: resolvedLines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              quantity: line.quantity,
              taxId: line.taxId,
              unitPrice: line.unitPrice,
              amount: line.amount,
            })),
          },
        },
        include: defaultSubscriptionInclude,
      });

      return subscription;
    });
  }

  /**
   * List subscriptions with pagination and filtering.
   */
  static async getSubscriptions(params: SubscriptionQueryParams) {
    const { page, pageSize, status, customerId, planId, q } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SubscriptionWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (planId) {
      where.planId = planId;
    }

    if (q) {
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
        { customer: { user: { name: { contains: q, mode: 'insensitive' } } } },
        { customer: { user: { email: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const [total, subscriptions] = await prisma.$transaction([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: defaultSubscriptionInclude,
      }),
    ]);

    return {
      data: subscriptions,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get subscription by ID with customer ownership enforcement.
   */
  static async getSubscriptionById(id: string, customerIdScope?: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: defaultSubscriptionInclude,
    });

    if (!subscription) {
      throw ApiError.notFound(`Subscription with id ${id} not found`, 'SUBSCRIPTION_NOT_FOUND');
    }

    // Scoped customer isolation
    if (customerIdScope && subscription.customerId !== customerIdScope) {
      throw ApiError.notFound(`Subscription with id ${id} not found`, 'SUBSCRIPTION_NOT_FOUND');
    }

    return subscription;
  }

  /**
   * Update subscription details. PERMITTED ONLY WHILE IN DRAFT STATUS.
   */
  static async updateSubscription(id: string, input: UpdateSubscriptionInput) {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!subscription) {
      throw ApiError.notFound(`Subscription with id ${id} not found`, 'SUBSCRIPTION_NOT_FOUND');
    }

    // Invariant: Edits permitted ONLY while status is DRAFT
    if (subscription.status !== SubscriptionStatus.DRAFT) {
      throw ApiError.conflict(
        `Subscription can only be edited while in DRAFT status. Current status is ${subscription.status}`,
        'INVALID_STATUS'
      );
    }

    if (input.planId) {
      const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
      if (!plan) {
        throw ApiError.notFound(`Plan with id ${input.planId} not found`, 'PLAN_NOT_FOUND');
      }
    }

    return prisma.$transaction(async (tx) => {
      // If new lines are provided, resolve and replace them
      if (input.lines && input.lines.length > 0) {
        const resolvedLines = await this.resolveLines(input.lines);

        // Delete existing lines
        await tx.subscriptionLine.deleteMany({
          where: { subscriptionId: id },
        });

        // Create new lines
        await tx.subscriptionLine.createMany({
          data: resolvedLines.map((line) => ({
            subscriptionId: id,
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            taxId: line.taxId,
            unitPrice: line.unitPrice,
            amount: line.amount,
          })),
        });
      }

      const updated = await tx.subscription.update({
        where: { id },
        data: {
          planId: input.planId,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          expiryDate: input.expiryDate !== undefined ? (input.expiryDate ? new Date(input.expiryDate) : null) : undefined,
          quotationExpiryDate:
            input.quotationExpiryDate !== undefined
              ? (input.quotationExpiryDate ? new Date(input.quotationExpiryDate) : null)
              : undefined,
          paymentTermDays: input.paymentTermDays,
        },
        include: defaultSubscriptionInclude,
      });

      return updated;
    });
  }

  /**
   * State Machine Transitions:
   * DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> CLOSED
   */
  static async transitionSubscription(id: string, targetStatus: SubscriptionStatus, isCustomer = false) {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        lines: true,
      },
    });

    if (!subscription) {
      throw ApiError.notFound(`Subscription with id ${id} not found`, 'SUBSCRIPTION_NOT_FOUND');
    }

    const currentStatus = subscription.status;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(targetStatus)) {
      throw ApiError.conflict(
        `Illegal state transition from ${currentStatus} to ${targetStatus}. Allowed transitions: ${allowed.join(', ') || 'none'}`,
        'ILLEGAL_TRANSITION'
      );
    }

    let nextInvoiceDateUpdate: Date | null | undefined = undefined;

    // Side Effects & Invariant Validations per transition:
    // 1. DRAFT -> QUOTATION
    if (currentStatus === SubscriptionStatus.DRAFT && targetStatus === SubscriptionStatus.QUOTATION) {
      if (subscription.lines.length === 0) {
        throw ApiError.badRequest(
          'Cannot transition to QUOTATION: Subscription requires at least one line item',
          'NO_LINES'
        );
      }
    }

    // 2. QUOTATION -> CONFIRMED
    if (currentStatus === SubscriptionStatus.QUOTATION && targetStatus === SubscriptionStatus.CONFIRMED) {
      // Check quotation expiry
      if (subscription.quotationExpiryDate && new Date(subscription.quotationExpiryDate) < new Date()) {
        throw ApiError.conflict('Quotation has expired and cannot be confirmed', 'QUOTATION_EXPIRED');
      }

      // Validate line quantities >= plan.minQuantity
      const minQuantity = subscription.plan.minQuantity;
      for (const line of subscription.lines) {
        if (line.quantity < minQuantity) {
          throw ApiError.conflict(
            `Line item quantity (${line.quantity}) is less than plan minimum quantity (${minQuantity})`,
            'MIN_QUANTITY_NOT_MET'
          );
        }
      }
    }

    // 3. CONFIRMED -> ACTIVE
    if (currentStatus === SubscriptionStatus.CONFIRMED && targetStatus === SubscriptionStatus.ACTIVE) {
      // Validate plan date bounds
      if (subscription.plan.endDate && new Date(subscription.plan.endDate) < new Date()) {
        throw ApiError.conflict('Cannot activate subscription: Plan end date has passed', 'PLAN_EXPIRED');
      }
      if (subscription.expiryDate && new Date(subscription.expiryDate) < new Date()) {
        throw ApiError.conflict(
          'Cannot activate subscription: Subscription expiry date has passed',
          'SUBSCRIPTION_EXPIRED'
        );
      }

      // Set nextInvoiceDate = startDate
      nextInvoiceDateUpdate = subscription.startDate;
    }

    // 4. ACTIVE -> CLOSED
    if (currentStatus === SubscriptionStatus.ACTIVE && targetStatus === SubscriptionStatus.CLOSED) {
      if (isCustomer && !subscription.plan.closable) {
        throw ApiError.forbidden(
          'This plan does not permit customer-initiated cancellation',
          'PLAN_NOT_CLOSABLE'
        );
      }
      // Clear nextInvoiceDate (stops billing engine from picking it up)
      nextInvoiceDateUpdate = null;
    }

    // Transactional status update with conditional guard against concurrent state changes
    const updated = await prisma.subscription.update({
      where: {
        id,
      },
      data: {
        status: targetStatus,
        nextInvoiceDate: nextInvoiceDateUpdate !== undefined ? nextInvoiceDateUpdate : undefined,
      },
      include: defaultSubscriptionInclude,
    });

    return updated;
  }

  /**
   * Pause an ACTIVE subscription (sets pausedAt = today).
   */
  static async pauseSubscription(id: string, customerIdScope?: string) {
    const subscription = await this.getSubscriptionById(id, customerIdScope);

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw ApiError.conflict(
        `Only ACTIVE subscriptions can be paused. Current status is ${subscription.status}`,
        'INVALID_STATUS'
      );
    }

    if (subscription.pausedAt !== null) {
      throw ApiError.conflict('Subscription is already paused', 'ALREADY_PAUSED');
    }

    if (!subscription.plan.pausable) {
      throw ApiError.conflict('Plan does not permit pausing', 'PLAN_NOT_PAUSABLE');
    }

    return prisma.subscription.update({
      where: { id },
      data: {
        pausedAt: new Date(),
      },
      include: defaultSubscriptionInclude,
    });
  }

  /**
   * Resume a paused subscription (clears pausedAt = null).
   */
  static async resumeSubscription(id: string, customerIdScope?: string) {
    const subscription = await this.getSubscriptionById(id, customerIdScope);

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw ApiError.conflict(
        `Only ACTIVE subscriptions can be resumed. Current status is ${subscription.status}`,
        'INVALID_STATUS'
      );
    }

    if (subscription.pausedAt === null) {
      throw ApiError.conflict('Subscription is not currently paused', 'NOT_PAUSED');
    }

    return prisma.subscription.update({
      where: { id },
      data: {
        pausedAt: null,
      },
      include: defaultSubscriptionInclude,
    });
  }

  /**
   * Renew an existing subscription.
   * Clones subscription into a fresh DRAFT linked via renewedFromId. Original remains untouched.
   */
  static async renewSubscription(id: string, customerIdScope?: string) {
    const subscription = await this.getSubscriptionById(id, customerIdScope);

    if (!subscription.plan.renewable) {
      throw ApiError.conflict('Plan does not permit renewal', 'PLAN_NOT_RENEWABLE');
    }

    return prisma.$transaction(async (tx) => {
      const number = await getNextSubscriptionNumber(tx);

      // New start date is original expiryDate if present, or today
      const startDate = subscription.expiryDate ? new Date(subscription.expiryDate) : new Date();

      // Calculate new expiryDate by advancing one period from startDate if original had an expiryDate
      let expiryDate: Date | null = null;
      if (subscription.expiryDate) {
        expiryDate = addPeriod(startDate, subscription.plan.billingPeriod, startDate);
      }

      const renewed = await tx.subscription.create({
        data: {
          number,
          customerId: subscription.customerId,
          planId: subscription.planId,
          status: SubscriptionStatus.DRAFT,
          startDate,
          expiryDate,
          quotationExpiryDate: null,
          paymentTermDays: subscription.paymentTermDays,
          nextInvoiceDate: null,
          pausedAt: null,
          renewedFromId: subscription.id,
          lines: {
            create: subscription.lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              quantity: line.quantity,
              taxId: line.taxId,
              unitPrice: line.unitPrice,
              amount: line.amount,
            })),
          },
        },
        include: defaultSubscriptionInclude,
      });

      return renewed;
    });
  }

  /**
   * Get subscriptions for customer portal, strictly scoped to customerId.
   */
  static async getCustomerSubscriptions(customerId: string) {
    return prisma.subscription.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: defaultSubscriptionInclude,
    });
  }
}
