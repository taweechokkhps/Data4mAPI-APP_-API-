import { redis } from '../config/redis';
import { Product, PaginatedProducts, PaginatedProductReviews } from '../models/Product';

const CACHE_KEY = {
  paginatedProducts: (page: number, limit: number) => `products:page:${page}:limit:${limit}`,
  productById: (id: number) => `products:${id}`,
  productReviews: (productId: number, page: number, limit: number) => `products:${productId}:reviews:page:${page}:limit:${limit}`,
} as const;

export async function getCachedProducts(page: number, limit: number): Promise<PaginatedProducts | null> {
  try {
    const cached = await redis.get(CACHE_KEY.paginatedProducts(page, limit));
    if (!cached) return null;
    return JSON.parse(cached) as PaginatedProducts;
  } catch (err) {
    console.error('[Redis] getCachedProducts failed:', err);
    return null; // Graceful degradation to DB
  }
}

export async function setCachedProducts(page: number, limit: number, products: PaginatedProducts, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(CACHE_KEY.paginatedProducts(page, limit), ttlSeconds, JSON.stringify(products));
  } catch (err) {
    console.error('[Redis] setCachedProducts failed:', err);
  }
}

export async function invalidateAllCachedProducts(): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH', 'products:page:*',
        'COUNT', '100'
      );
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      cursor = nextCursor;
    } while (cursor !== '0');
  } catch (err) {
    console.error('[Redis] invalidateAllCachedProducts failed:', err);
  }
}

export async function getCachedProduct(id: number): Promise<Product | null> {
  try {
    const cached = await redis.get(CACHE_KEY.productById(id));
    if (!cached) return null;
    return JSON.parse(cached) as Product;
  } catch (err) {
    console.error('[Redis] getCachedProduct failed:', err);
    return null;
  }
}

export async function setCachedProduct(id: number, product: Product, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(CACHE_KEY.productById(id), ttlSeconds, JSON.stringify(product));
  } catch (err) {
    console.error('[Redis] setCachedProduct failed:', err);
  }
}

export async function invalidateCachedProduct(id: number): Promise<void> {
  try {
    await redis.del(CACHE_KEY.productById(id));
  } catch (err) {
    console.error('[Redis] invalidateCachedProduct failed:', err);
  }
}

export async function getCachedProductReviews(productId: number, page: number, limit: number): Promise<PaginatedProductReviews | null> {
  try {
    const cached = await redis.get(CACHE_KEY.productReviews(productId, page, limit));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as PaginatedProductReviews;
    if (parsed.data && Array.isArray(parsed.data)) {
      parsed.data = parsed.data.map((r: any) => ({
        ...r,
        reviewDate: new Date(r.reviewDate)
      }));
    }
    return parsed;
  } catch (err) {
    console.error('[Redis] getCachedProductReviews failed:', err);
    return null;
  }
}

export async function setCachedProductReviews(productId: number, page: number, limit: number, reviews: PaginatedProductReviews, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(CACHE_KEY.productReviews(productId, page, limit), ttlSeconds, JSON.stringify(reviews));
  } catch (err) {
    console.error('[Redis] setCachedProductReviews failed:', err);
  }
}
