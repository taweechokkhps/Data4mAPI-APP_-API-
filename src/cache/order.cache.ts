import { redis } from '../config/redis';
import { PaginatedOrders, OrderWithCustomer } from '../models/Order';

const CACHE_KEY = {
  paginatedOrders: (page: number, limit: number) => `orders:page:${page}:limit:${limit}`,
} as const;

export async function getCachedOrders(page: number, limit: number): Promise<PaginatedOrders | null> {
  try {
    const cached = await redis.get(CACHE_KEY.paginatedOrders(page, limit));
    if (!cached) return null;
    
    const parsed = JSON.parse(cached) as PaginatedOrders;
    
    if (parsed.data && Array.isArray(parsed.data)) {
      parsed.data = parsed.data.map((order: OrderWithCustomer) => ({
        ...order,
        orderDate: new Date(order.orderDate)
      }));
    }
    
    return parsed;
  } catch (err) {
    console.error('[Redis] getCachedOrders failed:', err);
    return null; // Graceful degradation to DB
  }
}

export async function setCachedOrders(page: number, limit: number, orders: PaginatedOrders, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(CACHE_KEY.paginatedOrders(page, limit), ttlSeconds, JSON.stringify(orders));
  } catch (err) {
    console.error('[Redis] setCachedOrders failed:', err);
  }
}

export async function invalidateCachedOrders(page: number, limit: number): Promise<void> {
  try {
    await redis.del(CACHE_KEY.paginatedOrders(page, limit));
  } catch (err) {
    console.error('[Redis] invalidateCachedOrders failed:', err);
  }
}

export async function invalidateAllCachedOrders(): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH', 'orders:page:*',
        'COUNT', '100'
      );
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      cursor = nextCursor;
    } while (cursor !== '0');
  } catch (err) {
    console.error('[Redis] invalidateAllCachedOrders failed:', err);
  }
}