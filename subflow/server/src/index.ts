import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cron from 'node-cron';

dotenv.config();

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';
import planRoutes from './routes/plan.routes';
import quotationRoutes from './routes/quotation.routes';
import subscriptionRoutes from './routes/subscription.routes';
import invoiceRoutes from './routes/invoice.routes';
import paymentRoutes from './routes/payment.routes';
import discountRoutes from './routes/discount.routes';
import taxRoutes from './routes/tax.routes';
import analyticsRoutes from './routes/analytics.routes';
import billingRoutes from './routes/billing.routes';
import { errorHandler } from './middleware/errorHandler';
import { csrfProtection, isTrustedOrigin } from './middleware/requestSecurity';
import { runBillingCycle } from './services/billingService';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || isTrustedOrigin(origin)),
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);

// Health Check Endpoint (Requirement 20)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'SubFlow Recurring Revenue Engine',
    version: '1.0.0',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/taxes', taxRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);

// Centralized Error Handling
app.use(errorHandler);

// Server-side Recurring Billing Scheduler (Requirement 9 & 23)
const schedulerCron = process.env.BILLING_SCHEDULER_CRON || '0 0 * * *';
const enableScheduler = process.env.ENABLE_BACKGROUND_SCHEDULER !== 'false';

if (enableScheduler) {
  cron.schedule(schedulerCron, async () => {
    console.log(`[CRON_TRIGGER] Scheduled recurring billing job triggered at ${new Date().toISOString()}`);
    try {
      await runBillingCycle('SCHEDULED');
    } catch (err) {
      console.error('[CRON_ERROR] Recurring billing scheduler encounter error:', err);
    }
  });
  console.log(`[SCHEDULER] Automated recurring billing cron registered: "${schedulerCron}"`);
}

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 SubFlow API Server running on port ${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/health`);
    console.log(`====================================================`);
  });
}

export default app;
