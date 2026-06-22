import { ICustomerRepository } from '../interfaces/ICustomerRepository';
import { CustomerWithOrders } from '../models/Customer';
import { AppError } from '../utils/AppError';
import { getCachedCustomer, setCachedCustomer } from '../cache/customer.cache';

const CUSTOMER_TTL_SECONDS = 1800; // 30 minutes

export class CustomerService {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async getCustomerWithRecentOrders(id: number): Promise<CustomerWithOrders> {
    const cached = await getCachedCustomer(id);
    if (cached) return cached;

    const customer = await this.customerRepository.getByIdWithOrders(id);

    if (!customer) {
      throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
    }

    await setCachedCustomer(id, customer, CUSTOMER_TTL_SECONDS);

    return customer;
  }
}
