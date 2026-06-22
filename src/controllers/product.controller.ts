import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ProductService } from '../services/ProductService';
import { ProductRepository } from '../repositories/ProductRepository';
import { z } from 'zod';
import { AppError } from '../utils/AppError';

const createProductSchema = z.object({
  productName: z.string().min(1),
  category: z.string().default(''),
  brand: z.string().default(''),
  price: z.number().positive(),
  stockQuantity: z.number().int().nonnegative(),
});

const productRepository = new ProductRepository();
const productService = new ProductService(productRepository);

export const getAllProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 1000);

  const result = await productService.getAllProducts(page, limit);
  res.status(200).json({ success: true, data: result });
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError('Invalid ID', 400, 'INVALID_INPUT');

  const product = await productService.getProductById(id);
  res.status(200).json({ success: true, data: product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const result = createProductSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const product = await productService.createProduct(result.data);
  res.status(201).json({ success: true, data: product });
});

export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError('Invalid ID', 400, 'INVALID_INPUT');

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 100);

  const reviews = await productService.getProductReviews(id, page, limit);
  res.status(200).json({ success: true, data: reviews });
});
