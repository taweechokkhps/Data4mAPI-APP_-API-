export interface OrderWithCustomer {
  orderId: number;
  customerId: number;
  customerName: string;
  orderDate: Date;
  totalAmount: number;
  paymentMethod: string;
  shippingCountry: string;
}

export interface PaginatedOrders {
  data: OrderWithCustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateOrderDto {
  customerId: number;
  totalAmount: number;
  paymentMethod: string;
  shippingCountry: string;
}
