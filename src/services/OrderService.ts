import { IOrderRepository } from '../interfaces/IOrderRepository';
import { OrderWithCustomer } from '../models/Order';

export interface PaginatedOrders {
  data: OrderWithCustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class OrderService {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async getAllOrders(page: number, limit: number): Promise<PaginatedOrders> {
    const offset = (page - 1) * limit;
    const { data, total } = await this.orderRepo.getAll(limit, offset);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
