import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { roundMoney, addMoney, subtractMoney } from '../utils/decimalUtils';

const router = Router();
router.use(authenticate);

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  paymentMethod: z.enum(['UPI', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'OTHER']),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().or(z.date()).optional().transform((d) => (d ? new Date(d) : new Date())),
  transactionReference: z.string().min(3, 'Transaction reference must be at least 3 characters'),
  notes: z.string().optional(),
});

/**
 * GET /api/payments
 * Staff and Admin view all payments; Customer views own payments
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isCustomer = req.user?.role === 'CUSTOMER';
    const where: any = {};

    if (isCustomer) {
      where.customerId = req.user!.customerProfileId;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            grandTotal: true,
            status: true,
          },
        },
        customer: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        recordedBy: {
          select: { name: true, role: true },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    res.json({ success: true, count: payments.length, data: payments });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments
 * Staff and Admin record payments against an invoice
 * Strict transaction safety & balance reconciliation
 */
router.post('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = paymentSchema.parse(req.body);

    const paymentAmount = roundMoney(validated.amount);
    if (paymentAmount <= 0) {
      throw new AppError('Payment amount must be at least one paisa.', 400);
    }

    let result;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            const invoice = await tx.invoice.findUnique({
              where: { id: validated.invoiceId },
            });

            if (!invoice) throw new AppError('Invoice not found', 404);
            if (invoice.status === 'PAID') {
              throw new AppError('This invoice is already fully paid.', 400);
            }
            if (invoice.status === 'CANCELLED') {
              throw new AppError('Cannot record payment for a cancelled invoice.', 400);
            }
            if (paymentAmount > invoice.outstandingBalance) {
              throw new AppError(
                `Payment amount (₹${paymentAmount}) cannot exceed outstanding balance of ₹${invoice.outstandingBalance}.`,
                400
              );
            }

            const paymentCount = await tx.payment.count();
            const paymentNumber = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(5, '0')}`;
            const payment = await tx.payment.create({
              data: {
                paymentNumber,
                invoiceId: invoice.id,
                customerId: invoice.customerId,
                paymentMethod: validated.paymentMethod,
                amount: paymentAmount,
                paymentDate: validated.paymentDate || new Date(),
                transactionReference: validated.transactionReference,
                notes: validated.notes,
                recordedByUserId: req.user!.id,
              },
            });

            const updatedAmountPaid = addMoney(invoice.amountPaid, paymentAmount);
            const updatedOutstanding = Math.max(0, subtractMoney(invoice.outstandingBalance, paymentAmount));
            const updatedStatus = updatedOutstanding <= 0 ? 'PAID' : 'CONFIRMED';
            const updatedInvoice = await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                amountPaid: updatedAmountPaid,
                outstandingBalance: updatedOutstanding,
                status: updatedStatus,
              },
            });

            return { payment, invoice: updatedInvoice };
          },
          { isolationLevel: 'Serializable' }
        );
        break;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'P2002') {
          const duplicateReference = await prisma.payment.findUnique({
            where: { transactionReference: validated.transactionReference },
            select: { id: true },
          });
          if (duplicateReference) {
            throw new AppError(
              `A payment with transaction reference '${validated.transactionReference}' has already been recorded.`,
              409
            );
          }
          if (attempt < 2) continue;
        } else if (code === 'P2034' && attempt < 2) {
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      throw new AppError('Payment could not be recorded due to concurrent updates. Please retry.', 409);
    }

    res.status(201).json({
      success: true,
      message: `Payment of ₹${paymentAmount} successfully recorded. Invoice status is now ${result.invoice.status}.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
