import { OrderWithCustomer, CreateOrderDto } from '../models/Order';

export interface OrderFilters {
  shippingCountry?: string;
  paymentMethod?: string;
  customerId?: number;
  customerName?: string;
}

export interface IOrderRepository {
  getAll(limit: number, offset: number, filters?: OrderFilters): Promise<{ data: OrderWithCustomer[], total: number }>;
  getById(id: number): Promise<OrderWithCustomer | null>;
  create(data: CreateOrderDto): Promise<OrderWithCustomer>;
}
