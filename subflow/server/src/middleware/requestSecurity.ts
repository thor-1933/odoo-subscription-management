import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

const developmentOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function parseOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

const trustedOrigins = new Set<string>([
  ...(process.env.NODE_ENV === 'production' ? [] : developmentOrigins),
  ...[process.env.CLIENT_URL, ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')]
    .filter((origin): origin is string => Boolean(origin?.trim()))
    .map((origin) => parseOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin)),
]);

export function isTrustedOrigin(origin: string): boolean {
  const normalizedOrigin = parseOrigin(origin);
  return normalizedOrigin !== undefined && trustedOrigins.has(normalizedOrigin);
}

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (safeMethods.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const origin = req.get('origin');
  if (origin && !isTrustedOrigin(origin)) {
    next(new AppError('Request origin is not allowed.', 403));
    return;
  }

  if (req.get('sec-fetch-site') === 'cross-site') {
    next(new AppError('Cross-site state-changing requests are not allowed.', 403));
    return;
  }

  if (
    !origin &&
    req.cookies?.subflow_token &&
    !req.get('authorization')?.startsWith('Bearer ')
  ) {
    next(new AppError('An Origin header is required for cookie-authenticated requests.', 403));
    return;
  }

  next();
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter({ windowMs, max }: RateLimitOptions) {
  const clients = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    let entry = clients.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      clients.set(key, entry);
    }

    if (clients.size > 1000) {
      for (const [clientKey, clientEntry] of clients) {
        if (clientEntry.resetAt <= now) clients.delete(clientKey);
      }
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({
        success: false,
        error: 'Too many authentication attempts. Please try again later.',
      });
      return;
    }

    next();
  };
}
