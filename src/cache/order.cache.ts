import { redis } from '../config/redis';
import { PaginatedOrders, OrderWithCustomer } from '../models/Order';
import { OrderFilters } from '../interfaces/IOrderRepository';
import { createHash } from 'crypto';

function hashFilters(filters?: OrderFilters): string {
  if (!filters || Object.keys(filters).length === 0) return 'all';
  return createHash('md5').update(JSON.stringify(filters)).digest('hex');
}

const CACHE_KEY = {
  paginatedOrders: (page: number, limit: number, filters?: OrderFilters) => `orders:page:${page}:limit:${limit}:filters:${hashFilters(filters)}`,
  orderById: (id: number) => `orders:${id}`,
} as const;

export async function getCachedOrders(page: number, limit: number, filters?: OrderFilters): Promise<PaginatedOrders | null> {
  try {
    const cached = await redis.get(CACHE_KEY.paginatedOrders(page, limit, filters));
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

export async function setCachedOrders(page: number, limit: number, orders: PaginatedOrders, ttlSeconds: number, filters?: OrderFilters): Promise<void> {
  try {
    await redis.setex(CACHE_KEY.paginatedOrders(page, limit, filters), ttlSeconds, JSON.stringify(orders));
  } catch (err) {
    console.error('[Redis] setCachedOrders failed:', err);
  }
}

export async function invalidateCachedOrders(page: number, limit: number, filters?: OrderFilters): Promise<void> {
  try {
    await redis.del(CACHE_KEY.paginatedOrders(page, limit, filters));
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

export async function getCachedOrder(id: number): Promise<OrderWithCustomer | null> {
  try {
    const cached = await redis.get(CACHE_KEY.orderById(id));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as OrderWithCustomer;
    return { ...parsed, orderDate: new Date(parsed.orderDate) };
  } catch (err) {
    console.error('[Redis] getCachedOrder failed:', err);
    return null;
  }
}

export async function setCachedOrder(id: number, order: OrderWithCustomer, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(CACHE_KEY.orderById(id), ttlSeconds, JSON.stringify(order));
  } catch (err) {
    console.error('[Redis] setCachedOrder failed:', err);
  }
}