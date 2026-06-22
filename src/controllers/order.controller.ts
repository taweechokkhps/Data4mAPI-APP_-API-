import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { OrderService } from '../services/OrderService';
import { OrderRepository } from '../repositories/OrderRepository';
import { z } from 'zod';
import { AppError } from '../utils/AppError';

const createOrderSchema = z.object({
  customerId: z.number().int().positive(),
  totalAmount: z.number().positive(),
  paymentMethod: z.string().min(1),
  shippingCountry: z.string().min(1),
});

// Initialize the dependencies
const orderRepository = new OrderRepository();
const orderService = new OrderService(orderRepository);

export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 1000);

  const result = await orderService.getAllOrders(page, limit);
  
  res.status(200).json({ success: true, data: result });
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = createOrderSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const order = await orderService.createOrder(result.data);
  res.status(201).json({ success: true, data: order });
});
