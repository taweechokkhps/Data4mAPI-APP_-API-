import Redis from 'ioredis';
import { env } from './env';

export const redis = process.env.NODE_ENV === 'test' 
  ? new Redis({ lazyConnect: true })
  : new Redis(env.REDIS_URL);
