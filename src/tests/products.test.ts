import { ProductService } from '../services/ProductService';
import { IProductRepository } from '../interfaces/IProductRepository';
import { Product, PaginatedProducts } from '../models/Product';
import * as productCache from '../cache/product.cache';
import { AppError } from '../utils/AppError';

jest.mock('../cache/product.cache');

describe('ProductService', () => {
  let productService: ProductService;
  let mockProductRepository: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProductRepository = {
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
    };
    productService = new ProductService(mockProductRepository);
  });

  describe('getAllProducts', () => {
    const mockProducts: Product[] = [
      {
        productId: 1,
        name: 'Laptop',
        description: 'A fast laptop',
        price: 1000,
        stockCount: 50,
        createdAt: new Date('2023-01-01')
      }
    ];

    const mockPaginatedProducts: PaginatedProducts = {
      data: mockProducts,
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1
    };

    it('should return cached products if available', async () => {
      (productCache.getCachedProducts as jest.Mock).mockResolvedValue(mockPaginatedProducts);
      const result = await productService.getAllProducts(1, 10);
      expect(mockProductRepository.getAll).not.toHaveBeenCalled();
      expect(result).toEqual(mockPaginatedProducts);
    });

    it('should query DB on cache miss and save to cache', async () => {
      (productCache.getCachedProducts as jest.Mock).mockResolvedValue(null);
      mockProductRepository.getAll.mockResolvedValue({ data: mockProducts, total: 1 });
      const result = await productService.getAllProducts(1, 10);
      expect(mockProductRepository.getAll).toHaveBeenCalledWith(10, 0);
      expect(productCache.setCachedProducts).toHaveBeenCalledWith(1, 10, mockPaginatedProducts, 3600);
      expect(result).toEqual(mockPaginatedProducts);
    });
  });

  describe('getProductById', () => {
    const mockProduct: Product = {
      productId: 1,
      name: 'Laptop',
      description: 'A fast laptop',
      price: 1000,
      stockCount: 50,
      createdAt: new Date('2023-01-01')
    };

    it('should return cached product', async () => {
      (productCache.getCachedProduct as jest.Mock).mockResolvedValue(mockProduct);
      const result = await productService.getProductById(1);
      expect(mockProductRepository.getById).not.toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should query DB on cache miss', async () => {
      (productCache.getCachedProduct as jest.Mock).mockResolvedValue(null);
      mockProductRepository.getById.mockResolvedValue(mockProduct);
      const result = await productService.getProductById(1);
      expect(mockProductRepository.getById).toHaveBeenCalledWith(1);
      expect(productCache.setCachedProduct).toHaveBeenCalledWith(1, mockProduct, 3600);
      expect(result).toEqual(mockProduct);
    });

    it('should throw 404 if product not found', async () => {
      (productCache.getCachedProduct as jest.Mock).mockResolvedValue(null);
      mockProductRepository.getById.mockResolvedValue(null);
      await expect(productService.getProductById(999)).rejects.toThrow(AppError);
    });
  });

  describe('createProduct', () => {
    it('should query repo and invalidate cache', async () => {
      const mockDto = { name: 'Laptop', description: 'desc', price: 100, stockCount: 10 };
      const mockProduct: Product = { productId: 1, ...mockDto, createdAt: new Date() };

      mockProductRepository.create.mockResolvedValue(mockProduct);
      const result = await productService.createProduct(mockDto);

      expect(mockProductRepository.create).toHaveBeenCalledWith(mockDto);
      expect(productCache.invalidateAllCachedProducts).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockProduct);
    });
  });
});
