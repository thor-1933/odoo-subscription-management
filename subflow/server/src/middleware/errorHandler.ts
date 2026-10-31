import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode = 400, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Check if it's a Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      validationErrors: formattedErrors,
    });
    return;
  }

  // Check if it's our known custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
    });
    return;
  }

  // Check for Prisma unique constraint errors (P2002)
  if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target)
      ? err.meta.target.join(', ')
      : err.meta?.target || 'field';
    res.status(409).json({
      success: false,
      error: `A record with this ${target} already exists.`,
    });
    return;
  }

  // Unhandled internal server errors
  console.error('[UNHANDLED_SERVER_ERROR]', err);
  res.status(500).json({
    success: false,
    error: 'An internal server error occurred. Please try again later.',
  });
}
