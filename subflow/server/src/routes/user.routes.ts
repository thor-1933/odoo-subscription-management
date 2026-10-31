import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// Only ADMIN can create staff accounts (Section 3 requirement)
const createUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(2),
  role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']),
  password: z
    .string()
    .min(9, 'Password must be longer than 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[^A-Za-z0-9]/, 'Must contain special char'),
  phone: z.string().optional(),
});

/**
 * GET /api/users
 * ADMIN and STAFF can view users list
 */
router.get('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (role) {
      where.role = role.toUpperCase();
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
        customerProfile: {
          select: {
            id: true,
            companyName: true,
            city: true,
            country: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users
 * ONLY ADMIN can create STAFF or ADMIN accounts
 */
router.post('/', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existing) {
      throw new AppError('A user with this email already exists.', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validated.password, salt);

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        passwordHash,
        name: validated.name,
        role: validated.role,
        phone: validated.phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: `${user.role} user created successfully`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
