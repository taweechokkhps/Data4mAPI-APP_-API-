import { redis } from '../config/redis';
import { Product, PaginatedProducts } from '../models/Product';

const CACHE_KEY = {
  paginatedProducts: (page: number, limit: number) => `products:page:${page}:limit:${limit}`,
  productById: (id: number) => `products:${id}`,
} as const;

export async function getCachedProducts(page: number, limit: number): Promise<PaginatedProducts | null> {
  try {
    const cached = await redis.get(CACHE_KEY.paginatedProducts(page, limit));
    if (!cached) return null;
    
    const parsed = JSON.parse(cached) as PaginatedProducts;
    if (parsed.data && Array.isArray(parsed.data)) {
      parsed.data = parsed.data.map((p: Product) => ({
        ...p,
        createdAt: new Date(p.createdAt)
      }));
    }
    return parsed;
  } catch (err) {
    console.error('[Redis] getCachedProducts failed:', err);
    return null;
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
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'products:page:*', 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error('[Redis] invalidateAllCachedProducts failed:', err);
  }
}

export async function getCachedProduct(id: number): Promise<Product | null> {
  try {
    const cached = await redis.get(CACHE_KEY.productById(id));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as Product;
    return { ...parsed, createdAt: new Date(parsed.createdAt) };
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
