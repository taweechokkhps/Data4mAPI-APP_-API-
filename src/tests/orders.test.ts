import { OrderService } from '../services/OrderService';
import { IOrderRepository } from '../interfaces/IOrderRepository';
import { OrderWithCustomer, PaginatedOrders } from '../models/Order';
import * as orderCache from '../cache/order.cache';

jest.mock('../cache/order.cache');

describe('OrderService', () => {
  let orderService: OrderService;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a mock implementation of the repository interface
    mockOrderRepository = {
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
    };
    
    // Inject the mock repository into the service via constructor
    orderService = new OrderService(mockOrderRepository);
  });

  describe('getAllOrders', () => {
    const mockOrders: OrderWithCustomer[] = [
      {
        orderId: 1,
        customerId: 101,
        customerName: 'Alice Smith',
        orderDate: new Date('2023-10-01'),
        totalAmount: 250.00,
        paymentMethod: 'Credit Card',
        shippingCountry: 'USA'
      }
    ];

    const mockPaginatedOrders: PaginatedOrders = {
      data: mockOrders,
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1
    };

    it('should return cached orders if available and not call repository', async () => {
      // Arrange
      (orderCache.getCachedOrders as jest.Mock).mockResolvedValue(mockPaginatedOrders);

      // Act
      const result = await orderService.getAllOrders(1, 10);

      // Assert
      expect(orderCache.getCachedOrders).toHaveBeenCalledWith(1, 10, undefined);
      expect(mockOrderRepository.getAll).not.toHaveBeenCalled();
      expect(result).toEqual(mockPaginatedOrders);
    });

    it('should query repository, cache it, and return orders on cache miss', async () => {
      // Arrange
      (orderCache.getCachedOrders as jest.Mock).mockResolvedValue(null);
      mockOrderRepository.getAll.mockResolvedValue({ data: mockOrders, total: 1 });

      // Act
      const result = await orderService.getAllOrders(1, 10);

      // Assert
      expect(orderCache.getCachedOrders).toHaveBeenCalledWith(1, 10, undefined);
      expect(mockOrderRepository.getAll).toHaveBeenCalledWith(10, 0, undefined);
      expect(orderCache.setCachedOrders).toHaveBeenCalledWith(1, 10, mockPaginatedOrders, 3600, undefined);
      expect(result).toEqual(mockPaginatedOrders);
    });
  });

  describe('createOrder', () => {
    it('should query repository to create order and invalidate cache', async () => {
      // Arrange
      const mockDto = {
        customerId: 101,
        totalAmount: 250.00,
        paymentMethod: 'Credit Card',
        shippingCountry: 'USA'
      };

      const mockOrder: OrderWithCustomer = {
        orderId: 1,
        customerId: 101,
        customerName: 'Alice Smith',
        orderDate: new Date('2023-10-01'),
        totalAmount: 250.00,
        paymentMethod: 'Credit Card',
        shippingCountry: 'USA'
      };

      mockOrderRepository.create.mockResolvedValue(mockOrder);

      // Act
      const result = await orderService.createOrder(mockDto);

      // Assert
      expect(mockOrderRepository.create).toHaveBeenCalledWith(mockDto);
      expect(orderCache.invalidateAllCachedOrders).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockOrder);
    });
  });
});
