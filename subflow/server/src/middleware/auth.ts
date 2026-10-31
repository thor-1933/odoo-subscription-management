import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { AppError } from './errorHandler';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  name: string;
  customerProfileId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const configuredSecret = process.env.JWT_SECRET;
if (
  configuredSecret &&
  (configuredSecret.length < 32 ||
    configuredSecret.startsWith('REPLACE_') ||
    configuredSecret.startsWith('subflow_super_secure_jwt_'))
) {
  throw new Error('JWT_SECRET must be a non-placeholder value of at least 32 characters.');
}
if (process.env.NODE_ENV === 'production' && !configuredSecret) {
  throw new Error('JWT_SECRET is required in production. Configure a random secret of at least 32 characters.');
}
const JWT_SECRET = configuredSecret || crypto.randomBytes(48).toString('hex');

export function signToken(payload: {
  id: string;
  email: string;
  role: string;
  name: string;
  userVersion: number;
}): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
}

export function setAuthCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('subflow_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('subflow_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined = req.cookies?.subflow_token;

    // Fallback to Authorization Header (Bearer token)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Authentication required. Please sign in.', 401);
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      throw new AppError('Session expired or invalid. Please sign in again.', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { customerProfile: true },
    });

    if (!user) {
      throw new AppError('User account not found.', 401);
    }
    if (decoded.userVersion !== user.updatedAt.getTime()) {
      throw new AppError('Session invalidated. Please sign in again.', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as 'ADMIN' | 'STAFF' | 'CUSTOMER',
      name: user.name,
      customerProfileId: user.customerProfile?.id,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles: Array<'ADMIN' | 'STAFF' | 'CUSTOMER'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Unauthorized. Authentication required.', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          `Forbidden: Insufficient privileges. Required role: ${allowedRoles.join(' or ')}.`,
          403
        )
      );
      return;
    }

    next();
  };
}

/**
 * Ensures customer can only access records belonging to their own customerProfileId.
 * Admin and Staff bypass this check.
 */
export function enforceCustomerOwnership(
  req: Request,
  targetCustomerId: string | undefined | null
): void {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  if (req.user.role === 'ADMIN' || req.user.role === 'STAFF') {
    return; // Staff & Admins can access any customer profile
  }

  if (req.user.role === 'CUSTOMER') {
    if (!targetCustomerId || req.user.customerProfileId !== targetCustomerId) {
      throw new AppError('Access denied: You cannot view or modify another customer\'s records.', 403);
    }
  }
}
