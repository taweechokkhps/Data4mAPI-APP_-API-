import { DatabaseError } from 'pg';
import { IOrderRepository } from '../interfaces/IOrderRepository';
import { OrderWithCustomer } from '../models/Order';
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
    o.shipping_country as "shippingCountry",
    COUNT(*) OVER() as "totalCount"
  FROM orders o
  JOIN customers c ON o.customer_id = c.customer_id
  ORDER BY o.order_date DESC
  LIMIT $1 OFFSET $2;
`;

export class OrderRepository implements IOrderRepository {
  async getAll(limit: number, offset: number): Promise<{ data: OrderWithCustomer[], total: number }> {
    try {
      const result = await pool.query(GET_ALL_ORDERS_QUERY, [limit, offset]);
      const total = result.rowCount && result.rowCount > 0 ? Number(result.rows[0].totalCount) : 0;
      const data = result.rows.map(row => this.mapToDomain(row as unknown as OrderWithCustomer));
      return { data, total };
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
      throw new AppError(`Database error: ${err.message}`, 500, 'DB_ERROR');
    }
    throw err as Error;
  }
}
