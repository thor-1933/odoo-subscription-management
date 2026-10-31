import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, enforceCustomerOwnership } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  billingAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/customers
 * Staff and Admin view customer list
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role === 'CUSTOMER') {
      throw new AppError('Forbidden: Customers cannot view general customer list.', 403);
    }

    const search = req.query.search as string | undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
        { city: { contains: search } },
      ];
    }

    const customers = await prisma.customerProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
            invoices: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: customers.length, data: customers });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/customers/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    enforceCustomerOwnership(req, req.params.id);

    const customer = await prisma.customerProfile.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer profile not found', 404);
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/customers/:id
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    enforceCustomerOwnership(req, req.params.id);

    const validated = updateProfileSchema.parse(req.body);

    const customer = await prisma.customerProfile.findUnique({
      where: { id: req.params.id },
    });
    if (!customer) {
      throw new AppError('Customer profile not found', 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (validated.name || validated.phone) {
        await tx.user.update({
          where: { id: customer.userId },
          data: {
            name: validated.name,
            phone: validated.phone,
          },
        });
      }

      return await tx.customerProfile.update({
        where: { id: req.params.id },
        data: {
          companyName: validated.companyName,
          billingAddress: validated.billingAddress,
          city: validated.city,
          state: validated.state,
          postalCode: validated.postalCode,
          country: validated.country,
          taxId: validated.taxId,
          phone: validated.phone,
          notes: req.user?.role !== 'CUSTOMER' ? validated.notes : undefined,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      });
    });

    res.json({ success: true, message: 'Profile updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
