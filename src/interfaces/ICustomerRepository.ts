import { CustomerWithOrders } from '../models/Customer';

export interface ICustomerRepository {
  getByIdWithOrders(id: number): Promise<CustomerWithOrders | null>;
}
