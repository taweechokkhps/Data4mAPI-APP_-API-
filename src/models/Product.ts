export interface Product {
  productId: number;
  productName: string;
  category: string;
  brand: string;
  price: number;
  stockQuantity: number;
}

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductDto {
  productName: string;
  category: string;
  brand: string;
  price: number;
  stockQuantity: number;
}

export interface ProductReview {
  reviewId: number;
  rating: number;
  reviewText: string;
  reviewDate: Date;
  productId: number;
  productName: string;
  customerId: number;
  customerName: string;
  customerCountry: string;
}

export interface PaginatedProductReviews {
  data: ProductReview[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
