import { DatabaseError } from 'pg';
import { ICustomerRepository } from '../interfaces/ICustomerRepository';
import { CustomerWithOrders, OrderSummary } from '../models/Customer';
import { pool } from '../config/db';
import { AppError } from '../utils/AppError';

// Extracted query to keep method length under 20 lines
const GET_CUSTOMER_ORDERS_QUERY = `
  SELECT 
    c.customer_id as "customerId", c.name, c.email, 
    c.gender, c.country, c.signup_date as "signupDate",
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'orderId', o.order_id, 'orderDate', o.order_date,
          'totalAmount', o.total_amount, 'paymentMethod', o.payment_method,
          'shippingCountry', o.shipping_country
        )
      ) FILTER (WHERE o.order_id IS NOT NULL), '[]'
    ) as orders
  FROM customers c
  LEFT JOIN orders o ON c.customer_id = o.customer_id
  WHERE c.customer_id = $1
  GROUP BY c.customer_id;
`;

export class CustomerRepository implements ICustomerRepository {
  async getByIdWithOrders(id: number): Promise<CustomerWithOrders | null> {
    try {
      const result = await pool.query<CustomerWithOrders>(
        GET_CUSTOMER_ORDERS_QUERY,
        [id]
      );

      if (result.rowCount === 0) return null;

      return this.mapToDomain(result.rows[0]);
    } catch (err: unknown) {
      this.handleDbError(err);
    }
  }

  private mapToDomain(row: CustomerWithOrders): CustomerWithOrders {
    return {
      customerId: row.customerId,
      name: row.name,
      email: row.email,
      gender: row.gender,
      country: row.country,
      signupDate: row.signupDate,
      orders: row.orders,
    };
  }

  private handleDbError(err: unknown): never {
    if (err instanceof DatabaseError) {
      throw new AppError(`Database error: ${err.message}`, 500, 'DB_ERROR');
    }
    throw err as Error; // Narrow to Error since we can't throw unknown easily
  }
}
