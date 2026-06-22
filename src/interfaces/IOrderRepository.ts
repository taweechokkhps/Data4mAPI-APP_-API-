import { OrderWithCustomer, CreateOrderDto } from '../models/Order';

export interface IOrderRepository {
  getAll(limit: number, offset: number): Promise<{ data: OrderWithCustomer[], total: number }>;
  create(data: CreateOrderDto): Promise<OrderWithCustomer>;
}
