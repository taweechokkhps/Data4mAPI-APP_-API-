import { DatabaseError } from 'pg';
import { IOrderRepository } from '../interfaces/IOrderRepository';
import { OrderWithCustomer, CreateOrderDto } from '../models/Order';
import { pool } from '../config/db';
import { AppError } from '../utils/AppError';

// Extract query to satisfy function length bounds (< 20 lines)
const GET_ALL_ORDERS_QUERY = `
  SELECT 
    o.order_id as "orderId",
    o.customer_id as "customerId",
    c.name as "customerName",
    o.order_date as "orderDate",
    o.total_amount as "totalAmount",
    o.payment_method as "paymentMethod",
    o.shipping_country as "shippingCountry"
  FROM orders o
  JOIN customers c ON o.customer_id = c.customer_id
  ORDER BY o.order_date DESC
  LIMIT $1 OFFSET $2;
`;

const COUNT_ORDERS_QUERY = `SELECT COUNT(*) as "totalCount" FROM orders;`;

const GET_ORDER_BY_ID_QUERY = `
  SELECT 
    o.order_id as "orderId",
    o.customer_id as "customerId",
    c.name as "customerName",
    o.order_date as "orderDate",
    o.total_amount as "totalAmount",
    o.payment_method as "paymentMethod",
    o.shipping_country as "shippingCountry"
  FROM orders o
  JOIN customers c ON o.customer_id = c.customer_id
  WHERE o.order_id = $1;
`;

const CREATE_ORDER_QUERY = `
  WITH inserted AS (
    INSERT INTO orders (customer_id, order_date, total_amount, payment_method, shipping_country)
    VALUES ($1, CURRENT_DATE, $2, $3, $4)
    RETURNING *
  )
  SELECT 
    i.order_id as "orderId",
    i.customer_id as "customerId",
    c.name as "customerName",
    i.order_date as "orderDate",
    i.total_amount as "totalAmount",
    i.payment_method as "paymentMethod",
    i.shipping_country as "shippingCountry"
  FROM inserted i
  JOIN customers c ON i.customer_id = c.customer_id;
`;

export class OrderRepository implements IOrderRepository {
  async getAll(limit: number, offset: number): Promise<{ data: OrderWithCustomer[], total: number }> {
    try {
      const [result, countResult] = await Promise.all([
        pool.query(GET_ALL_ORDERS_QUERY, [limit, offset]),
        pool.query(COUNT_ORDERS_QUERY)
      ]);
      const total = Number(countResult.rows[0].totalCount);
      const data = result.rows.map(row => this.mapToDomain(row as unknown as OrderWithCustomer));
      return { data, total };
    } catch (err: unknown) {
      this.handleDbError(err);
    }
  }

  async getById(id: number): Promise<OrderWithCustomer | null> {
    try {
      const result = await pool.query(GET_ORDER_BY_ID_QUERY, [id]);
      if (result.rowCount === 0) return null;
      return this.mapToDomain(result.rows[0] as unknown as OrderWithCustomer);
    } catch (err: unknown) {
      this.handleDbError(err);
    }
  }

  async create(data: CreateOrderDto): Promise<OrderWithCustomer> {
    try {
      const result = await pool.query(CREATE_ORDER_QUERY, [
        data.customerId,
        data.totalAmount,
        data.paymentMethod,
        data.shippingCountry
      ]);
      return this.mapToDomain(result.rows[0] as unknown as OrderWithCustomer);
    } catch (err: unknown) {
      this.handleDbError(err);
    }
  }

  private mapToDomain(row: OrderWithCustomer): OrderWithCustomer {
    return {
      orderId: row.orderId,
      customerId: row.customerId,
      customerName: row.customerName,
      orderDate: row.orderDate,
      totalAmount: row.totalAmount,
      paymentMethod: row.paymentMethod,
      shippingCountry: row.shippingCountry,
    };
  }

  private handleDbError(err: unknown): never {
    if (err instanceof DatabaseError) {
      if (err.code === '23503') {
        throw new AppError('Referenced resource does not exist', 400, 'FOREIGN_KEY_ERROR');
      }
      throw new AppError(`Database error: ${err.message}`, 500, 'DB_ERROR');
    }
    throw err as Error;
  }
}
