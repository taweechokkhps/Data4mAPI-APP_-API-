import { redis } from '../config/redis';
import { CustomerWithOrders } from '../models/Customer';

const CACHE_KEY = {
  customerById: (id: number) => `customers:${id}`,
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
