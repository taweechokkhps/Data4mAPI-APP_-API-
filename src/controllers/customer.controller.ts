import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { CustomerService } from '../services/CustomerService';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { pool } from '../config/db';

// Manually initialize the dependencies and inject them
const customerRepository = new CustomerRepository();
const customerService = new CustomerService(customerRepository);

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  
  const customer = await customerService.getCustomerWithRecentOrders(id);
  
  res.status(200).json({ success: true, data: customer });
});
