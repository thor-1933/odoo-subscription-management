import { Router, Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/db';
import { authenticate, requireRole, enforceCustomerOwnership } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

/**
 * GET /api/invoices
 * Staff & Admins see all; Customers see their own
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isCustomer = req.user?.role === 'CUSTOMER';
    const where: any = {};

    if (isCustomer) {
      where.customerId = req.user!.customerProfileId;
    }

    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const overdueOnly = req.query.overdue === 'true';

    if (status) {
      where.status = status.toUpperCase();
    }

    if (overdueOnly) {
      where.status = { not: 'PAID' };
      where.dueDate = { lt: new Date() };
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { customer: { companyName: { contains: search } } },
        { customer: { user: { name: { contains: search } } } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        subscription: {
          select: { subscriptionNumber: true },
        },
        _count: {
          select: { payments: true },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/invoices/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        subscription: {
          include: { plan: true },
        },
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
        payments: {
          include: {
            recordedBy: { select: { name: true } },
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    enforceCustomerOwnership(req, invoice.customerId);

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/invoices/:id/status
 * Update status (e.g. CANCELLED)
 */
router.patch('/:id/status', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const allowed = ['DRAFT', 'CONFIRMED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      throw new AppError('Invalid status update. PAID status is managed via Payment recording.', 400);
    }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status },
      include: { lines: true, customer: true },
    });

    res.json({ success: true, message: `Invoice status updated to ${status}`, data: invoice });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/invoices/:id/pdf
 * Requirement 10: Download invoice as PDF
 */
router.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          include: { user: true },
        },
        lines: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    enforceCustomerOwnership(req, invoice.customerId);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoiceNumber}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor('#4f46e5').text('SubFlow — Brightloop Software', 40, 40);
    doc.fontSize(10).fillColor('#64748b').text('SaaS Subscription & Recurring Revenue Management', 40, 68);
    doc.text('support@brightloop.io | https://subflow.brightloop.io', 40, 82);

    doc.fontSize(20).fillColor('#1e293b').text('INVOICE', 400, 40, { align: 'right' });
    doc.fontSize(10).fillColor('#64748b').text(`Invoice #: ${invoice.invoiceNumber}`, 400, 68, { align: 'right' });
    doc.text(`Date: ${invoice.invoiceDate.toISOString().slice(0, 10)}`, 400, 82, { align: 'right' });
    doc.text(`Due Date: ${invoice.dueDate.toISOString().slice(0, 10)}`, 400, 96, { align: 'right' });
    doc.text(`Status: ${invoice.status}`, 400, 110, { align: 'right' });

    doc.moveTo(40, 135).lineTo(555, 135).strokeColor('#e2e8f0').stroke();

    // Bill To
    doc.fontSize(12).fillColor('#1e293b').text('Billed To:', 40, 150);
    doc.fontSize(10).fillColor('#334155').text(invoice.customer.companyName || invoice.customer.user.name, 40, 168);
    if (invoice.customer.billingAddress) doc.text(invoice.customer.billingAddress, 40, 182);
    if (invoice.customer.city) doc.text(`${invoice.customer.city}, ${invoice.customer.state || ''} ${invoice.customer.postalCode || ''}`, 40, 196);
    doc.text(`Email: ${invoice.customer.user.email}`, 40, 210);
    if (invoice.customer.taxId) doc.text(`Tax ID / GST: ${invoice.customer.taxId}`, 40, 224);

    // Table Header
    let y = 255;
    doc.rect(40, y, 515, 24).fill('#f8fafc');
    doc.fontSize(10).fillColor('#475569');
    doc.text('Description', 45, y + 6);
    doc.text('Qty', 320, y + 6);
    doc.text('Unit Price', 370, y + 6);
    doc.text('Tax', 440, y + 6);
    doc.text('Total', 500, y + 6, { align: 'right' });

    y += 26;
    doc.fillColor('#1e293b');

    // Lines
    invoice.lines.forEach((line) => {
      doc.text(line.description.slice(0, 45), 45, y);
      doc.text(String(line.quantity), 320, y);
      doc.text(`₹${line.unitPrice.toFixed(2)}`, 370, y);
      doc.text(`${line.taxRate}%`, 440, y);
      doc.text(`₹${line.lineTotal.toFixed(2)}`, 495, y, { align: 'right' });
      y += 20;
    });

    y += 10;
    doc.moveTo(40, y).lineTo(555, y).strokeColor('#e2e8f0').stroke();
    y += 15;

    // Totals Box
    doc.fontSize(10).fillColor('#475569');
    doc.text('Subtotal:', 380, y);
    doc.text(`₹${invoice.subtotal.toFixed(2)}`, 500, y, { align: 'right' });
    y += 18;

    if (invoice.discountAmount > 0) {
      doc.text('Discount:', 380, y);
      doc.fillColor('#16a34a').text(`-₹${invoice.discountAmount.toFixed(2)}`, 500, y, { align: 'right' });
      y += 18;
      doc.fillColor('#475569');
    }

    doc.text('Tax:', 380, y);
    doc.text(`₹${invoice.taxAmount.toFixed(2)}`, 500, y, { align: 'right' });
    y += 18;

    doc.fontSize(12).fillColor('#1e293b').text('Grand Total:', 380, y);
    doc.text(`₹${invoice.grandTotal.toFixed(2)}`, 500, y, { align: 'right' });
    y += 20;

    doc.fontSize(10).fillColor('#16a34a').text('Amount Paid:', 380, y);
    doc.text(`₹${invoice.amountPaid.toFixed(2)}`, 500, y, { align: 'right' });
    y += 18;

    doc.fontSize(11).fillColor(invoice.outstandingBalance > 0 ? '#dc2626' : '#16a34a').text('Balance Due:', 380, y);
    doc.text(`₹${invoice.outstandingBalance.toFixed(2)}`, 500, y, { align: 'right' });

    // Footer
    doc.fontSize(9).fillColor('#94a3b8').text(
      'Thank you for your business. For billing queries, contact billing@brightloop.io',
      40,
      770,
      { align: 'center', width: 515 }
    );

    doc.end();
  } catch (error) {
    next(error);
  }
});

export default router;
