import { IOrderRepository } from '../interfaces/IOrderRepository';
import { PaginatedOrders, CreateOrderDto, OrderWithCustomer } from '../models/Order';
import { AppError } from '../utils/AppError';
import { getCachedOrders, setCachedOrders, invalidateAllCachedOrders, getCachedOrder, setCachedOrder } from '../cache/order.cache';

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

  async getOrderById(id: number): Promise<OrderWithCustomer> {
    const cached = await getCachedOrder(id);
    if (cached) return cached;

    const order = await this.orderRepository.getById(id);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    await setCachedOrder(id, order, ORDER_TTL_SECONDS);

    return order;
  }

  async createOrder(data: CreateOrderDto): Promise<OrderWithCustomer> {
    const order = await this.orderRepository.create(data);
    await invalidateAllCachedOrders();
    return order;
  }
}
