import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { runBillingCycle } from '../services/billingService';

const router = Router();
router.use(authenticate);

/**
 * POST /api/billing/run-now
 * ADMIN-only action to execute billing immediately for testing & demonstration
 */
router.post('/run-now', requireRole('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runBillingCycle('MANUAL');
    res.json({
      success: true,
      message: `Billing cycle completed: ${result.invoicesGenerated} invoices generated, ${result.duplicatePrevented} duplicates prevented.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billing/jobs
 * View historical billing scheduler job logs
 */
router.get('/jobs', requireRole('ADMIN', 'STAFF'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await prisma.billingJob.findMany({
      take: 50,
      orderBy: { startedAt: 'desc' },
    });
    res.json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    next(error);
  }
});

export default router;
