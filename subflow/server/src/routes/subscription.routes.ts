import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, enforceCustomerOwnership } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { calculateNextBillingDate } from '../utils/dateUtils';
import { roundMoney, addMoney, multiplyMoney, calculatePercentage } from '../utils/decimalUtils';

const router = Router();
router.use(authenticate);
const checkoutTransactionOptions = process.env.DATABASE_URL?.startsWith('file:')
  ? undefined
  : { isolationLevel: 'Serializable' as const };

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

const demoCheckoutSchema = z.object({
  planId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  paymentMethod: z.enum(['UPI', 'CARD', 'NET_BANKING']),
  upiId: z.string().max(120).optional(),
  simulateFailure: z.boolean().default(false),
}).superRefine((data, context) => {
  if (data.paymentMethod === 'UPI' && !data.simulateFailure && !/^[\w.-]+@[\w.-]+$/.test(data.upiId || '')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['upiId'],
      message: 'Enter a demo UPI ID, for example demo@upi.',
    });
  }
});

/**
 * POST /api/subscriptions/demo-checkout
 * Creates a clearly marked demo subscription, paid invoice, and payment atomically.
 */
router.post('/demo-checkout', requireRole('CUSTOMER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_CHECKOUT_ENABLED !== 'true') {
      throw new AppError('Demo checkout is not enabled for this environment.', 404);
    }

    const validated = demoCheckoutSchema.parse(req.body);
    if (validated.simulateFailure) {
      res.status(402).json({
        success: false,
        error: 'Demo payment declined. No subscription, invoice, or payment was created. You can retry the demo checkout.',
        demoMode: true,
      });
      return;
    }

    const customerId = req.user!.customerProfileId;
    if (!customerId) throw new AppError('Customer profile is not available for checkout.', 400);

    const transactionReference = `DEMO-${customerId}-${validated.idempotencyKey}`;
    const existingPayment = await prisma.payment.findUnique({
      where: { transactionReference },
      include: { invoice: { include: { subscription: { include: { plan: true } } } } },
    });
    if (existingPayment) {
      if (
        existingPayment.customerId !== customerId ||
        existingPayment.invoice.subscription?.planId !== validated.planId
      ) {
        throw new AppError('Checkout reference is not available.', 409);
      }
      res.json({
        success: true,
        message: 'This demo checkout was already completed.',
        data: {
          subscriptionId: existingPayment.invoice.subscription.id,
          subscriptionNumber: existingPayment.invoice.subscription.subscriptionNumber,
          status: existingPayment.invoice.subscription.status,
          planName: existingPayment.invoice.subscription.plan.name,
          invoiceId: existingPayment.invoice.id,
          invoiceNumber: existingPayment.invoice.invoiceNumber,
          paymentId: existingPayment.id,
          transactionReference: existingPayment.transactionReference,
          amount: existingPayment.amount,
          paymentDate: existingPayment.paymentDate,
          demoMode: true,
        },
      });
      return;
    }

    const now = new Date();
    const [plan, customer] = await Promise.all([
      prisma.subscriptionPlan.findUnique({ where: { id: validated.planId } }),
      prisma.customerProfile.findUnique({
        where: { id: customerId },
        include: { user: true },
      }),
    ]);

    if (
      !plan ||
      !plan.isActive ||
      plan.availabilityStart > now ||
      (plan.availabilityEnd && plan.availabilityEnd < now)
    ) {
      throw new AppError('This subscription plan is not currently available.', 404);
    }
    if (!customer || customer.userId !== req.user!.id) {
      throw new AppError('Customer profile is not available for checkout.', 404);
    }

    const startDate = new Date();
    const paymentMethod = {
      UPI: 'UPI',
      CARD: 'CREDIT_CARD',
      NET_BANKING: 'BANK_TRANSFER',
    }[validated.paymentMethod];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const currentPlan = await tx.subscriptionPlan.findUnique({
            where: { id: validated.planId },
          });
          if (
            !currentPlan ||
            !currentPlan.isActive ||
            currentPlan.availabilityStart > startDate ||
            (currentPlan.availabilityEnd && currentPlan.availabilityEnd < startDate)
          ) {
            throw new AppError('This subscription plan is not currently available.', 404);
          }

          const applicableTaxes = await tx.taxRule.findMany({
            where: {
              isActive: true,
              effectiveFrom: { lte: startDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
              applicableProducts: null,
            },
            orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
          });
          const applicableTax = applicableTaxes.find((rule) => rule.code === 'GST-18');
          const subtotal = roundMoney(currentPlan.price);
          const taxRate = applicableTax?.rate ?? 18;
          const taxAmount = calculatePercentage(subtotal, taxRate);
          const total = addMoney(subtotal, taxAmount);
          const nextBillingDate = calculateNextBillingDate(startDate, currentPlan.billingFrequency);

          const [subscriptionCount, invoiceCount, paymentCount] = await Promise.all([
            tx.subscription.count(),
            tx.invoice.count(),
            tx.payment.count(),
          ]);
          const subscriptionNumber = `SUB-${startDate.getFullYear()}-${String(subscriptionCount + 1).padStart(4, '0')}`;
          const invoiceNumber = `INV-${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(invoiceCount + 1).padStart(4, '0')}`;
          const paymentNumber = `PAY-${startDate.getFullYear()}-${String(paymentCount + 1).padStart(5, '0')}`;

          const subscription = await tx.subscription.create({
            data: {
              subscriptionNumber,
              customerId,
              planId: currentPlan.id,
              status: 'ACTIVE',
              startDate,
              nextBillingDate,
              paymentTerms: 'Paid in demo checkout',
              autoClose: currentPlan.autoClose,
              allowEarlyCancellation: currentPlan.allowEarlyCancellation,
              allowPause: currentPlan.allowPause,
              allowRenewal: currentPlan.allowRenewal,
              subtotal,
              taxAmount,
              discountAmount: 0,
              grandTotal: total,
            },
          });

          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              subscriptionId: subscription.id,
              customerId,
              invoiceDate: startDate,
              dueDate: startDate,
              status: 'PAID',
              subtotal,
              taxAmount,
              discountAmount: 0,
              grandTotal: total,
              amountPaid: total,
              outstandingBalance: 0,
              notes: 'DEMO MODE — Simulated payment; no real money was charged.',
              lines: {
                create: [{
                  description: `${currentPlan.name} (${currentPlan.billingFrequency} demo subscription)`,
                  quantity: 1,
                  unitPrice: subtotal,
                  taxRate,
                  taxAmount,
                  discountAmount: 0,
                  lineTotal: total,
                }],
              },
            },
          });

          await tx.billingPeriod.create({
            data: {
              subscriptionId: subscription.id,
              periodStart: startDate,
              periodEnd: nextBillingDate,
              status: 'INVOICED',
              invoiceId: invoice.id,
            },
          });

          const payment = await tx.payment.create({
            data: {
              paymentNumber,
              invoiceId: invoice.id,
              customerId,
              paymentMethod,
              amount: total,
              paymentDate: startDate,
              transactionReference,
              notes: `DEMO MODE — Simulated ${validated.paymentMethod} payment; no real money was charged.`,
              recordedByUserId: req.user!.id,
            },
          });

          await tx.subscriptionStatusHistory.create({
            data: {
              subscriptionId: subscription.id,
              previousStatus: 'DRAFT',
              newStatus: 'ACTIVE',
              reason: 'Activated after successful simulated demo payment.',
              changedByUserId: req.user!.id,
            },
          });

          return { subscription, invoice, payment, total, planName: currentPlan.name };
        }, checkoutTransactionOptions);

        res.status(201).json({
          success: true,
          message: 'Demo checkout completed. No real money was charged.',
          data: {
            subscriptionId: result.subscription.id,
            subscriptionNumber: result.subscription.subscriptionNumber,
            status: result.subscription.status,
            planName: result.planName,
            invoiceId: result.invoice.id,
            invoiceNumber: result.invoice.invoiceNumber,
            paymentId: result.payment.id,
            transactionReference: result.payment.transactionReference,
            amount: result.payment.amount,
            paymentDate: result.payment.paymentDate,
            demoMode: true,
          },
        });
        return;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'P2002') {
          const duplicatePayment = await prisma.payment.findUnique({
            where: { transactionReference },
            include: { invoice: { include: { subscription: { include: { plan: true } } } } },
          });
          if (
            duplicatePayment &&
            duplicatePayment.customerId === customerId &&
            duplicatePayment.invoice.subscription?.planId === validated.planId
          ) {
            res.json({
              success: true,
              message: 'This demo checkout was already completed.',
              data: {
                subscriptionId: duplicatePayment.invoice.subscription.id,
                subscriptionNumber: duplicatePayment.invoice.subscription.subscriptionNumber,
                status: duplicatePayment.invoice.subscription.status,
                planName: duplicatePayment.invoice.subscription.plan.name,
                invoiceId: duplicatePayment.invoice.id,
                invoiceNumber: duplicatePayment.invoice.invoiceNumber,
                paymentId: duplicatePayment.id,
                transactionReference: duplicatePayment.transactionReference,
                amount: duplicatePayment.amount,
                paymentDate: duplicatePayment.paymentDate,
                demoMode: true,
              },
            });
            return;
          }
          if (attempt < 2) continue;
        }
        if ((code === 'P2034' || code === 'P2002') && attempt < 2) continue;
        throw error;
      }
    }
    throw new AppError('Checkout could not be completed due to a concurrent update. Please retry.', 409);
  } catch (error) {
    next(error);
  }
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
