import { CustomerService } from '../services/CustomerService';
import { ICustomerRepository } from '../interfaces/ICustomerRepository';
import { CustomerWithOrders } from '../models/Customer';
import { AppError } from '../utils/AppError';

describe('CustomerService', () => {
  let customerService: CustomerService;
  let mockCustomerRepo: jest.Mocked<ICustomerRepository>;

  beforeEach(() => {
    // Create a mock implementation of the repository interface
    mockCustomerRepo = {
      getByIdWithOrders: jest.fn(),
    };
    
    // Inject the mock repository into the service via constructor
    customerService = new CustomerService(mockCustomerRepo);
  });

  describe('getCustomerWithRecentOrders', () => {
    it('should return the customer with orders when the customer exists', async () => {
      // Arrange
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

      mockCustomerRepo.getByIdWithOrders.mockResolvedValue(mockCustomer);

      // Act
      const result = await customerService.getCustomerWithRecentOrders(1);

      // Assert
      expect(mockCustomerRepo.getByIdWithOrders).toHaveBeenCalledWith(1);
      expect(mockCustomerRepo.getByIdWithOrders).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockCustomer);
    });

    it('should throw an AppError (404) with code CUSTOMER_NOT_FOUND when customer does not exist', async () => {
      // Arrange
      mockCustomerRepo.getByIdWithOrders.mockResolvedValue(null);

      // Act & Assert
      await expect(customerService.getCustomerWithRecentOrders(999))
        .rejects
        .toThrow(AppError);
        
      // Ensure the error properties align with the architectural expectations
      await expect(customerService.getCustomerWithRecentOrders(999))
        .rejects
        .toMatchObject({
          statusCode: 404,
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer not found'
        });

      // Verify repository was called correctly
      expect(mockCustomerRepo.getByIdWithOrders).toHaveBeenCalledWith(999);
    });
  });
});
