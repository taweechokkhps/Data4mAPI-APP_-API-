import { DatabaseError } from 'pg';
import { IOrderRepository, OrderFilters } from '../interfaces/IOrderRepository';
import { OrderWithCustomer, CreateOrderDto } from '../models/Order';
import { pool } from '../config/db';
import { AppError } from '../utils/AppError';

// Base queries are now dynamically built to accommodate filters

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
  private buildFilters(filters?: OrderFilters) {
    const clauses: string[] = [];
    const params: any[] = [];
    if (filters?.shippingCountry) { params.push(filters.shippingCountry); clauses.push(`o.shipping_country = $${params.length}`); }
    if (filters?.paymentMethod) { params.push(filters.paymentMethod); clauses.push(`o.payment_method = $${params.length}`); }
    if (filters?.customerId) { params.push(filters.customerId); clauses.push(`o.customer_id = $${params.length}`); }
    if (filters?.customerName) { params.push(`%${filters.customerName}%`); clauses.push(`c.name ILIKE $${params.length}`); }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return { whereSql, params, pIdx: params.length + 1 };
  }

  async getAll(limit: number, offset: number, filters?: OrderFilters): Promise<{ data: OrderWithCustomer[], total: number }> {
    try {
      const { whereSql, params, pIdx } = this.buildFilters(filters);
      const dataQuery = `SELECT o.order_id as "orderId", o.customer_id as "customerId", c.name as "customerName", o.order_date as "orderDate", o.total_amount as "totalAmount", o.payment_method as "paymentMethod", o.shipping_country as "shippingCountry" FROM orders o JOIN customers c ON o.customer_id = c.customer_id ${whereSql} ORDER BY o.order_date DESC LIMIT $${pIdx} OFFSET $${pIdx + 1};`;
      const countQuery = `SELECT COUNT(*) as "totalCount" FROM orders o JOIN customers c ON o.customer_id = c.customer_id ${whereSql};`;
      
      const [result, countResult] = await Promise.all([
        pool.query(dataQuery, [...params, limit, offset]),
        pool.query(countQuery, params)
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
