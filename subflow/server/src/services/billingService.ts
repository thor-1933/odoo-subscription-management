import { prisma } from '../config/db';
import { calculateNextBillingDate } from '../utils/dateUtils';
import { roundMoney, addMoney, multiplyMoney, calculatePercentage } from '../utils/decimalUtils';

export interface BillingRunResult {
  jobId: string;
  runType: 'SCHEDULED' | 'MANUAL';
  subscriptionsProcessed: number;
  invoicesGenerated: number;
  skippedPausedOrClosed: number;
  duplicatePrevented: number;
  errors: string[];
  durationMs: number;
}

/**
 * Core Automated Recurring Billing Engine.
 * Fully idempotent, transaction-safe, and resilient against duplicate generation.
 */
export async function runBillingCycle(
  runType: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED'
): Promise<BillingRunResult> {
  const startTime = Date.now();
  console.log(`[BILLING_SCHEDULER] >>> Starting billing cycle (${runType}) at ${new Date().toISOString()}...`);

  // 1. Create durable BillingJob record
  const job = await prisma.billingJob.create({
    data: {
      runType,
      status: 'RUNNING',
      subscriptionsProcessed: 0,
      invoicesGenerated: 0,
      startedAt: new Date(),
    },
  });

  const now = new Date();
  const errors: string[] = [];
  let subscriptionsProcessed = 0;
  let invoicesGenerated = 0;
  let skippedPausedOrClosed = 0;
  let duplicatePrevented = 0;

  try {
    // 2. Query subscriptions where nextBillingDate <= now and status is eligible
    // We fetch ACTIVE, but also check for auto-close expiration
    const eligibleSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'CONFIRMED'] },
        nextBillingDate: { lte: now },
      },
      include: {
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      orderBy: { nextBillingDate: 'asc' },
    });

    console.log(`[BILLING_SCHEDULER] Found ${eligibleSubscriptions.length} subscriptions eligible for billing check.`);

    for (const sub of eligibleSubscriptions) {
      subscriptionsProcessed++;

      // Check if subscription has expired
      if (sub.expiryDate && new Date(sub.expiryDate) < now) {
        if (sub.autoClose) {
          console.log(`[BILLING_SCHEDULER] Subscription ${sub.subscriptionNumber} expired. Auto-closing...`);
          await prisma.$transaction(async (tx) => {
            const updated = await tx.subscription.updateMany({
              where: {
                id: sub.id,
                status: sub.status,
                nextBillingDate: sub.nextBillingDate,
                expiryDate: { lte: now },
                autoClose: true,
              },
              data: { status: 'CLOSED' },
            });
            if (updated.count) {
              await tx.subscriptionStatusHistory.create({
                data: {
                  subscriptionId: sub.id,
                  previousStatus: sub.status,
                  newStatus: 'CLOSED',
                  reason: 'Auto-closed upon reaching expiration date',
                },
              });
            }
          });
        }
        skippedPausedOrClosed++;
        continue;
      }

      // Check if paused
      if (sub.status === 'PAUSED' || sub.status === 'CLOSED') {
        skippedPausedOrClosed++;
        continue;
      }

      // Period start is current nextBillingDate, Period end is calculated from plan billing frequency
      const periodStart = new Date(sub.nextBillingDate);
      const periodEnd = calculateNextBillingDate(periodStart, sub.plan.billingFrequency);

      let outcome: 'GENERATED' | 'DUPLICATE' | 'STALE' = 'STALE';
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            outcome = await prisma.$transaction(async (tx) => {
          const current = await tx.subscription.findUnique({
            where: { id: sub.id },
            select: { status: true, nextBillingDate: true, expiryDate: true, autoClose: true },
          });
          const existingPeriod = await tx.billingPeriod.findUnique({
            where: {
              subscriptionId_periodStart_periodEnd: {
                subscriptionId: sub.id,
                periodStart,
                periodEnd,
              },
            },
            select: { invoiceId: true },
          });

          if (existingPeriod?.invoiceId) {
            if (
              current &&
              ['ACTIVE', 'CONFIRMED'].includes(current.status) &&
              current.nextBillingDate.getTime() === periodStart.getTime()
            ) {
              await tx.subscription.updateMany({
                where: {
                  id: sub.id,
                  status: current.status,
                  nextBillingDate: periodStart,
                },
                data: { status: 'ACTIVE', nextBillingDate: periodEnd },
              });
            }
            return 'DUPLICATE';
          }
          if (existingPeriod) {
            throw new Error(`Billing period for ${sub.subscriptionNumber} exists without an invoice.`);
          }
          if (
            !current ||
            !['ACTIVE', 'CONFIRMED'].includes(current.status) ||
            current.nextBillingDate.getTime() !== periodStart.getTime() ||
            (current.expiryDate && current.expiryDate < now && current.autoClose)
          ) {
            return 'STALE';
          }

          // Prepare invoice lines from subscription line items
          let invoiceSubtotal = 0;
          let invoiceTaxAmount = 0;
          let invoiceDiscountAmount = 0;

          const invoiceLinesData = sub.lines.map((line) => {
            let unitPrice = line.unitPrice;
            if (line.variant) {
              unitPrice = addMoney(line.product.basePrice, line.variant.priceAdjustment);
            }

            const gross = multiplyMoney(unitPrice, line.quantity);
            const disc = roundMoney(line.discountAmount || 0);
            const taxable = Math.max(0, gross - disc);
            const tax = calculatePercentage(taxable, line.taxRate || 0);
            const lineTotal = roundMoney(taxable + tax);

            invoiceSubtotal = addMoney(invoiceSubtotal, gross);
            invoiceTaxAmount = addMoney(invoiceTaxAmount, tax);
            invoiceDiscountAmount = addMoney(invoiceDiscountAmount, disc);

            const desc = line.variant
              ? `${line.product.name} (${line.variant.name})`
              : line.product.name;

            return {
              productId: line.productId,
              variantId: line.variantId,
              description: `${desc} [${sub.plan.billingFrequency} Subscription: ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}]`,
              quantity: line.quantity,
              unitPrice,
              taxRate: line.taxRate || 0,
              taxAmount: tax,
              discountAmount: disc,
              lineTotal,
            };
          });

          // Also incorporate plan base recurring fee if product lines are separate
          if (invoiceLinesData.length === 0 && sub.plan.price > 0) {
            invoiceSubtotal = sub.plan.price;
            invoiceTaxAmount = calculatePercentage(invoiceSubtotal, 18); // Default standard GST
            const lineTotal = addMoney(invoiceSubtotal, invoiceTaxAmount);

            invoiceLinesData.push({
              productId: undefined as any,
              variantId: undefined as any,
              description: `${sub.plan.name} (${sub.plan.billingFrequency} Billing Period)`,
              quantity: 1,
              unitPrice: sub.plan.price,
              taxRate: 18,
              taxAmount: invoiceTaxAmount,
              discountAmount: 0,
              lineTotal,
            });
          }

          const grandTotal = Math.max(
            0,
            roundMoney(invoiceSubtotal - invoiceDiscountAmount + invoiceTaxAmount)
          );

          // Generate sequential Invoice number: INV-YYYYMM-XXXX
          const yearMonth = `${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
          const totalInvoices = await tx.invoice.count();
          const invoiceNumber = `INV-${yearMonth}-${String(totalInvoices + 1).padStart(4, '0')}`;

          // Set payment due date based on payment terms (e.g. "Net 15" -> +15 days)
          let dueDays = 15;
          const matchTerms = sub.paymentTerms.match(/\d+/);
          if (matchTerms) dueDays = parseInt(matchTerms[0], 10);
          const dueDate = new Date(periodStart);
          dueDate.setDate(dueDate.getDate() + dueDays);

          // 1. Create Invoice
          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              subscriptionId: sub.id,
              customerId: sub.customerId,
              invoiceDate: periodStart,
              dueDate,
              status: 'CONFIRMED',
              subtotal: invoiceSubtotal,
              taxAmount: invoiceTaxAmount,
              discountAmount: invoiceDiscountAmount,
              grandTotal,
              amountPaid: 0,
              outstandingBalance: grandTotal,
              notes: `Automated recurring invoice for subscription ${sub.subscriptionNumber}. Plan: ${sub.plan.name} (${sub.plan.billingFrequency}).`,
              lines: {
                create: invoiceLinesData,
              },
            },
          });

          // 2. Create BillingPeriod tracking row
          await tx.billingPeriod.create({
            data: {
              subscriptionId: sub.id,
              periodStart,
              periodEnd,
              status: 'INVOICED',
              invoiceId: invoice.id,
            },
          });

          // 3. Advance Subscription's nextBillingDate to periodEnd
          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              status: 'ACTIVE',
              nextBillingDate: periodEnd,
            },
          });

          return 'GENERATED';
            }, { isolationLevel: 'Serializable' });
            break;
          } catch (txErr) {
            const code = (txErr as { code?: string }).code;
            if ((code === 'P2034' || code === 'P2002') && attempt < 2) {
              if (code === 'P2002') {
                const committedPeriod = await prisma.billingPeriod.findUnique({
                  where: {
                    subscriptionId_periodStart_periodEnd: {
                      subscriptionId: sub.id,
                      periodStart,
                      periodEnd,
                    },
                  },
                  select: { invoiceId: true },
                });
                if (committedPeriod?.invoiceId) {
                  outcome = 'DUPLICATE';
                  break;
                }
              }
              continue;
            }
            throw txErr;
          }
        }

        if (outcome === 'GENERATED') {
          invoicesGenerated++;
          console.log(`[BILLING_SCHEDULER] Successfully generated invoice for subscription ${sub.subscriptionNumber}`);
        } else if (outcome === 'DUPLICATE') {
          duplicatePrevented++;
        } else {
          skippedPausedOrClosed++;
        }
      } catch (txErr: any) {
        const period = await prisma.billingPeriod.findUnique({
          where: {
            subscriptionId_periodStart_periodEnd: {
              subscriptionId: sub.id,
              periodStart,
              periodEnd,
            },
          },
          select: { invoiceId: true },
        });
        if (period?.invoiceId) {
          duplicatePrevented++;
          continue;
        }
        console.error(`[BILLING_SCHEDULER_ERR] Failed processing subscription ${sub.subscriptionNumber}:`, txErr);
        errors.push(`Sub ${sub.subscriptionNumber}: ${txErr.message || 'Transaction error'}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // 3. Update BillingJob record to SUCCESS
    await prisma.billingJob.update({
      where: { id: job.id },
      data: {
        status: errors.length > 0 && invoicesGenerated === 0 ? 'FAILED' : 'SUCCESS',
        subscriptionsProcessed,
        invoicesGenerated,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date(),
      },
    });

    console.log(
      `[BILLING_SCHEDULER] <<< Billing cycle completed in ${durationMs}ms. Invoices generated: ${invoicesGenerated}, Processed: ${subscriptionsProcessed}, Duplicates avoided: ${duplicatePrevented}.`
    );

    return {
      jobId: job.id,
      runType,
      subscriptionsProcessed,
      invoicesGenerated,
      skippedPausedOrClosed,
      duplicatePrevented,
      errors,
      durationMs,
    };
  } catch (globalErr: any) {
    console.error('[BILLING_SCHEDULER_FATAL]', globalErr);
    await prisma.billingJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errors: globalErr.message,
        completedAt: new Date(),
      },
    });
    throw globalErr;
  }
}
