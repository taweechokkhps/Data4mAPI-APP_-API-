import { CustomerService } from '../services/CustomerService';
import { ICustomerRepository } from '../interfaces/ICustomerRepository';
import { CustomerWithOrders } from '../models/Customer';
import { AppError } from '../utils/AppError';
import * as customerCache from '../cache/customer.cache';

jest.mock('../cache/customer.cache');

describe('CustomerService', () => {
  let customerService: CustomerService;
  let mockCustomerRepository: jest.Mocked<ICustomerRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a mock implementation of the repository interface
    mockCustomerRepository = {
      getByIdWithOrders: jest.fn(),
    };
    
    // Inject the mock repository into the service via constructor
    customerService = new CustomerService(mockCustomerRepository);
  });

  describe('getCustomerWithRecentOrders', () => {
    const mockCustomer: CustomerWithOrders = {
      customerId: 1,
      name: 'John Doe',
      email: 'john@example.com',
      gender: 'Male',
      country: 'USA',
      signupDate: new Date('2023-01-01'),
      orders: [
        {
          orderId: 101,
          orderDate: new Date('2023-01-05'),
          totalAmount: 150.50,
          paymentMethod: 'Credit Card',
          shippingCountry: 'USA'
        }
      ]
    };

    it('should return cached customer if available and not call repository', async () => {
      // Arrange
      (customerCache.getCachedCustomer as jest.Mock).mockResolvedValue(mockCustomer);

      // Act
      const result = await customerService.getCustomerWithRecentOrders(1);

      // Assert
      expect(customerCache.getCachedCustomer).toHaveBeenCalledWith(1);
      expect(mockCustomerRepository.getByIdWithOrders).not.toHaveBeenCalled();
      expect(result).toEqual(mockCustomer);
    });

    it('should query repository, cache it, and return customer on cache miss', async () => {
      // Arrange
      (customerCache.getCachedCustomer as jest.Mock).mockResolvedValue(null);
      mockCustomerRepository.getByIdWithOrders.mockResolvedValue(mockCustomer);

      // Act
      const result = await customerService.getCustomerWithRecentOrders(1);

      // Assert
      expect(customerCache.getCachedCustomer).toHaveBeenCalledWith(1);
      expect(mockCustomerRepository.getByIdWithOrders).toHaveBeenCalledWith(1);
      expect(customerCache.setCachedCustomer).toHaveBeenCalledWith(1, mockCustomer, 1800);
      expect(result).toEqual(mockCustomer);
    });

    it('should throw an AppError (404) with code CUSTOMER_NOT_FOUND when customer does not exist', async () => {
      // Arrange
      (customerCache.getCachedCustomer as jest.Mock).mockResolvedValue(null);
      mockCustomerRepository.getByIdWithOrders.mockResolvedValue(null);

      // Act & Assert
      await expect(customerService.getCustomerWithRecentOrders(999))
        .rejects
        .toThrow(AppError);
        
      expect(mockCustomerRepository.getByIdWithOrders).toHaveBeenCalledWith(999);
      expect(customerCache.setCachedCustomer).not.toHaveBeenCalled();
    });
  });
});
