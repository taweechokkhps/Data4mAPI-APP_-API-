import { ICustomerRepository } from '../interfaces/ICustomerRepository';
import { CustomerWithOrders, PaginatedCustomers, CreateCustomerDto, Customer } from '../models/Customer';
import { AppError } from '../utils/AppError';
import { getCachedCustomer, setCachedCustomer, getCachedCustomers, setCachedCustomers, invalidateAllCachedCustomers } from '../cache/customer.cache';

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

  async getAllCustomers(page: number, limit: number): Promise<PaginatedCustomers> {
    const cached = await getCachedCustomers(page, limit);
    if (cached) return cached;

    const offset = (page - 1) * limit;
    const { data, total } = await this.customerRepository.getAll(limit, offset);
    
    const result: PaginatedCustomers = {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };

    await setCachedCustomers(page, limit, result, CUSTOMER_TTL_SECONDS);

    return result;
  }

  async createCustomer(data: CreateCustomerDto): Promise<Customer> {
    const customer = await this.customerRepository.create(data);
    await invalidateAllCachedCustomers();
    return customer;
  }
}
