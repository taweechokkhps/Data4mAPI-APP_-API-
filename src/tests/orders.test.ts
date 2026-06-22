import { OrderService } from '../services/OrderService';
import { IOrderRepository } from '../interfaces/IOrderRepository';
import { OrderWithCustomer } from '../models/Order';

describe('OrderService', () => {
  let orderService: OrderService;
  let mockOrderRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    // Create a mock implementation of the repository interface
    mockOrderRepo = {
      getAll: jest.fn(),
    };
    
    // Inject the mock repository into the service via constructor
    orderService = new OrderService(mockOrderRepo);
  });

  describe('getAllOrders', () => {
    it('should return paginated OrderWithCustomer objects and call repository with offset/limit', async () => {
      // Arrange
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

      mockOrderRepo.getAll.mockResolvedValue({ data: mockOrders, total: 1 });

      // Act
      const result = await orderService.getAllOrders(1, 10);

      // Assert
      expect(mockOrderRepo.getAll).toHaveBeenCalledWith(10, 0);
      expect(result).toEqual({
        data: mockOrders,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      });
    });
  });
});
