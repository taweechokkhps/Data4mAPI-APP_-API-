import { DatabaseError } from 'pg';
import { IProductRepository } from '../interfaces/IProductRepository';
import { Product, CreateProductDto } from '../models/Product';
import { pool } from '../config/db';
import { AppError } from '../utils/AppError';

const GET_ALL_PRODUCTS_QUERY = `
  SELECT 
    product_id as "productId",
    name,
    description,
    price,
    stock_count as "stockCount",
    created_at as "createdAt"
  FROM products
  ORDER BY created_at DESC
  LIMIT $1 OFFSET $2;
`;

const COUNT_PRODUCTS_QUERY = `SELECT COUNT(*) as "totalCount" FROM products;`;

const GET_PRODUCT_BY_ID_QUERY = `
  SELECT 
    product_id as "productId",
    name,
    description,
    price,
    stock_count as "stockCount",
    created_at as "createdAt"
  FROM products
  WHERE product_id = $1;
`;

const CREATE_PRODUCT_QUERY = `
  INSERT INTO products (name, description, price, stock_count, created_at)
  VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
  RETURNING 
    product_id as "productId",
    name,
    description,
    price,
    stock_count as "stockCount",
    created_at as "createdAt";
`;

export class ProductRepository implements IProductRepository {
  async getAll(limit: number, offset: number): Promise<{ data: Product[], total: number }> {
    try {
      const [result, countResult] = await Promise.all([
        pool.query(GET_ALL_PRODUCTS_QUERY, [limit, offset]),
        pool.query(COUNT_PRODUCTS_QUERY)
      ]);
      const total = Number(countResult.rows[0].totalCount);
      const data = result.rows.map(row => this.mapToDomain(row as unknown as Product));
      return { data, total };
    } catch (err: unknown) {
      this.handleDbError(err);
    }
  }

  async getById(id: number): Promise<Product | null> {
    try {
      const result = await pool.query(GET_PRODUCT_BY_ID_QUERY, [id]);
      if (result.rowCount === 0) return null;
      return this.mapToDomain(result.rows[0] as unknown as Product);
    } catch (err: unknown) {
      this.handleDbError(err);
    }
  }

  async create(data: CreateProductDto): Promise<Product> {
    try {
      const result = await pool.query(CREATE_PRODUCT_QUERY, [
        data.name,
        data.description,
        data.price,
        data.stockCount
      ]);
      return this.mapToDomain(result.rows[0] as unknown as Product);
    } catch (err: unknown) {
      this.handleDbError(err);
    }
  }

  private mapToDomain(row: Product): Product {
    return {
      productId: row.productId,
      name: row.name,
      description: row.description,
      price: row.price,
      stockCount: row.stockCount,
      createdAt: row.createdAt,
    };
  }

  private handleDbError(err: unknown): never {
    if (err instanceof DatabaseError) {
      if (err.code === '23505') {
        throw new AppError('Product name already in use', 409, 'PRODUCT_CONFLICT');
      }
      throw new AppError(`Database error: ${err.message}`, 500, 'DB_ERROR');
    }
    throw err as Error;
  }
}
