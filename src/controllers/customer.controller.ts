import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { CustomerService } from '../services/CustomerService';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { z } from 'zod';
import { AppError } from '../utils/AppError';

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  gender: z.string().min(1),
  country: z.string().min(1),
});
import { pool } from '../config/db';

// Manually initialize the dependencies and inject them
const customerRepository = new CustomerRepository();
const customerService = new CustomerService(customerRepository);

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  
  const customer = await customerService.getCustomerWithRecentOrders(id);
  
  res.status(200).json({ success: true, data: customer });
});

export const getAllCustomers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 1000);

  const result = await customerService.getAllCustomers(page, limit);
  res.status(200).json({ success: true, data: result });
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const result = createCustomerSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const customer = await customerService.createCustomer(result.data);
  res.status(201).json({ success: true, data: customer });
});
