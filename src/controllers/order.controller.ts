import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { OrderService } from '../services/OrderService';
import { OrderRepository } from '../repositories/OrderRepository';

// Initialize the dependencies
const orderRepo = new OrderRepository();
const orderService = new OrderService(orderRepo);

export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 1000);

  const result = await orderService.getAllOrders(page, limit);
  
  res.status(200).json({ success: true, data: result });
});
