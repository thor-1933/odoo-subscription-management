import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the destructive seed script in production.');
  }
  if (process.env.SEED_ALLOW_RESET !== 'true') {
    throw new Error('This seed script deletes existing data. Set SEED_ALLOW_RESET=true only for a disposable database.');
  }
  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.startsWith('file:') &&
    process.env.SEED_ALLOW_REMOTE_DATABASE !== 'true'
  ) {
    throw new Error('Remote databases require SEED_ALLOW_REMOTE_DATABASE=true in addition to SEED_ALLOW_RESET=true.');
  }

  console.log('>>> [SEED] Initiating SubFlow database seed...');

  // Clean existing records in correct referential order
  await prisma.discountRedemption.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.billingPeriod.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscriptionStatusHistory.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.quotationLine.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.quotationTemplate.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.discountRule.deleteMany();
  await prisma.taxRule.deleteMany();
  await prisma.billingJob.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log('>>> [SEED] Database cleared. Seeding accounts...');

  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('SubFlow@2026!', salt);

  // 1. Users & Roles
  // ADMIN
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@brightloop.io',
      name: 'Sarah Jenkins (Admin)',
      role: 'ADMIN',
      passwordHash: commonPasswordHash,
      phone: '+91 98765 43210',
    },
  });

  // STAFF
  const staffUser = await prisma.user.create({
    data: {
      email: 'staff@brightloop.io',
      name: 'Alex Rivera (Staff)',
      role: 'STAFF',
      passwordHash: commonPasswordHash,
      phone: '+91 98765 43211',
    },
  });

  // CUSTOMER 1 (Enterprise)
  const custUser1 = await prisma.user.create({
    data: {
      email: 'customer@acme.com',
      name: 'Elena Rostova',
      role: 'CUSTOMER',
      passwordHash: commonPasswordHash,
      phone: '+91 98765 11111',
      customerProfile: {
        create: {
          companyName: 'Acme Technologies Ltd',
          billingAddress: '42 Silicon Avenue, Cyber City',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560100',
          country: 'India',
          taxId: '29ABCDE1234F1Z5',
          phone: '+91 80 4455 6677',
          notes: 'High-value Enterprise account, annual renewal cycle',
        },
      },
    },
    include: { customerProfile: true },
  });

  // CUSTOMER 2 (Growth Startup)
  const custUser2 = await prisma.user.create({
    data: {
      email: 'founder@novastack.io',
      name: 'Vikram Mehta',
      role: 'CUSTOMER',
      passwordHash: commonPasswordHash,
      phone: '+91 98765 22222',
      customerProfile: {
        create: {
          companyName: 'NovaStack Labs',
          billingAddress: 'Tower B, Tech Park, Gachibowli',
          city: 'Hyderabad',
          state: 'Telangana',
          postalCode: '500032',
          country: 'India',
          taxId: '36XYZPA9876Q1Z2',
          phone: '+91 40 3344 5566',
          notes: 'Fast-growing SaaS startup on monthly billing',
        },
      },
    },
    include: { customerProfile: true },
  });

  // CUSTOMER 3 (Small Business)
  const custUser3 = await prisma.user.create({
    data: {
      email: 'billing@solardrive.in',
      name: 'Pooja Nair',
      role: 'CUSTOMER',
      passwordHash: commonPasswordHash,
      phone: '+91 98765 33333',
      customerProfile: {
        create: {
          companyName: 'SolarDrive Energy',
          billingAddress: '15 Marine Lines',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400020',
          country: 'India',
          taxId: '27MNBVC5678R1Z9',
          phone: '+91 22 2200 1199',
          notes: 'Clean energy SME',
        },
      },
    },
    include: { customerProfile: true },
  });

  console.log('>>> [SEED] Accounts created: Admin, Staff, Customers.');

  // 2. Tax Rules
  const gst18 = await prisma.taxRule.create({
    data: {
      name: 'GST 18% (Standard SaaS Rate)',
      code: 'GST-18',
      rate: 18.0,
      isActive: true,
      effectiveFrom: new Date('2024-01-01'),
    },
  });

  const vat5 = await prisma.taxRule.create({
    data: {
      name: 'Reduced Tech Tax 5%',
      code: 'TECH-5',
      rate: 5.0,
      isActive: true,
      effectiveFrom: new Date('2024-01-01'),
    },
  });

  // 3. Discount Rules
  const discountEarlyBird = await prisma.discountRule.create({
    data: {
      code: 'EARLYBIRD20',
      description: '20% Off for Early Adopters on all orders above ₹2000',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderValue: 2000,
      minQuantity: 1,
      startDate: new Date('2024-01-01'),
      expiryDate: new Date('2027-12-31'),
      usageLimit: 500,
      timesUsed: 14,
      isSubscriptionWide: true,
      isActive: true,
    },
  });

  const discountFixed500 = await prisma.discountRule.create({
    data: {
      code: 'SAVE500',
      description: 'Flat ₹500 off on subscriptions',
      discountType: 'FIXED',
      discountValue: 500,
      minOrderValue: 1500,
      startDate: new Date('2024-01-01'),
      expiryDate: new Date('2027-12-31'),
      usageLimit: 100,
      timesUsed: 5,
      isSubscriptionWide: true,
      isActive: true,
    },
  });

  // Expired discount for testing validation
  await prisma.discountRule.create({
    data: {
      code: 'EXPIRED2024',
      description: 'Legacy expired promotional coupon',
      discountType: 'PERCENTAGE',
      discountValue: 30,
      startDate: new Date('2023-01-01'),
      expiryDate: new Date('2023-12-31'),
      usageLimit: 50,
      timesUsed: 50,
      isActive: false,
    },
  });

  // 4. Products & Variants (Requirement 5: At least 8 realistic products + variants)
  const prodSoftware = await prisma.product.create({
    data: {
      code: 'PRD-BIZ-SOFT',
      name: 'Brightloop Business Software',
      type: 'SOFTWARE',
      basePrice: 1000.0,
      costPrice: 250.0,
      description: 'Complete cloud ERP and business management system.',
      isActive: true,
      variants: {
        create: [
          { name: 'Standard Edition', sku: 'BIZ-SOFT-STD', priceAdjustment: 0 },
          { name: 'Odoo Powered Edition', sku: 'BIZ-SOFT-ODOO', priceAdjustment: 560 }, // Matches prompt example (Base ₹1000 + ₹560 = ₹1560)
          { name: 'Enterprise Cluster', sku: 'BIZ-SOFT-ENT', priceAdjustment: 1500 },
        ],
      },
    },
    include: { variants: true },
  });

  const prodCrm = await prisma.product.create({
    data: {
      code: 'PRD-CRM-PRO',
      name: 'OmniChannel CRM Suite',
      type: 'SOFTWARE',
      basePrice: 1800.0,
      costPrice: 400.0,
      description: 'Lead tracking, deal pipelines, customer interactions and telephony integration.',
      isActive: true,
      variants: {
        create: [
          { name: 'Up to 5 Users', sku: 'CRM-5U', priceAdjustment: 0 },
          { name: 'Up to 25 Users', sku: 'CRM-25U', priceAdjustment: 2200 },
          { name: 'Unlimited Dedicated', sku: 'CRM-UNL', priceAdjustment: 5500 },
        ],
      },
    },
    include: { variants: true },
  });

  const prodBillingEngine = await prisma.product.create({
    data: {
      code: 'PRD-SUBFLOW-API',
      name: 'SubFlow Recurring Billing API Engine',
      type: 'DIGITAL',
      basePrice: 2500.0,
      costPrice: 300.0,
      description: 'Automated invoice scheduler and subscription lifecycle API SDK.',
      isActive: true,
      variants: {
        create: [
          { name: 'Standard Multi-tenant', sku: 'SUB-STD', priceAdjustment: 0 },
          { name: 'High-Throughput Dedicated', sku: 'SUB-HI-PERF', priceAdjustment: 3000 },
        ],
      },
    },
    include: { variants: true },
  });

  const prodSupport = await prisma.product.create({
    data: {
      code: 'PRD-PREM-SUPP',
      name: '24/7 Priority Support & SLA',
      type: 'SERVICE',
      basePrice: 1200.0,
      costPrice: 600.0,
      description: '15-minute response SLA with dedicated technical account manager.',
      isActive: true,
      variants: {
        create: [
          { name: 'Silver Tier (9x5)', sku: 'SUPP-SILVER', priceAdjustment: 0 },
          { name: 'Gold Tier (24x7)', sku: 'SUPP-GOLD', priceAdjustment: 800 },
        ],
      },
    },
    include: { variants: true },
  });

  const prodAnalytics = await prisma.product.create({
    data: {
      code: 'PRD-ANALYTICS-AI',
      name: 'Brightloop Predictive Analytics & AI Insights',
      type: 'SOFTWARE',
      basePrice: 3200.0,
      costPrice: 800.0,
      description: 'Churn prediction, cash-flow forecasting, cohort analysis.',
      isActive: true,
    },
  });

  const prodStorage = await prisma.product.create({
    data: {
      code: 'PRD-CLOUD-STOR',
      name: 'Encrypted Cloud Storage Tier',
      type: 'DIGITAL',
      basePrice: 400.0,
      costPrice: 90.0,
      description: 'Automated zero-knowledge encrypted backups and document vaults.',
      isActive: true,
    },
  });

  const prodPaymentGate = await prisma.product.create({
    data: {
      code: 'PRD-PAY-GATEWAY',
      name: 'Global Multi-Currency Payment Gateway Add-on',
      type: 'SERVICE',
      basePrice: 950.0,
      costPrice: 200.0,
      description: 'Seamless checkout with localized payment schemes.',
      isActive: true,
    },
  });

  const prodCustomDev = await prisma.product.create({
    data: {
      code: 'PRD-ONBOARDING',
      name: 'Dedicated Onboarding & Data Migration',
      type: 'SERVICE',
      basePrice: 5000.0,
      costPrice: 2500.0,
      description: 'White-glove migration from legacy ERPs to Brightloop SubFlow.',
      isActive: true,
    },
  });

  console.log('>>> [SEED] 8 Products & Variants seeded successfully.');

  // 5. Subscription Plans (Requirement 6: Daily, Weekly, Monthly, Yearly)
  const dailyTrialPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Micro-Compute Daily Plan',
      code: 'PLAN-DAILY-MICRO',
      billingFrequency: 'DAILY',
      price: 150.0,
      minQuantity: 1,
      allowEarlyCancellation: true,
      allowPause: true,
      allowRenewal: true,
      autoClose: false,
      isActive: true,
      description: 'Daily billed on-demand capacity testing plan.',
    },
  });

  const weeklySprintPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Agile Sprint Weekly Plan',
      code: 'PLAN-WEEKLY-SPRINT',
      billingFrequency: 'WEEKLY',
      price: 900.0,
      minQuantity: 1,
      allowEarlyCancellation: true,
      allowPause: true,
      allowRenewal: true,
      autoClose: false,
      isActive: true,
      description: '7-day project sprint billing cycle.',
    },
  });

  const monthlyProPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Professional Monthly Plan',
      code: 'PLAN-MONTHLY-PRO',
      billingFrequency: 'MONTHLY',
      price: 2499.0,
      minQuantity: 1,
      allowEarlyCancellation: true,
      allowPause: true,
      allowRenewal: true,
      autoClose: false,
      isActive: true,
      description: 'Most popular plan for high-growth tech organizations.',
    },
  });

  const yearlyEnterprisePlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Enterprise Annual Plan',
      code: 'PLAN-YEARLY-ENT',
      billingFrequency: 'YEARLY',
      price: 24990.0,
      minQuantity: 1,
      allowEarlyCancellation: false, // Contract locked
      allowPause: true,
      allowRenewal: true,
      autoClose: false,
      isActive: true,
      description: 'Annual enterprise agreement with dedicated cluster support.',
    },
  });

  console.log('>>> [SEED] Daily, Weekly, Monthly, Yearly Subscription Plans seeded.');

  // 6. Quotation Templates & Quotations
  const quoteTemplate = await prisma.quotationTemplate.create({
    data: {
      name: 'Standard SaaS Onboarding Template',
      description: 'Default quote template including ERP software and Gold 24/7 support.',
      validityDays: 30,
      defaultTerms: 'Net 15 days upon invoice receipt.',
    },
  });

  const odooVariant = prodSoftware.variants.find((v) => v.sku === 'BIZ-SOFT-ODOO')!;
  const odooUnitPrice = 1000 + odooVariant.priceAdjustment; // 1560

  const quote1 = await prisma.quotation.create({
    data: {
      quotationNumber: 'QUO-2026-0001',
      customerId: custUser2.customerProfile!.id,
      templateId: quoteTemplate.id,
      status: 'SENT',
      validUntil: new Date('2026-12-15'),
      notes: 'Initial quotation sent to NovaStack Labs for Odoo edition migration.',
      terms: 'Net 15',
      subtotal: 1560.0,
      taxAmount: 280.8,
      discountAmount: 0.0,
      grandTotal: 1840.8,
      lines: {
        create: [
          {
            productId: prodSoftware.id,
            variantId: odooVariant.id,
            planId: monthlyProPlan.id,
            quantity: 1,
            unitPrice: odooUnitPrice,
            taxRate: 18.0,
            lineTotal: 1840.8,
          },
        ],
      },
    },
  });

  // 7. Subscriptions with Diverse Statuses (ACTIVE, PAUSED, CLOSED)
  // Sub 1: Acme Technologies (Yearly Active, fully paid historical invoices)
  const sub1 = await prisma.subscription.create({
    data: {
      subscriptionNumber: 'SUB-2026-0001',
      customerId: custUser1.customerProfile!.id,
      planId: yearlyEnterprisePlan.id,
      status: 'ACTIVE',
      startDate: new Date('2025-01-01'),
      expiryDate: new Date('2027-01-01'),
      nextBillingDate: new Date('2027-01-01'),
      paymentTerms: 'Net 30',
      autoClose: false,
      allowEarlyCancellation: false,
      allowPause: true,
      allowRenewal: true,
      subtotal: 24990.0,
      taxAmount: 4498.2,
      discountAmount: 2000.0,
      grandTotal: 27488.2,
      lines: {
        create: [
          {
            productId: prodSoftware.id,
            variantId: prodSoftware.variants.find((v) => v.sku === 'BIZ-SOFT-ENT')?.id,
            quantity: 1,
            unitPrice: 2500.0,
            taxRate: 18.0,
            lineTotal: 2950.0,
          },
          {
            productId: prodBillingEngine.id,
            variantId: prodBillingEngine.variants.find((v) => v.sku === 'SUB-HI-PERF')?.id,
            quantity: 1,
            unitPrice: 5500.0,
            taxRate: 18.0,
            lineTotal: 6490.0,
          },
        ],
      },
    },
  });

  // Sub 2: NovaStack Labs (Monthly Active, due for billing demo!)
  const now = new Date();
  const sub2 = await prisma.subscription.create({
    data: {
      subscriptionNumber: 'SUB-2026-0002',
      customerId: custUser2.customerProfile!.id,
      planId: monthlyProPlan.id,
      status: 'ACTIVE',
      startDate: new Date('2026-01-01'),
      nextBillingDate: new Date(now.getTime() - 1000 * 60 * 60 * 2), // Past due by 2 hours -> ready to be billed right now!
      paymentTerms: 'Net 15',
      autoClose: false,
      allowEarlyCancellation: true,
      allowPause: true,
      allowRenewal: true,
      subtotal: 1560.0,
      taxAmount: 280.8,
      discountAmount: 0.0,
      grandTotal: 1840.8,
      lines: {
        create: [
          {
            productId: prodSoftware.id,
            variantId: odooVariant.id,
            quantity: 1,
            unitPrice: 1560.0,
            taxRate: 18.0,
            lineTotal: 1840.8,
          },
        ],
      },
    },
  });

  // Sub 3: SolarDrive (Paused)
  const sub3 = await prisma.subscription.create({
    data: {
      subscriptionNumber: 'SUB-2026-0003',
      customerId: custUser3.customerProfile!.id,
      planId: monthlyProPlan.id,
      status: 'PAUSED',
      startDate: new Date('2026-03-01'),
      nextBillingDate: new Date('2026-11-15'),
      paymentTerms: 'Net 15',
      autoClose: false,
      allowEarlyCancellation: true,
      allowPause: true,
      allowRenewal: true,
      subtotal: 1800.0,
      taxAmount: 324.0,
      discountAmount: 0.0,
      grandTotal: 2124.0,
      lines: {
        create: [
          {
            productId: prodCrm.id,
            variantId: prodCrm.variants[0].id,
            quantity: 1,
            unitPrice: 1800.0,
            taxRate: 18.0,
            lineTotal: 2124.0,
          },
        ],
      },
    },
  });

  console.log('>>> [SEED] Subscriptions created: Active, Billing-Due, and Paused.');

  // 8. Invoices: PAID, PARTIALLY PAID, UNPAID, and OVERDUE
  // Invoice 1: Acme Technologies (Fully Paid)
  const inv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-202501-0001',
      subscriptionId: sub1.id,
      customerId: custUser1.customerProfile!.id,
      invoiceDate: new Date('2025-01-01'),
      dueDate: new Date('2025-01-31'),
      status: 'PAID',
      subtotal: 24990.0,
      taxAmount: 4498.2,
      discountAmount: 2000.0,
      grandTotal: 27488.2,
      amountPaid: 27488.2,
      outstandingBalance: 0.0,
      notes: 'Annual recurring subscription invoice for 2025-2026.',
      lines: {
        create: [
          {
            productId: prodSoftware.id,
            description: 'Enterprise Cluster ERP License (Yearly)',
            quantity: 1,
            unitPrice: 24990.0,
            taxRate: 18.0,
            taxAmount: 4498.2,
            discountAmount: 2000.0,
            lineTotal: 27488.2,
          },
        ],
      },
    },
  });

  // Payment for Invoice 1
  await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-2025-00001',
      invoiceId: inv1.id,
      customerId: custUser1.customerProfile!.id,
      paymentMethod: 'BANK_TRANSFER',
      amount: 27488.2,
      paymentDate: new Date('2025-01-10'),
      transactionReference: 'NEFT-ACME-99881122',
      notes: 'Full payment via HDFC Corporate Banking',
      recordedByUserId: staffUser.id,
    },
  });

  // Invoice 2: NovaStack Labs (Partially Paid)
  const inv2 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-202609-0002',
      subscriptionId: sub2.id,
      customerId: custUser2.customerProfile!.id,
      invoiceDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-15'),
      status: 'CONFIRMED',
      subtotal: 1560.0,
      taxAmount: 280.8,
      discountAmount: 0.0,
      grandTotal: 1840.8,
      amountPaid: 1000.0,
      outstandingBalance: 840.8,
      notes: 'September subscription invoice (Partial payment received)',
      lines: {
        create: [
          {
            productId: prodSoftware.id,
            description: 'Brightloop Business Software (Odoo Powered Edition) [Monthly]',
            quantity: 1,
            unitPrice: 1560.0,
            taxRate: 18.0,
            taxAmount: 280.8,
            discountAmount: 0.0,
            lineTotal: 1840.8,
          },
        ],
      },
    },
  });

  // Payment 2 (Partial)
  await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-2026-00002',
      invoiceId: inv2.id,
      customerId: custUser2.customerProfile!.id,
      paymentMethod: 'UPI',
      amount: 1000.0,
      paymentDate: new Date('2026-09-05'),
      transactionReference: 'UPI-NOVA-88291024',
      notes: 'Partial payment via PhonePe UPI',
      recordedByUserId: adminUser.id,
    },
  });

  // Invoice 3: SolarDrive (OVERDUE Unpaid Invoice)
  const inv3 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-202608-0003',
      subscriptionId: sub3.id,
      customerId: custUser3.customerProfile!.id,
      invoiceDate: new Date('2026-08-01'),
      dueDate: new Date('2026-08-16'), // Past due date!
      status: 'CONFIRMED',
      subtotal: 1800.0,
      taxAmount: 324.0,
      discountAmount: 0.0,
      grandTotal: 2124.0,
      amountPaid: 0.0,
      outstandingBalance: 2124.0,
      notes: 'Overdue invoice for August cycle',
      lines: {
        create: [
          {
            productId: prodCrm.id,
            description: 'OmniChannel CRM Suite (Up to 5 Users)',
            quantity: 1,
            unitPrice: 1800.0,
            taxRate: 18.0,
            taxAmount: 324.0,
            discountAmount: 0.0,
            lineTotal: 2124.0,
          },
        ],
      },
    },
  });

  console.log('>>> [SEED] Invoices & Payments successfully populated with real ledger data.');
  console.log('===========================================================');
  console.log('DEMO ACCOUNTS READY:');
  console.log('1. ADMIN:    admin@brightloop.io     | SubFlow@2026!');
  console.log('2. STAFF:    staff@brightloop.io     | SubFlow@2026!');
  console.log('3. CUSTOMER: customer@acme.com       | SubFlow@2026!');
  console.log('4. CUSTOMER: founder@novastack.io    | SubFlow@2026!');
  console.log('===========================================================');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
