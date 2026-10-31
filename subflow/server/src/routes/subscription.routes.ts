import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, enforceCustomerOwnership } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { calculateNextBillingDate } from '../utils/dateUtils';
import { roundMoney, addMoney, multiplyMoney, calculatePercentage } from '../utils/decimalUtils';

const router = Router();
router.use(authenticate);

const subscriptionLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0).optional(),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0),
});

const createSubscriptionSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
  startDate: z.string().or(z.date()).optional().transform((d) => (d ? new Date(d) : new Date())),
  expiryDate: z.string().or(z.date()).optional().nullable().transform((d) => (d ? new Date(d) : null)),
  paymentTerms: z.string().default('Net 15'),
  lines: z.array(subscriptionLineSchema).min(1),
});

/**
 * GET /api/subscriptions
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

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        customer: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            grandTotal: true,
            amountPaid: true,
            outstandingBalance: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: subscriptions.length, data: subscriptions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscriptions/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
        invoices: {
          orderBy: { invoiceDate: 'desc' },
        },
        statusHistory: {
          include: {
            changedBy: { select: { name: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sub) {
      throw new AppError('Subscription not found', 404);
    }

    enforceCustomerOwnership(req, sub.customerId);

    res.json({ success: true, data: sub });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscriptions
 * Staff and Admins create subscriptions directly
 */
router.post('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createSubscriptionSchema.parse(req.body);

    const customer = await prisma.customerProfile.findUnique({
      where: { id: validated.customerId },
    });
    if (!customer) throw new AppError('Customer not found', 404);

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: validated.planId },
    });
    if (!plan || !plan.isActive) throw new AppError('Subscription plan invalid or inactive', 400);

    const startDate = validated.startDate || new Date();
    const nextBillingDate = calculateNextBillingDate(startDate, plan.billingFrequency);

    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    const linesData: any[] = [];
    for (const item of validated.lines) {
      const prod = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!prod) throw new AppError(`Product ${item.productId} not found`, 404);

      let unitPrice = item.unitPrice ?? prod.basePrice;
      if (item.variantId) {
        const v = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
        if (v) unitPrice = addMoney(prod.basePrice, v.priceAdjustment);
      }

      const gross = multiplyMoney(unitPrice, item.quantity);
      const disc = roundMoney(item.discountAmount || 0);
      const taxable = Math.max(0, gross - disc);
      const tax = calculatePercentage(taxable, item.taxRate || 0);
      const lineTotal = roundMoney(taxable + tax);

      subtotal = addMoney(subtotal, gross);
      taxAmount = addMoney(taxAmount, tax);
      discountAmount = addMoney(discountAmount, disc);

      linesData.push({
        productId: prod.id,
        variantId: item.variantId || null,
        quantity: item.quantity,
        unitPrice,
        discountAmount: disc,
        taxRate: item.taxRate || 0,
        lineTotal,
      });
    }

    const grandTotal = Math.max(0, roundMoney(subtotal - discountAmount + taxAmount));
    const subCount = await prisma.subscription.count();
    const subscriptionNumber = `SUB-${startDate.getFullYear()}-${String(subCount + 1).padStart(4, '0')}`;

    const sub = await prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId: validated.customerId,
          planId: plan.id,
          status: 'ACTIVE',
          startDate,
          expiryDate: validated.expiryDate,
          nextBillingDate,
          paymentTerms: validated.paymentTerms,
          autoClose: plan.autoClose,
          allowEarlyCancellation: plan.allowEarlyCancellation,
          allowPause: plan.allowPause,
          allowRenewal: plan.allowRenewal,
          subtotal,
          taxAmount,
          discountAmount,
          grandTotal,
          lines: {
            create: linesData,
          },
        },
      });

      await tx.subscriptionStatusHistory.create({
        data: {
          subscriptionId: created.id,
          previousStatus: 'DRAFT',
          newStatus: 'ACTIVE',
          reason: 'Initial direct subscription setup',
          changedByUserId: req.user!.id,
        },
      });

      return created;
    });

    const full = await prisma.subscription.findUnique({
      where: { id: sub.id },
      include: {
        customer: { include: { user: true } },
        plan: true,
        lines: { include: { product: true, variant: true } },
      },
    });

    res.status(201).json({ success: true, message: 'Subscription created', data: full });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscriptions/:id/pause
 * Pause subscription - must respect plan.allowPause
 */
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });
    if (!sub) throw new AppError('Subscription not found', 404);

    enforceCustomerOwnership(req, sub.customerId);

    if (!sub.plan.allowPause) {
      throw new AppError('Pausing is not permitted for this subscription plan.', 400);
    }

    if (sub.status !== 'ACTIVE') {
      throw new AppError(`Cannot pause a subscription with status '${sub.status}'.`, 400);
    }

    const { reason = 'Customer requested pause' } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'PAUSED' },
      });

      await tx.subscriptionStatusHistory.create({
        data: {
          subscriptionId: sub.id,
          previousStatus: 'ACTIVE',
          newStatus: 'PAUSED',
          reason,
          changedByUserId: req.user!.id,
        },
      });
    });

    res.json({ success: true, message: 'Subscription paused successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscriptions/:id/resume
 * Resume paused subscription
 */
router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });
    if (!sub) throw new AppError('Subscription not found', 404);

    enforceCustomerOwnership(req, sub.customerId);

    if (sub.status !== 'PAUSED') {
      throw new AppError(`Cannot resume a subscription with status '${sub.status}'.`, 400);
    }

    // Set next billing date starting from today + cycle
    const now = new Date();
    const nextBillingDate = calculateNextBillingDate(now, sub.plan.billingFrequency);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          nextBillingDate,
        },
      });

      await tx.subscriptionStatusHistory.create({
        data: {
          subscriptionId: sub.id,
          previousStatus: 'PAUSED',
          newStatus: 'ACTIVE',
          reason: 'Subscription resumed',
          changedByUserId: req.user!.id,
        },
      });
    });

    res.json({ success: true, message: 'Subscription resumed successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscriptions/:id/cancel
 * Cancel subscription - must respect plan.allowEarlyCancellation
 */
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });
    if (!sub) throw new AppError('Subscription not found', 404);

    enforceCustomerOwnership(req, sub.customerId);

    if (!sub.plan.allowEarlyCancellation && req.user?.role === 'CUSTOMER') {
      throw new AppError('Early cancellation is not allowed by this subscription plan policy.', 400);
    }

    if (sub.status === 'CLOSED') {
      throw new AppError('Subscription is already closed.', 400);
    }

    const { reason = 'Cancelled by user' } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'CLOSED' },
      });

      await tx.subscriptionStatusHistory.create({
        data: {
          subscriptionId: sub.id,
          previousStatus: sub.status,
          newStatus: 'CLOSED',
          reason,
          changedByUserId: req.user!.id,
        },
      });
    });

    res.json({ success: true, message: 'Subscription cancelled and closed successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscriptions/:id/renew
 * Renew subscription - must respect plan.allowRenewal
 */
router.post('/:id/renew', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });
    if (!sub) throw new AppError('Subscription not found', 404);

    enforceCustomerOwnership(req, sub.customerId);

    if (!sub.plan.allowRenewal) {
      throw new AppError('Renewal is not allowed for this subscription plan.', 400);
    }

    const currentBase = sub.expiryDate && new Date(sub.expiryDate) > new Date()
      ? new Date(sub.expiryDate)
      : new Date();

    const newExpiry = calculateNextBillingDate(currentBase, sub.plan.billingFrequency);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          expiryDate: newExpiry,
        },
      });

      await tx.subscriptionStatusHistory.create({
        data: {
          subscriptionId: sub.id,
          previousStatus: sub.status,
          newStatus: 'ACTIVE',
          reason: `Renewed until ${newExpiry.toISOString().slice(0, 10)}`,
          changedByUserId: req.user!.id,
        },
      });
    });

    res.json({
      success: true,
      message: `Subscription successfully renewed until ${newExpiry.toISOString().slice(0, 10)}`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
