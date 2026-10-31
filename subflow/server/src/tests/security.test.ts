import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import { registerSchema } from '../routes/auth.routes';
import { requireRole } from '../middleware/auth';
import { createRateLimiter, csrfProtection, isTrustedOrigin } from '../middleware/requestSecurity';

function invokeMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  values: Partial<Request>
) {
  let nextError: unknown;
  let statusCode = 200;
  let body: unknown;
  const req = {
    method: 'POST',
    path: '/test',
    baseUrl: '/api/test',
    ip: '192.0.2.10',
    get: (name: string) => values.headers?.[name.toLowerCase()] as string | undefined,
    ...values,
  } as Request;
  const res = {
    setHeader: () => undefined,
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;

  middleware(req, res, (error?: unknown) => {
    nextError = error;
  });
  return { nextError, statusCode, body };
}

test('public registration ignores client-supplied privileged roles', () => {
  const parsed = registerSchema.parse({
    email: 'new-customer@example.test',
    password: 'StrongPass!1',
    name: 'New Customer',
    role: 'ADMIN',
  });

  assert.equal('role' in parsed, false);
});

test('origin allowlist requires exact configured development origins', () => {
  assert.equal(isTrustedOrigin('http://localhost:5173'), true);
  assert.equal(isTrustedOrigin('https://localhost.attacker.test'), false);
  assert.equal(isTrustedOrigin('https://attacker.test'), false);
});

test('CSRF protection rejects untrusted and originless cookie-authenticated mutations', () => {
  const untrusted = invokeMiddleware(csrfProtection, {
    headers: { origin: 'https://attacker.test' } as Request['headers'],
  });
  assert.equal((untrusted.nextError as { statusCode?: number }).statusCode, 403);

  const originlessCookieRequest = invokeMiddleware(csrfProtection, {
    cookies: { subflow_token: 'session' },
  });
  assert.equal((originlessCookieRequest.nextError as { statusCode?: number }).statusCode, 403);
});

test('CSRF protection allows trusted origins and bearer-token API requests', () => {
  const trusted = invokeMiddleware(csrfProtection, {
    headers: { origin: 'http://localhost:5173' } as Request['headers'],
  });
  assert.equal(trusted.nextError, undefined);

  const bearer = invokeMiddleware(csrfProtection, {
    headers: { authorization: 'Bearer test-token' } as Request['headers'],
    cookies: { subflow_token: 'session' },
  });
  assert.equal(bearer.nextError, undefined);
});

test('authentication rate limiter blocks excess attempts in its window', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
  const request = { path: '/login', baseUrl: '/api/auth', ip: '192.0.2.11' } as Request;
  const response = {
    setHeader: () => undefined,
    status(code: number) {
      statusCode = code;
      return this;
    },
    json: () => undefined,
  } as unknown as Response;
  let statusCode = 200;

  let firstPassed = false;
  limiter(request, response, () => {
    firstPassed = true;
  });
  assert.equal(firstPassed, true);

  let secondPassed = false;
  limiter(request, response, () => {
    secondPassed = true;
  });
  assert.equal(secondPassed, false);
  assert.equal(statusCode, 429);
});

test('role guard rejects a customer for privileged endpoints', () => {
  let nextError: unknown;
  requireRole('ADMIN')(
    { user: { id: 'customer', email: 'customer@example.test', name: 'Customer', role: 'CUSTOMER' } } as Request,
    {} as Response,
    (error?: unknown) => {
      nextError = error;
    }
  );
  assert.equal((nextError as { statusCode?: number }).statusCode, 403);
});
