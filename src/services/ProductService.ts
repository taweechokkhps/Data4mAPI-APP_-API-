import { IProductRepository } from '../interfaces/IProductRepository';
import { Product, PaginatedProducts, CreateProductDto } from '../models/Product';
import { 
  getCachedProducts, setCachedProducts, invalidateAllCachedProducts,
  getCachedProduct, setCachedProduct
} from '../cache/product.cache';
import { AppError } from '../utils/AppError';

const PRODUCT_TTL_SECONDS = 3600; // 1 hour

export class ProductService {
  constructor(private readonly productRepository: IProductRepository) {}

  async getAllProducts(page: number, limit: number): Promise<PaginatedProducts> {
    const cached = await getCachedProducts(page, limit);
    if (cached) return cached;

    const offset = (page - 1) * limit;
    const { data, total } = await this.productRepository.getAll(limit, offset);
    
    const result: PaginatedProducts = {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };

    await setCachedProducts(page, limit, result, PRODUCT_TTL_SECONDS);

    return result;
  }

  async getProductById(id: number): Promise<Product> {
    const cached = await getCachedProduct(id);
    if (cached) return cached;

    const product = await this.productRepository.getById(id);
    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    await setCachedProduct(id, product, PRODUCT_TTL_SECONDS);

    return product;
  }

  async createProduct(data: CreateProductDto): Promise<Product> {
    const product = await this.productRepository.create(data);
    await invalidateAllCachedProducts();
    return product;
  }
}
