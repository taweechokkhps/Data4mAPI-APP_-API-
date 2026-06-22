import { DatabaseError } from 'pg';
import { ICustomerRepository } from '../interfaces/ICustomerRepository';
import { CustomerWithOrders, Customer, CreateCustomerDto } from '../models/Customer';
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

const GET_ALL_CUSTOMERS_QUERY = `
  SELECT 
    customer_id as "customerId",
    name,
    email,
    gender,
    country,
    signup_date as "signupDate"
  FROM customers
  ORDER BY signup_date DESC
  LIMIT $1 OFFSET $2;
`;

const COUNT_CUSTOMERS_QUERY = `SELECT COUNT(*) as "totalCount" FROM customers;`;

const CREATE_CUSTOMER_QUERY = `
  INSERT INTO customers (name, email, gender, country)
  VALUES ($1, $2, $3, $4)
  RETURNING 
    customer_id as "customerId",
    name,
    email,
    gender,
    country,
    signup_date as "signupDate";
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

  async getAll(limit: number, offset: number): Promise<{ data: Customer[], total: number }> {
    try {
      const [result, countResult] = await Promise.all([
        pool.query(GET_ALL_CUSTOMERS_QUERY, [limit, offset]),
        pool.query(COUNT_CUSTOMERS_QUERY)
      ]);
      const total = Number(countResult.rows[0].totalCount);
      const data = result.rows.map(row => this.mapToCustomer(row as unknown as Customer));
      return { data, total };
    } catch (err: unknown) {
      this.handleDbError(err);
    }
  }

  async create(data: CreateCustomerDto): Promise<Customer> {
    try {
      const result = await pool.query(CREATE_CUSTOMER_QUERY, [
        data.name,
        data.email,
        data.gender,
        data.country
      ]);
      return this.mapToCustomer(result.rows[0] as unknown as Customer);
    } catch (err: unknown) {
      this.handleDbError(err);
    }
  }

  private mapToCustomer(row: Customer): Customer {
    return {
      customerId: row.customerId,
      name: row.name,
      email: row.email,
      gender: row.gender,
      country: row.country,
      signupDate: row.signupDate,
    };
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
      if (err.code === '23505') {
        throw new AppError('Email already in use', 409, 'EMAIL_CONFLICT');
      }
      throw new AppError(`Database error: ${err.message}`, 500, 'DB_ERROR');
    }
    throw err as Error; // Narrow to Error since we can't throw unknown easily
  }
}
