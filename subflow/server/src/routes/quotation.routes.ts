import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, enforceCustomerOwnership } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { roundMoney, addMoney, multiplyMoney, calculatePercentage } from '../utils/decimalUtils';
import { calculateNextBillingDate } from '../utils/dateUtils';

const router = Router();
router.use(authenticate);

const quotationLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0).optional(),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0),
});

const createQuotationSchema = z.object({
  customerId: z.string().min(1),
  templateId: z.string().optional().nullable(),
  validUntil: z.string().or(z.date()).transform((d) => new Date(d)),
  notes: z.string().optional(),
  terms: z.string().optional(),
  planId: z.string().min(1), // Target subscription plan
  couponCode: z.string().optional().nullable(),
  lines: z.array(quotationLineSchema).min(1, 'At least one product line is required'),
});

/**
 * GET /api/quotations
 * Staff & Admins see all; Customers see their own
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isCustomer = req.user?.role === 'CUSTOMER';
    const where: any = {};

    if (isCustomer) {
      where.customerId = req.user!.customerProfileId;
    }

    const status = req.query.status as string | undefined;
    if (status) {
      where.status = status.toUpperCase();
    }

    const quotations = await prisma.quotation.findMany({
      where,
      include: {
        customer: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: quotations.length, data: quotations });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/quotations/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
        template: true,
        convertedSubscription: true,
      },
    });

    if (!quotation) {
      throw new AppError('Quotation not found', 404);
    }

    enforceCustomerOwnership(req, quotation.customerId);

    res.json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/quotations
 * Staff and Admins create quotations
 */
router.post('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createQuotationSchema.parse(req.body);

    const customer = await prisma.customerProfile.findUnique({
      where: { id: validated.customerId },
    });
    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: validated.planId },
    });
    if (!plan || !plan.isActive) {
      throw new AppError('Invalid or inactive subscription plan selected.', 400);
    }

    // Process line items with accurate pricing & variant calculations
    let calculatedSubtotal = 0;
    let calculatedTaxAmount = 0;
    let calculatedDiscountAmount = 0;

    const preparedLines: Array<{
      productId: string;
      variantId?: string | null;
      planId?: string | null;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      taxRate: number;
      lineTotal: number;
    }> = [];

    for (const item of validated.lines) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new AppError(`Product ${item.productId} not found`, 404);
      }

      let unitPrice = item.unitPrice ?? product.basePrice;

      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
        });
        if (variant) {
          unitPrice = addMoney(product.basePrice, variant.priceAdjustment);
        }
      }

      const grossLine = multiplyMoney(unitPrice, item.quantity);
      const discount = roundMoney(item.discountAmount || 0);
      const taxable = Math.max(0, grossLine - discount);
      const tax = calculatePercentage(taxable, item.taxRate || 0);
      const lineTotal = roundMoney(taxable + tax);

      calculatedSubtotal = addMoney(calculatedSubtotal, grossLine);
      calculatedTaxAmount = addMoney(calculatedTaxAmount, tax);
      calculatedDiscountAmount = addMoney(calculatedDiscountAmount, discount);

      preparedLines.push({
        productId: product.id,
        variantId: item.variantId || null,
        planId: validated.planId,
        quantity: item.quantity,
        unitPrice,
        discountAmount: discount,
        taxRate: item.taxRate || 0,
        lineTotal,
      });
    }

    // Apply Coupon Code if provided
    if (validated.couponCode) {
      const discountRule = await prisma.discountRule.findUnique({
        where: { code: validated.couponCode.toUpperCase() },
      });
      if (discountRule && discountRule.isActive) {
        let couponDiscount = 0;
        if (discountRule.discountType === 'PERCENTAGE') {
          couponDiscount = calculatePercentage(calculatedSubtotal, discountRule.discountValue);
        } else {
          couponDiscount = Math.min(calculatedSubtotal, discountRule.discountValue);
        }
        calculatedDiscountAmount = addMoney(calculatedDiscountAmount, couponDiscount);
      }
    }

    const grandTotal = Math.max(
      0,
      roundMoney(calculatedSubtotal - calculatedDiscountAmount + calculatedTaxAmount)
    );

    const quotationCount = await prisma.quotation.count();
    const quotationNumber = `QUO-${new Date().getFullYear()}-${String(quotationCount + 1).padStart(4, '0')}`;

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        customerId: validated.customerId,
        templateId: validated.templateId || null,
        status: 'DRAFT',
        validUntil: validated.validUntil,
        notes: validated.notes,
        terms: validated.terms || 'Payment within 15 days of invoice date.',
        subtotal: calculatedSubtotal,
        taxAmount: calculatedTaxAmount,
        discountAmount: calculatedDiscountAmount,
        grandTotal,
        lines: {
          create: preparedLines,
        },
      },
      include: {
        lines: {
          include: { product: true, variant: true },
        },
        customer: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: quotation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/quotations/:id/status
 * Update quotation status: DRAFT -> SENT -> ACCEPTED / REJECTED / EXPIRED
 */
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const allowed = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
    if (!allowed.includes(status)) {
      throw new AppError('Invalid quotation status', 400);
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
    });
    if (!quotation) {
      throw new AppError('Quotation not found', 404);
    }

    // Customer can only ACCEPT or REJECT their own quotation
    if (req.user?.role === 'CUSTOMER') {
      enforceCustomerOwnership(req, quotation.customerId);
      if (!['ACCEPTED', 'REJECTED'].includes(status)) {
        throw new AppError('Customers can only Accept or Reject quotations.', 403);
      }
    }

    const updated = await prisma.quotation.update({
      where: { id: req.params.id },
      data: { status },
      include: { lines: true, customer: true },
    });

    res.json({ success: true, message: `Quotation status updated to ${status}`, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/quotations/:id/convert
 * Requirement 7: Convert accepted quotation into an active subscription.
 * Prevent expired or rejected quotations from being converted without explicit authorized action.
 */
router.post('/:id/convert', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        lines: true,
        customer: true,
      },
    });

    if (!quotation) {
      throw new AppError('Quotation not found', 404);
    }

    if (quotation.status === 'REJECTED') {
      throw new AppError('Cannot convert a REJECTED quotation. Please re-open or create a new one.', 400);
    }

    if (quotation.status === 'EXPIRED' || new Date(quotation.validUntil) < new Date()) {
      throw new AppError('Cannot convert an EXPIRED quotation without extending validity.', 400);
    }

    if (quotation.convertedSubscriptionId) {
      throw new AppError('This quotation has already been converted to a subscription.', 409);
    }

    // Determine plan from line item or fallback to first active monthly plan
    let planId = quotation.lines[0]?.planId;
    if (!planId) {
      const defaultPlan = await prisma.subscriptionPlan.findFirst({
        where: { isActive: true },
      });
      if (!defaultPlan) {
        throw new AppError('No active subscription plan configured.', 400);
      }
      planId = defaultPlan.id;
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new AppError('Subscription plan not found', 400);
    }

    const startDate = new Date();
    const nextBillingDate = calculateNextBillingDate(startDate, plan.billingFrequency);

    // Atomic transaction: create subscription, copy lines, update quotation status
    const result = await prisma.$transaction(async (tx) => {
      const subCount = await tx.subscription.count();
      const subscriptionNumber = `SUB-${startDate.getFullYear()}-${String(subCount + 1).padStart(4, '0')}`;

      const subscription = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId: quotation.customerId,
          planId: plan.id,
          quotationId: quotation.id,
          status: 'ACTIVE',
          startDate,
          nextBillingDate,
          paymentTerms: quotation.terms || 'Net 15',
          autoClose: plan.autoClose,
          allowEarlyCancellation: plan.allowEarlyCancellation,
          allowPause: plan.allowPause,
          allowRenewal: plan.allowRenewal,
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount,
          discountAmount: quotation.discountAmount,
          grandTotal: quotation.grandTotal,
          lines: {
            create: quotation.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discountAmount,
              taxRate: l.taxRate,
              lineTotal: l.lineTotal,
            })),
          },
        },
      });

      // Track status history
      await tx.subscriptionStatusHistory.create({
        data: {
          subscriptionId: subscription.id,
          previousStatus: 'DRAFT',
          newStatus: 'ACTIVE',
          reason: `Converted from quotation ${quotation.quotationNumber}`,
          changedByUserId: req.user!.id,
        },
      });

      // Update quotation
      await tx.quotation.update({
        where: { id: quotation.id },
        data: {
          status: 'ACCEPTED',
          convertedSubscriptionId: subscription.id,
        },
      });

      return subscription;
    });

    const fullSubscription = await prisma.subscription.findUnique({
      where: { id: result.id },
      include: {
        customer: { include: { user: true } },
        plan: true,
        lines: { include: { product: true, variant: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Quotation successfully converted to an active subscription',
      data: fullSubscription,
    });
  } catch (error) {
    next(error);
  }
});

/* ========================================================
   QUOTATION TEMPLATES
======================================================== */

/**
 * GET /api/quotations/templates/all
 */
router.get('/templates/all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.quotationTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: templates.length, data: templates });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/quotations/templates
 */
router.post('/templates', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, validityDays = 30, defaultTerms, linesData } = req.body;
    if (!name) throw new AppError('Template name is required', 400);

    const template = await prisma.quotationTemplate.create({
      data: {
        name,
        description,
        validityDays: Number(validityDays),
        defaultTerms,
        linesData: typeof linesData === 'object' ? JSON.stringify(linesData) : linesData,
      },
    });

    res.status(201).json({ success: true, message: 'Template created', data: template });
  } catch (error) {
    next(error);
  }
});

export default router;
