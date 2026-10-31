import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { sendPasswordResetEmail } from '../utils/mailer';
import { createRateLimiter } from '../middleware/requestSecurity';

const router = Router();

// Validation schema matching section 4 password rules:
// - Password longer than 8 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one special character
const passwordSchema = z
  .string()
  .min(9, 'Password must be longer than 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: passwordSchema,
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  billingAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  email: z.string().email('Invalid email address').toLowerCase(),
  newPassword: passwordSchema,
});

const registrationLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const passwordResetLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

/**
 * POST /api/auth/register
 */
router.post('/register', registrationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      throw new AppError('An account with this email address already exists.', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validated.password, salt);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: validated.email,
          passwordHash,
          name: validated.name,
          role: 'CUSTOMER',
          phone: validated.phone,
        },
      });

      await tx.customerProfile.create({
        data: {
          userId: newUser.id,
          companyName: validated.companyName || validated.name,
          billingAddress: validated.billingAddress,
          city: validated.city,
          state: validated.state,
          postalCode: validated.postalCode,
          country: validated.country || 'India',
          taxId: validated.taxId,
          phone: validated.phone,
        },
      });

      return newUser;
    });

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      userVersion: user.updatedAt.getTime(),
    });

    setAuthCookie(res, token);

    const fullProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: { customerProfile: true },
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: fullProfile!.id,
        email: fullProfile!.email,
        name: fullProfile!.name,
        role: fullProfile!.role,
        customerProfile: fullProfile!.customerProfile,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      include: { customerProfile: true },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(validated.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      userVersion: user.updatedAt.getTime(),
    });

    setAuthCookie(res, token);

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        customerProfile: user.customerProfile,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { customerProfile: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        customerProfile: user.customerProfile,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/forgot-password
 * Generic message to prevent user enumeration
 */
router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });

      await sendPasswordResetEmail(user.email, resetToken, user.name);
    }

    // Always return generic response to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, reset instructions will be sent if email delivery is configured.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/reset-password
 */
router.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, token, newPassword } = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      !user.resetToken ||
      user.resetToken !== token ||
      !user.resetTokenExpiry ||
      user.resetTokenExpiry < new Date()
    ) {
      throw new AppError('Password reset link is invalid or has expired.', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({
      success: true,
      message: 'Your password has been successfully reset. You may now log in.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
