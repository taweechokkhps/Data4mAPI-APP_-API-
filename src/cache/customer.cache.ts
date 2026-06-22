import { redis } from '../config/redis';
import { CustomerWithOrders, PaginatedCustomers, Customer } from '../models/Customer';

const CACHE_KEY = {
  customerById: (id: number) => `customers:${id}`,
  paginatedCustomers: (page: number, limit: number) => `customers:page:${page}:limit:${limit}`,
} as const;

export async function getCachedCustomer(id: number): Promise<CustomerWithOrders | null> {
  try {
    const cached = await redis.get(CACHE_KEY.customerById(id));
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('[Redis] getCachedCustomer failed:', err);
    return null; // Graceful degradation to DB
  }
}

export async function setCachedCustomer(id: number, customer: CustomerWithOrders, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(CACHE_KEY.customerById(id), ttlSeconds, JSON.stringify(customer));
  } catch (err) {
    console.error('[Redis] setCachedCustomer failed:', err);
  }
}

export async function invalidateCachedCustomer(id: number): Promise<void> {
  try {
    await redis.del(CACHE_KEY.customerById(id));
  } catch (err) {
    console.error('[Redis] invalidateCachedCustomer failed:', err);
  }
}

export async function getCachedCustomers(page: number, limit: number): Promise<PaginatedCustomers | null> {
  try {
    const cached = await redis.get(CACHE_KEY.paginatedCustomers(page, limit));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as PaginatedCustomers;
    if (parsed.data && Array.isArray(parsed.data)) {
      parsed.data = parsed.data.map((c: Customer) => ({
        ...c,
        signupDate: new Date(c.signupDate)
      }));
    }
    return parsed;
  } catch (err) {
    console.error('[Redis] getCachedCustomers failed:', err);
    return null;
  }
}

export async function setCachedCustomers(page: number, limit: number, customers: PaginatedCustomers, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(CACHE_KEY.paginatedCustomers(page, limit), ttlSeconds, JSON.stringify(customers));
  } catch (err) {
    console.error('[Redis] setCachedCustomers failed:', err);
  }
}

export async function invalidateAllCachedCustomers(): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'customers:page:*', 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error('[Redis] invalidateAllCachedCustomers failed:', err);
  }
}
