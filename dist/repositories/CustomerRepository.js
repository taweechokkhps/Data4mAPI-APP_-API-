"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerRepository = void 0;
const pg_1 = require("pg");
const db_1 = require("../config/db");
const AppError_1 = require("../utils/AppError");
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
class CustomerRepository {
    async getByIdWithOrders(id) {
        try {
            const result = await db_1.pool.query(GET_CUSTOMER_ORDERS_QUERY, [id]);
            if (result.rowCount === 0)
                return null;
            return this.mapToDomain(result.rows[0]);
        }
        catch (err) {
            this.handleDbError(err);
        }
    }
    mapToDomain(row) {
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
    handleDbError(err) {
        if (err instanceof pg_1.DatabaseError) {
            throw new AppError_1.AppError(`Database error: ${err.message}`, 500, 'DB_ERROR');
        }
        throw err; // Narrow to Error since we can't throw unknown easily
    }
}
exports.CustomerRepository = CustomerRepository;
