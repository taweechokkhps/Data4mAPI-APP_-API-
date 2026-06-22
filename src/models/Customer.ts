export interface OrderSummary {
  orderId: number;
  orderDate: Date;
  totalAmount: number;
  paymentMethod: string;
  shippingCountry: string;
}

export interface Customer {
  customerId: number;
  name: string;
  email: string;
  gender: string;
  country: string;
  signupDate: Date;
}

export interface CustomerWithOrders extends Customer {
  orders: OrderSummary[];
}

export interface PaginatedCustomers {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCustomerDto {
  name: string;
  email: string;
  gender: string;
  country: string;
}
