import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const taxSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).toUpperCase(),
  rate: z.number().min(0).max(100),
  effectiveFrom: z.string().or(z.date()).transform((d) => new Date(d)),
  effectiveTo: z.string().or(z.date()).optional().nullable().transform((d) => (d ? new Date(d) : null)),
  applicableProducts: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/taxes
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const taxes = await prisma.taxRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, count: taxes.length, data: taxes });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/taxes
 * Only ADMIN can configure taxes
 */
router.post('/', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = taxSchema.parse(req.body);

    const existing = await prisma.taxRule.findUnique({
      where: { code: validated.code },
    });
    if (existing) {
      throw new AppError(`A tax rule with code '${validated.code}' already exists.`, 409);
    }

    const tax = await prisma.taxRule.create({
      data: validated,
    });

    res.status(201).json({ success: true, message: 'Tax rule created', data: tax });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/taxes/:id
 */
router.put('/:id', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = taxSchema.partial().parse(req.body);

    const tax = await prisma.taxRule.update({
      where: { id: req.params.id },
      data: validated,
    });

    res.json({ success: true, message: 'Tax rule updated', data: tax });
  } catch (error) {
    next(error);
  }
});

export default router;
