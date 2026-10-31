import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { calculatePercentage, roundMoney, addMoney } from '../utils/decimalUtils';

const router = Router();

const planSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).toUpperCase(),
  billingFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  price: z.number().min(0),
  minQuantity: z.number().int().min(1).default(1),
  availabilityStart: z.string().or(z.date()).transform((d) => new Date(d)),
  availabilityEnd: z.string().or(z.date()).optional().nullable().transform((d) => (d ? new Date(d) : null)),
  autoClose: z.boolean().default(false),
  allowEarlyCancellation: z.boolean().default(true),
  allowPause: z.boolean().default(true),
  allowRenewal: z.boolean().default(true),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

/**
 * GET /api/plans
 * Customers view available & active plans within availability window
 * Staff & Admins see all plans
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isCustomer = req.user?.role === 'CUSTOMER';
    const now = new Date();

    const where: any = {};
    if (isCustomer) {
      where.isActive = true;
      where.availabilityStart = { lte: now };
      where.OR = [
        { availabilityEnd: null },
        { availabilityEnd: { gte: now } },
      ];
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where,
      orderBy: { price: 'asc' },
    });

    res.json({ success: true, count: plans.length, data: plans });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/plans/:id/checkout
 * Return the server-calculated demo checkout summary for the current customer.
 */
router.get('/:id/checkout', authenticate, requireRole('CUSTOMER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: req.params.id } });
    if (
      !plan ||
      !plan.isActive ||
      plan.availabilityStart > now ||
      (plan.availabilityEnd && plan.availabilityEnd < now)
    ) {
      throw new AppError('This subscription plan is not currently available.', 404);
    }

    const customer = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { customerProfile: true },
    });
    if (!customer?.customerProfile) {
      throw new AppError('Customer profile is not available for checkout.', 400);
    }

    const taxRules = await prisma.taxRule.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        applicableProducts: null,
      },
      orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
    });
    const applicableTax = taxRules.find((rule) => rule.code === 'GST-18');
    const taxRate = applicableTax?.rate ?? 18;
    const subtotal = roundMoney(plan.price);
    const taxAmount = calculatePercentage(subtotal, taxRate);

    res.json({
      success: true,
      data: {
        plan: {
          id: plan.id,
          name: plan.name,
          billingFrequency: plan.billingFrequency,
          price: subtotal,
          description: plan.description,
        },
        customer: {
          name: customer.name,
          email: customer.email,
          companyName: customer.customerProfile.companyName,
          billingAddress: customer.customerProfile.billingAddress,
          city: customer.customerProfile.city,
          state: customer.customerProfile.state,
          postalCode: customer.customerProfile.postalCode,
        },
        pricing: {
          subtotal,
          taxName: applicableTax?.name ?? 'GST (standard SaaS rate)',
          taxRate,
          taxAmount,
          total: addMoney(subtotal, taxAmount),
        },
        demoMode: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/plans/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/plans
 * Only ADMIN can create plans
 */
router.post('/', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = planSchema.parse(req.body);

    const existing = await prisma.subscriptionPlan.findUnique({
      where: { code: validated.code },
    });
    if (existing) {
      throw new AppError(`A plan with code '${validated.code}' already exists.`, 409);
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        ...validated,
        price: roundMoney(validated.price),
      },
    });

    res.status(201).json({ success: true, message: 'Subscription plan created', data: plan });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/plans/:id
 */
router.put('/:id', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = planSchema.partial().parse(req.body);

    const updateData: any = { ...validated };
    if (validated.price !== undefined) updateData.price = roundMoney(validated.price);

    const plan = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ success: true, message: 'Subscription plan updated', data: plan });
  } catch (error) {
    next(error);
  }
});

export default router;
