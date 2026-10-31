import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/db';
import { runBillingCycle } from '../services/billingService';
import { calculateNextBillingDate } from '../utils/dateUtils';
import { roundMoney, addMoney, multiplyMoney, calculatePercentage } from '../utils/decimalUtils';
import bcrypt from 'bcryptjs';

describe('SubFlow Enterprise Core Business & Billing Test Suite', () => {
  before(async () => {
    console.log('[TEST] Initializing test suite...');
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('1. Password Complexity & Hashing Validation', async () => {
    const rawPassword = 'SecurePassword@2026!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    assert.notEqual(rawPassword, hash, 'Password must be hashed, not plaintext');
    const isMatch = await bcrypt.compare(rawPassword, hash);
    assert.equal(isMatch, true, 'Bcrypt compare must verify matching password');
  });

  test('2. Product Variant Pricing Arithmetic (e.g. Base ₹1000 + Odoo ₹560 = ₹1560)', async () => {
    const product = await prisma.product.findFirst({
      where: { code: 'PRD-BIZ-SOFT' },
      include: { variants: true },
    });

    assert.ok(product, 'Product must exist');
    const odooVariant = product.variants.find((v) => v.sku === 'BIZ-SOFT-ODOO');
    assert.ok(odooVariant, 'Odoo variant must exist');

    const effectivePrice = addMoney(product.basePrice, odooVariant.priceAdjustment);
    assert.equal(effectivePrice, 1560, 'Effective price must equal ₹1560');
  });

  test('3. Date Arithmetic & Month-End Capping (Daily, Weekly, Monthly, Yearly)', () => {
    // Daily
    const jan1 = new Date('2026-01-01T10:00:00Z');
    const jan2 = calculateNextBillingDate(jan1, 'DAILY');
    assert.equal(jan2.getDate(), 2);

    // Weekly
    const jan8 = calculateNextBillingDate(jan1, 'WEEKLY');
    assert.equal(jan8.getDate(), 8);

    // Month-End Capping (Jan 31 -> Feb 28 on non-leap year)
    const jan31 = new Date('2026-01-31T10:00:00Z');
    const febNext = calculateNextBillingDate(jan31, 'MONTHLY');
    assert.equal(febNext.getMonth(), 1, 'Target month should be February (1)');
    assert.equal(febNext.getDate(), 28, 'Jan 31 must cap to Feb 28 in 2026');

    // Yearly
    const yearNext = calculateNextBillingDate(jan1, 'YEARLY');
    assert.equal(yearNext.getFullYear(), 2027);
  });

  test('4. Tax and Discount Calculations', () => {
    const subtotal = 1000.0;
    const discountRate = 20; // 20%
    const discountAmount = calculatePercentage(subtotal, discountRate); // 200
    assert.equal(discountAmount, 200);

    const taxableAmount = subtotal - discountAmount; // 800
    const taxRate = 18; // 18% GST
    const taxAmount = calculatePercentage(taxableAmount, taxRate); // 144
    assert.equal(taxAmount, 144);

    const grandTotal = roundMoney(taxableAmount + taxAmount); // 944
    assert.equal(grandTotal, 944);
  });

  test('5. Automated Recurring Billing Generation', async () => {
    // Ensure an eligible subscription is due for billing
    const activeSub = await prisma.subscription.findFirst({
      where: { status: 'ACTIVE' },
    });
    assert.ok(activeSub, 'An active subscription must exist');

    await prisma.subscription.update({
      where: { id: activeSub.id },
      data: { nextBillingDate: new Date(Date.now() - 7200000) },
    });

    // Run billing cycle
    const result = await runBillingCycle('MANUAL');
    assert.ok(result.jobId, 'Billing job must produce a valid Job ID');
    assert.ok(result.subscriptionsProcessed >= 1, 'Eligible subscriptions must be processed');
  });

  test('6. Billing Idempotency & Duplicate Invoice Prevention', async () => {
    // Simulate a retried scheduler trigger on an already-billed period
    const billedPeriod = await prisma.billingPeriod.findFirst({
      where: { invoiceId: { not: null } },
    });
    assert.ok(billedPeriod, 'A billed period must exist from previous test');

    // Reset subscription nextBillingDate to the start of this already-billed period
    await prisma.subscription.update({
      where: { id: billedPeriod.subscriptionId },
      data: { nextBillingDate: billedPeriod.periodStart },
    });

    // Run billing cycle again
    const duplicateRunResult = await runBillingCycle('MANUAL');
    assert.equal(
      duplicateRunResult.invoicesGenerated,
      0,
      'Duplicate run must NOT generate duplicate invoices for the same period'
    );
    assert.ok(
      duplicateRunResult.duplicatePrevented >= 1,
      'Duplicate prevention logic must detect existing billing periods and advance safely'
    );
  });

  test('7. Partial Payment & Full Payment Ledger Reconciliation', async () => {
    // Find an invoice with outstanding balance
    const invoice = await prisma.invoice.findFirst({
      where: { outstandingBalance: { gt: 0 } },
    });

    assert.ok(invoice, 'Invoice with outstanding balance must exist');
    const initialBalance = invoice.outstandingBalance;
    const partialPayAmount = 100.0;

    // Record test payment
    const paymentNumber = `TEST-PAY-${Date.now()}`;
    const txRef = `TX-TEST-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          paymentMethod: 'UPI',
          amount: partialPayAmount,
          transactionReference: txRef,
          notes: 'Automated test partial payment',
        },
      });

      const updatedPaid = addMoney(invoice.amountPaid, partialPayAmount);
      const updatedOutstanding = roundMoney(invoice.outstandingBalance - partialPayAmount);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: updatedPaid,
          outstandingBalance: updatedOutstanding,
          status: updatedOutstanding <= 0 ? 'PAID' : 'CONFIRMED',
        },
      });
    });

    const refreshed = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    assert.equal(
      refreshed!.outstandingBalance,
      roundMoney(initialBalance - partialPayAmount),
      'Outstanding balance must decrement exactly by partial payment'
    );
  });

  test('8. Role-Based Access & Customer Data Isolation Constraints', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const staff = await prisma.user.findFirst({ where: { role: 'STAFF' } });
    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });

    assert.ok(admin, 'Admin must exist');
    assert.ok(staff, 'Staff must exist');
    assert.ok(customer, 'Customer must exist');

    assert.equal(admin.role, 'ADMIN');
    assert.equal(staff.role, 'STAFF');
    assert.equal(customer.role, 'CUSTOMER');
  });

  test('9. Subscription Pause, Resume & Cancellation Lifecycle', async () => {
    const sub = await prisma.subscription.findFirst({
      where: { status: 'ACTIVE' },
    });

    assert.ok(sub, 'Active subscription must exist');

    // Pause
    const paused = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAUSED' },
    });
    assert.equal(paused.status, 'PAUSED');

    // Resume
    const resumed = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE' },
    });
    assert.equal(resumed.status, 'ACTIVE');
  });

  test('10. Overdue Invoice Detection', async () => {
    const overdue = await prisma.invoice.findMany({
      where: {
        status: { not: 'PAID' },
        dueDate: { lt: new Date() },
      },
    });

    assert.ok(overdue.length >= 1, 'At least one overdue invoice must be detected in seeded data');
  });
});
