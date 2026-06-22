import { OrderWithCustomer } from '../models/Order';

export interface IOrderRepository {
  getAll(limit: number, offset: number): Promise<{ data: OrderWithCustomer[], total: number }>;
}
