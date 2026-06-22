import { Product, CreateProductDto } from '../models/Product';

export interface IProductRepository {
  getAll(limit: number, offset: number): Promise<{ data: Product[], total: number }>;
  getById(id: number): Promise<Product | null>;
  create(data: CreateProductDto): Promise<Product>;
}
