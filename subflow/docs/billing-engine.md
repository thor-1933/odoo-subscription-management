# SubFlow Automated Recurring Billing Engine Specification

## Overview

The SubFlow Recurring Billing Engine is an idempotent, transaction-safe background engine designed to eliminate double-billing, prevent skipped billing periods, and ensure decimal monetary precision for recurring subscription contracts.

---

## Idempotency & Duplicate Invoice Prevention Architecture

The engine uses three layers of duplicate prevention:

1. **State Isolation**: Subscriptions must have status `ACTIVE` and `nextBillingDate <= NOW()`.
2. **Durable BillingPeriod Tracking**:
   Each evaluated subscription period is tracked in the `BillingPeriod` model:
   ```prisma
   model BillingPeriod {
     id             String       @id @default(uuid())
     subscriptionId String
     periodStart    DateTime
     periodEnd      DateTime
     status         String       @default("INVOICED")
     invoiceId      String?      @unique

     @@unique([subscriptionId, periodStart, periodEnd])
   }
   ```
   Before generating an invoice, the scheduler checks if a period with `[subscriptionId, periodStart]` already has an `invoiceId`. If found, invoice generation is bypassed and `duplicatePrevented` counter is incremented.
3. **Atomic Database Transactions**:
   Generating the invoice, invoice line items, creating the billing period row, and advancing `nextBillingDate` occur inside a single atomic `prisma.$transaction`. If any step fails, the entire transaction rolls back cleanly.

---

## Frequency Arithmetic Matrix

| Frequency | Period Calculation | Next Billing Date Advance |
| :--- | :--- | :--- |
| **DAILY** | `next.setDate(next.getDate() + 1)` | +1 Day |
| **WEEKLY** | `next.setDate(next.getDate() + 7)` | +7 Days |
| **MONTHLY** | Month increment with end-of-month capping (`Math.min(currentDay, maxDaysInTargetMonth)`) | +1 Month |
| **YEARLY** | Year increment with leap-year protection (Feb 29 -> Feb 28 on non-leap years) | +1 Year |

---

## Normalized MRR / ARR Formulas

To avoid distorting recurring revenue with one-time setup fees or multi-cadence variations, MRR is normalized:

$$\text{MRR}_{\text{Daily}} = \text{Recurring Charge} \times 30$$
$$\text{MRR}_{\text{Weekly}} = \text{Recurring Charge} \times 4.3333$$
$$\text{MRR}_{\text{Monthly}} = \text{Recurring Charge} \times 1.0$$
$$\text{MRR}_{\text{Yearly}} = \frac{\text{Recurring Charge}}{12}$$

$$\text{ARR} = \text{MRR} \times 12$$
