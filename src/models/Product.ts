export interface Product {
  productId: number;
  name: string;
  description: string;
  price: number;
  stockCount: number;
  createdAt: Date;
}

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  stockCount: number;
}
