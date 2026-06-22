import { IOrderRepository } from '../interfaces/IOrderRepository';
import { PaginatedOrders, CreateOrderDto, OrderWithCustomer } from '../models/Order';
import { getCachedOrders, setCachedOrders, invalidateAllCachedOrders } from '../cache/order.cache';

const ORDER_TTL_SECONDS = 3600; // 1 hour

export class OrderService {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async getAllOrders(page: number, limit: number): Promise<PaginatedOrders> {
    const cached = await getCachedOrders(page, limit);
    if (cached) return cached;

    const offset = (page - 1) * limit;
    const { data, total } = await this.orderRepository.getAll(limit, offset);
    
    const result: PaginatedOrders = {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };

    await setCachedOrders(page, limit, result, ORDER_TTL_SECONDS);

    return result;
  }

  async createOrder(data: CreateOrderDto): Promise<OrderWithCustomer> {
    const order = await this.orderRepository.create(data);
    await invalidateAllCachedOrders();
    return order;
  }
}
