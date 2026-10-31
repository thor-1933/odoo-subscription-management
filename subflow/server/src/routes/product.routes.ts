import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { roundMoney, addMoney } from '../utils/decimalUtils';

const router = Router();

const productSchema = z.object({
  code: z.string().min(2).toUpperCase(),
  name: z.string().min(2),
  type: z.enum(['SERVICE', 'SOFTWARE', 'DIGITAL', 'PHYSICAL']).default('SERVICE'),
  basePrice: z.number().min(0),
  costPrice: z.number().min(0).default(0),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const variantSchema = z.object({
  productId: z.string().uuid().or(z.string().min(1)),
  name: z.string().min(1),
  sku: z.string().min(2).toUpperCase(),
  priceAdjustment: z.number().default(0),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/products
 * Open to authenticated users (admin, staff, customer can view active products)
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const type = req.query.type as string | undefined;
    const activeOnly = req.user?.role === 'CUSTOMER' || req.query.active === 'true';

    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (type) {
      where.type = type.toUpperCase();
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        variants: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data =
      req.user?.role === 'CUSTOMER'
        ? products.map(({ costPrice: _costPrice, ...product }) => product)
        : products;

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { variants: true },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const data =
      req.user?.role === 'CUSTOMER'
        ? (({ costPrice: _costPrice, ...safeProduct }) => safeProduct)(product)
        : product;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/products
 * Admin creates product
 */
router.post('/', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = productSchema.parse(req.body);

    const existing = await prisma.product.findUnique({
      where: { code: validated.code },
    });
    if (existing) {
      throw new AppError(`A product with code '${validated.code}' already exists.`, 409);
    }

    const product = await prisma.product.create({
      data: {
        code: validated.code,
        name: validated.name,
        type: validated.type,
        basePrice: roundMoney(validated.basePrice),
        costPrice: roundMoney(validated.costPrice),
        description: validated.description,
        isActive: validated.isActive,
      },
      include: { variants: true },
    });

    res.status(201).json({ success: true, message: 'Product created successfully', data: product });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/products/:id
 * Admin updates product
 */
router.put('/:id', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = productSchema.partial().parse(req.body);

    const updateData: any = { ...validated };
    if (validated.basePrice !== undefined) updateData.basePrice = roundMoney(validated.basePrice);
    if (validated.costPrice !== undefined) updateData.costPrice = roundMoney(validated.costPrice);

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
      include: { variants: true },
    });

    res.json({ success: true, message: 'Product updated successfully', data: product });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/products/:id (Archive product)
 */
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Product archived successfully', data: product });
  } catch (error) {
    next(error);
  }
});

/* ========================================================
   PRODUCT VARIANTS
======================================================== */

/**
 * POST /api/products/variants
 * Admin adds a variant to a product
 */
router.post('/variants', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = variantSchema.parse(req.body);

    const product = await prisma.product.findUnique({
      where: { id: validated.productId },
    });
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const existingSku = await prisma.productVariant.findUnique({
      where: { sku: validated.sku },
    });
    if (existingSku) {
      throw new AppError(`A variant with SKU '${validated.sku}' already exists.`, 409);
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId: validated.productId,
        name: validated.name,
        sku: validated.sku,
        priceAdjustment: roundMoney(validated.priceAdjustment),
        isActive: validated.isActive,
      },
    });

    const effectivePrice = addMoney(product.basePrice, variant.priceAdjustment);

    res.status(201).json({
      success: true,
      message: 'Product variant created successfully',
      data: {
        ...variant,
        effectivePrice,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/products/variants/:id
 */
router.put('/variants/:id', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = variantSchema.partial().parse(req.body);

    const updateData: any = { ...validated };
    if (validated.priceAdjustment !== undefined) {
      updateData.priceAdjustment = roundMoney(validated.priceAdjustment);
    }

    const variant = await prisma.productVariant.update({
      where: { id: req.params.id },
      data: updateData,
      include: { product: true },
    });

    const effectivePrice = addMoney(variant.product.basePrice, variant.priceAdjustment);

    res.json({
      success: true,
      message: 'Product variant updated',
      data: { ...variant, effectivePrice },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
