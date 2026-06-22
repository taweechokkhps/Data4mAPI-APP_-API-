export interface OrderSummary {
  orderId: number;
  orderDate: Date;
  totalAmount: number;
  paymentMethod: string;
  shippingCountry: string;
}

export interface CustomerWithOrders {
  customerId: number;
  name: string;
  email: string;
  gender: string;
  country: string;
  signupDate: Date;
  orders: OrderSummary[];
}
