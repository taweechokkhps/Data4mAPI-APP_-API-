import { CustomerWithOrders, Customer, CreateCustomerDto } from '../models/Customer';

export interface ICustomerRepository {
  getByIdWithOrders(id: number): Promise<CustomerWithOrders | null>;
  getAll(limit: number, offset: number): Promise<{ data: Customer[], total: number }>;
  create(data: CreateCustomerDto): Promise<Customer>;
}
