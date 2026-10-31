import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '../utils/decimalUtils';

const router = Router();
router.use(authenticate);

const discountSchema = z.object({
  code: z.string().min(2).toUpperCase(),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  discountValue: z.number().min(0.01),
  minOrderValue: z.number().min(0).default(0),
  minQuantity: z.number().int().min(0).default(0),
  startDate: z.string().or(z.date()).transform((d) => new Date(d)),
  expiryDate: z.string().or(z.date()).optional().nullable().transform((d) => (d ? new Date(d) : null)),
  usageLimit: z.number().int().min(1).optional().nullable(),
  isSubscriptionWide: z.boolean().default(true),
  applicableProductIds: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/discounts
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const discounts = await prisma.discountRule.findMany({
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, count: discounts.length, data: discounts });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/discounts
 * Only ADMIN can create discount rules
 */
router.post('/', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = discountSchema.parse(req.body);

    const existing = await prisma.discountRule.findUnique({
      where: { code: validated.code },
    });
    if (existing) {
      throw new AppError(`A discount rule with code '${validated.code}' already exists.`, 409);
    }

    if (validated.discountType === 'PERCENTAGE' && validated.discountValue > 100) {
      throw new AppError('Percentage discount cannot exceed 100%.', 400);
    }

    const discount = await prisma.discountRule.create({
      data: {
        ...validated,
        discountValue: roundMoney(validated.discountValue),
        minOrderValue: roundMoney(validated.minOrderValue),
      },
    });

    res.status(201).json({ success: true, message: 'Discount rule created', data: discount });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/discounts/validate
 * Validates whether a coupon code is eligible for an order
 */
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, orderAmount = 0, quantity = 1 } = req.body;
    if (!code) {
      throw new AppError('Coupon code is required', 400);
    }

    const discount = await prisma.discountRule.findUnique({
      where: { code: String(code).toUpperCase() },
    });

    if (!discount || !discount.isActive) {
      throw new AppError('Invalid or inactive discount coupon.', 404);
    }

    const now = new Date();
    if (discount.startDate > now) {
      throw new AppError('This discount promotion has not started yet.', 400);
    }

    if (discount.expiryDate && discount.expiryDate < now) {
      throw new AppError('This discount coupon has expired.', 400);
    }

    if (discount.usageLimit !== null && discount.timesUsed >= discount.usageLimit) {
      throw new AppError('This discount coupon has reached its maximum usage limit.', 400);
    }

    if (orderAmount < discount.minOrderValue) {
      throw new AppError(
        `Order amount does not meet minimum order requirement of ₹${discount.minOrderValue}.`,
        400
      );
    }

    if (quantity < discount.minQuantity) {
      throw new AppError(
        `Quantity does not meet the minimum requirement of ${discount.minQuantity} items.`,
        400
      );
    }

    let calculatedDiscount = 0;
    if (discount.discountType === 'PERCENTAGE') {
      calculatedDiscount = roundMoney((orderAmount * discount.discountValue) / 100);
    } else {
      calculatedDiscount = Math.min(orderAmount, discount.discountValue);
    }

    res.json({
      success: true,
      data: {
        discountId: discount.id,
        code: discount.code,
        discountType: discount.discountType,
        discountValue: discount.discountValue,
        calculatedDiscount,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/discounts/:id
 */
router.put('/:id', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = discountSchema.partial().parse(req.body);

    const discount = await prisma.discountRule.update({
      where: { id: req.params.id },
      data: validated,
    });

    res.json({ success: true, message: 'Discount rule updated', data: discount });
  } catch (error) {
    next(error);
  }
});

export default router;
