import { ICustomerRepository } from '../interfaces/ICustomerRepository';
import { CustomerWithOrders } from '../models/Customer';
import { AppError } from '../utils/AppError';

export class CustomerService {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async getCustomerWithRecentOrders(id: number): Promise<CustomerWithOrders> {
    const customer = await this.customerRepo.getByIdWithOrders(id);

    if (!customer) {
      throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
    }

    return customer;
  }
}
