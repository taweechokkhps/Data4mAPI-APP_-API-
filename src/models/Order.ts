export interface OrderWithCustomer {
  orderId: number;
  customerId: number;
  customerName: string;
  orderDate: Date;
  totalAmount: number;
  paymentMethod: string;
  shippingCountry: string;
}
