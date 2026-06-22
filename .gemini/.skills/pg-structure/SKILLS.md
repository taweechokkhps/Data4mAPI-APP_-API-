# Database Schema & Relationships

This project uses PostgreSQL. Below is the relational structure of the database. When writing queries or services, adhere strictly to these schemas.

## Schema Definitions

### 1. Customers
- `customer_id` (PK, INTEGER)
- `name`, `email`, `gender` (TEXT)
- `signup_date` (DATE)
- `country` (TEXT)

### 2. Products
- `product_id` (PK, INTEGER)
- `product_name`, `category`, `brand` (TEXT)
- `price` (NUMERIC(10,2))
- `stock_quantity` (INTEGER)

### 3. Orders
- `order_id` (PK, INTEGER)
- `customer_id` (FK -> customers)
- `order_date` (DATE)
- `total_amount` (NUMERIC(10,2))
- `payment_method`, `shipping_country` (TEXT)

### 4. Order Items
- `order_item_id` (PK, INTEGER)
- `order_id` (FK -> orders)
- `product_id` (FK -> products)
- `quantity` (INTEGER)
- `unit_price` (NUMERIC(10,2))

### 5. Product Reviews
- `review_id` (PK, INTEGER)
- `product_id` (FK -> products)
- `customer_id` (FK -> customers)
- `rating` (INTEGER)
- `review_text` (TEXT)
- `review_date` (DATE)

## Relationship Rules
- Use `JOIN` operations based on the Foreign Key (FK) definitions above.
- Always prefer `JOIN` over subqueries for performance on large datasets.
- Ensure all queries are type-safe and align with these table structures.