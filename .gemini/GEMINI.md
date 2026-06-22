# Project Brief: Node.js Express REST API (Clean Architecture)

## 1. Tech Stack & Runtime

* Runtime: Node.js (v20+ LTS)
* Framework: Express.js (v4.x)
* Language: TypeScript (v5.x), strict mode enabled
* Package Manager: npm
* Database: PostgreSQL (v16+)
* Database Driver: `pg` (node-postgres) + `pg-pool` for connection pooling
* Cache: Redis (v7+) via `ioredis`

---

## 2. Clean Architecture (Modular Structure)

This architecture enforces a strict separation of concerns to ensure maintainability and scalability:

```
/root
  ├── config/           # Environment config, DB connection pool, Redis client
  ├── controllers/      # Parameter extraction + call Services only
  ├── interfaces/       # Repository interfaces (IUserRepository, etc.)
  ├── middleware/        # Auth, validation, errorHandler
  ├── models/           # TypeScript type/interface definitions (domain models)
  ├── repositories/     # Raw SQL implementations using pg
  ├── cache/            # Redis cache helpers (get, set, invalidate)
  ├── routes/           # Express routers
  ├── services/         # Business logic
  ├── utils/            # AppError, helpers
  ├── tests/            # Unit + integration tests
  └── public/           # Static assets
```

---

## 3. Architecture & Code Conventions

* **Dependency Injection:** Services must never import a repository directly. Inject via constructor using the repository's interface.
* **Repository Interface:** Every repository must have a corresponding interface (e.g., `IUserRepository`) defined in `src/interfaces/`. Services depend on the interface, not the concrete class.
* **Business Logic:** Logic must never reside in Controllers or Routes. Controllers are strictly for parameter extraction and calling Services.
* **Asynchronous Code:** Use `async/await` exclusively. Do not use callbacks or raw `.then()/.catch()` chains.
* **No `any` type:** Use `unknown` and narrow types explicitly. Enable `strict: true` and `noImplicitAny: true` in `tsconfig.json`.

### Database Connection Pool

Define a single shared pool in `src/config/db.ts` and import it into repositories:

```typescript
// src/config/db.ts
import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});
```

### Redis Cache Client

Define a single shared Redis client in `src/config/redis.ts` and import it into cache helpers only — never directly in Services or Repositories.

```typescript
// src/config/redis.ts
import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL);
```

Add `REDIS_URL` to `src/config/env.ts` Zod schema alongside `DATABASE_URL`.

---

## 3.5 Caching Strategy (Cache-Aside Pattern)

All caching follows the **Cache-Aside** pattern. The Service layer owns the caching logic by calling helper functions from `src/cache/`. Repositories must never interact with Redis directly.

### Cache-Aside Flow

```
Request
  │
  ▼
Service calls cache helper
  │
  ├─ Cache HIT  → return data from Redis immediately (< 5ms)
  │
  └─ Cache MISS → query PostgreSQL → store result in Redis with TTL → return data
```

### Cache Helper Convention

All Redis operations are wrapped in helper functions inside `src/cache/[resource].cache.ts`. This keeps Redis logic isolated and mockable in tests.

```typescript
// src/cache/order.cache.ts
import { redis } from '../config/redis';

const CACHE_KEY = {
  orderCount: () => 'orders:total_count',
  orderById: (id: number) => `orders:${id}`,
} as const;

export async function getCachedOrderCount(): Promise<number | null> {
  const cached = await redis.get(CACHE_KEY.orderCount());
  if (!cached) return null;
  return parseInt(cached, 10);
}

export async function setCachedOrderCount(count: number, ttlSeconds: number): Promise<void> {
  await redis.setex(CACHE_KEY.orderCount(), ttlSeconds, count.toString());
}

export async function invalidateOrderCount(): Promise<void> {
  await redis.del(CACHE_KEY.orderCount());
}
```

### Cache-Aside in the Service Layer

```typescript
// src/services/order.service.ts
import { getCachedOrderCount, setCachedOrderCount } from '../cache/order.cache';

const ORDER_COUNT_TTL_SECONDS = 3600; // 1 hour

async getTotalOrderCount(): Promise<number> {
  // 1. Cache HIT — return immediately, no DB query
  const cached = await getCachedOrderCount();
  if (cached !== null) return cached;

  // 2. Cache MISS — query PostgreSQL
  const count = await this.orderRepository.countAll();

  // 3. Store in Redis with TTL to prevent stale data
  await setCachedOrderCount(count, ORDER_COUNT_TTL_SECONDS);

  return count;
}
```

### TTL Guidelines

TTL prevents **Data Inconsistency** — when data changes in PostgreSQL but Redis still holds the old value. Set TTL according to how frequently data changes and how much staleness is acceptable.

| Data Type | Recommended TTL | Reason |
|---|---|---|
| Aggregate counts (orders, users) | `3600s` (1 hour) | Changes frequently; minor staleness is acceptable |
| User profile | `1800s` (30 min) | Changed occasionally; short TTL keeps data fresh |
| Static / config data | `86400s` (24 hours) | Rarely changes |
| Realtime data (stock, live status) | Do NOT cache | Stale data is unacceptable |

### Cache Invalidation

When data is **mutated** (create, update, delete), always invalidate the related cache key immediately — do not wait for TTL to expire.

```typescript
// src/services/order.service.ts
async createOrder(data: CreateOrderDto): Promise<Order> {
  const order = await this.orderRepository.create(data);

  // Invalidate count cache so next read reflects the new total
  await invalidateOrderCount();

  return order;
}
```

**Rule:** Every write operation in a Service must invalidate all related cache keys before returning.

### Redis Error Handling

Redis failures must **never crash the application**. Cache is a performance layer — a Redis outage should degrade gracefully by falling back to PostgreSQL.

```typescript
// src/cache/order.cache.ts
export async function getCachedOrderCount(): Promise<number | null> {
  try {
    const cached = await redis.get(CACHE_KEY.orderCount());
    return cached ? parseInt(cached, 10) : null;
  } catch (err) {
    // Log the Redis error but do not throw — let the caller fall through to DB
    console.error('[Redis] getCachedOrderCount failed:', err);
    return null; // Treated as Cache MISS
  }
}
```

**Redis error codes to be aware of:**

| Scenario | Behavior |
|---|---|
| Redis connection lost | Return `null` (Cache MISS) — Service falls back to PostgreSQL |
| Key expired (TTL hit) | `redis.get()` returns `null` — normal Cache MISS flow |
| `setex` fails | Log error, continue — data is still returned from DB |


### Raw SQL Convention

All queries live inside Repository classes. Always use parameterized queries — never string interpolation.

```typescript
// ✅ CORRECT — parameterized query
const result = await pool.query<User>(
  'SELECT * FROM users WHERE id = $1',
  [id]
);

// ❌ WRONG — SQL injection risk
const result = await pool.query(`SELECT * FROM users WHERE id = ${id}`);
```

Map `result.rows` explicitly to the domain type — never return raw `QueryResult` to Services or Controllers.

### Consistent Response Format

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": { "message": "...", "code": "..." } }
```

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Utility files | `camelCase.ts` | `hashPassword.ts` |
| Classes / Models | `PascalCase.ts` | `UserService.ts` |
| Routes | `[resource].routes.ts` | `user.routes.ts` |
| Controllers | `[resource].controller.ts` | `user.controller.ts` |
| Services | `[resource].service.ts` | `user.service.ts` |
| Repositories | `[resource].repository.ts` | `user.repository.ts` |
| Interfaces | `I[Resource]Repository.ts` | `IUserRepository.ts` |

**Variables & Functions:**
* Boolean variables must use a predicate prefix: `isActive`, `hasPermission`, `canDelete`
* Functions must use a verb prefix that describes the action: `getUser`, `createOrder`, `validateEmail`
* Avoid abbreviations — `usr`, `req` (outside Express context), `cfg` are not allowed; write the full word
* Constants (non-primitive) use `SCREAMING_SNAKE_CASE`: `MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE`

**Functions & Methods (Clean Code):**
* One function = one responsibility. If a function needs a comment to explain what it does, it should be split
* Maximum function length: **20 lines**. If longer, extract into smaller named functions
* Maximum parameters: **3**. If more are needed, group into an object type
* Avoid boolean parameters — they are a sign that the function does two things:

```typescript
// ❌ WRONG — boolean flag signals two responsibilities
function getUsers(includeDeleted: boolean) { ... }

// ✅ CORRECT — separate functions with clear intent
function getActiveUsers() { ... }
function getAllUsersIncludingDeleted() { ... }
```

**Variables:**
* Use meaningful names that reveal intent. The name should answer: what does this hold, and why does it exist?

```typescript
// ❌ WRONG
const d = 86400;
const list = await repo.find();

// ✅ CORRECT
const SECONDS_PER_DAY = 86400;
const activeUsers = await userRepo.findAllActive();
```

---

## 4. Error Handling Strategy

* **Custom Error Class:** Always throw instances of `AppError` (defined in `src/utils/AppError.ts`) with `message`, `statusCode`, and `code` fields. Never throw a plain `new Error()`.
* **No Manual Catch:** Do not use `try/catch` in Controllers to return 500 status codes.
* **Error Propagation:** Always use `next(error)` to forward errors to the middleware chain.
* **Centralized Handler:** The global error middleware at `src/middleware/errorHandler.ts` is the single point for formatting all error responses.

```typescript
// src/utils/AppError.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
  }
}
```

### HTTP Status Code Convention

Use the correct HTTP status code for every scenario — never return 200 for an error.

| Scenario | Status Code |
|---|---|
| Success (read) | `200 OK` |
| Success (created) | `201 Created` |
| Success (no content) | `204 No Content` |
| Validation failed (bad input) | `400 Bad Request` |
| Missing or invalid token | `401 Unauthorized` |
| Valid token but no permission | `403 Forbidden` |
| Resource not found | `404 Not Found` |
| Duplicate / conflict (e.g. email exists) | `409 Conflict` |
| Unhandled server error | `500 Internal Server Error` |

Throw with the correct code at the point of failure:

```typescript
// ✅ Correct usage in Service
if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
if (emailExists) throw new AppError('Email already in use', 409, 'EMAIL_CONFLICT');
```

### Async Error in Express

Express 4.x does **not** catch async errors automatically. Wrap every async controller with `asyncHandler` to ensure unhandled promise rejections are forwarded to `next(error)`.

```typescript
// src/utils/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const asyncHandler = (fn: AsyncFn) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
```

```typescript
// src/controllers/user.controller.ts
import { asyncHandler } from '../utils/asyncHandler';

export const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getById(Number(req.params.id));
  res.json({ success: true, data: user });
});
// No try/catch needed — errors propagate to errorHandler automatically
```

### Validation Error Format

Zod validation errors must be caught in middleware and normalized to the standard error format before reaching the client. Never expose raw Zod error objects.

```typescript
// src/middleware/validateRequest.ts
import { ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      // Attach details via a ValidationError subclass if field-level errors are needed
    }
    req.body = result.data;
    next();
  };
```

Validation error response shape:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "age", "message": "Expected number, received string" }
    ]
  }
}
```

### PostgreSQL / pg Error Handling

`pg` throws errors with a `code` property (PostgreSQL error codes). Catch and translate known codes in the Repository layer — never let raw `pg` errors bubble up to the client.

```typescript
// src/repositories/user.repository.ts
import { DatabaseError } from 'pg';

async create(data: CreateUserDto): Promise<User> {
  try {
    const result = await pool.query<User>(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [data.email, data.name]
    );
    return result.rows[0];
  } catch (err) {
    if (err instanceof DatabaseError) {
      // 23505 = unique_violation (duplicate key)
      if (err.code === '23505') {
        throw new AppError('Email already in use', 409, 'EMAIL_CONFLICT');
      }
      // 23503 = foreign_key_violation
      if (err.code === '23503') {
        throw new AppError('Referenced resource does not exist', 400, 'FOREIGN_KEY_ERROR');
      }
    }
    throw err; // Re-throw unknown errors — errorHandler will catch as 500
  }
}
```

**Common PostgreSQL error codes to handle:**

| pg Code | Meaning | Suggested AppError |
|---|---|---|
| `23505` | Unique violation (duplicate) | `409 CONFLICT` |
| `23503` | Foreign key violation | `400 FOREIGN_KEY_ERROR` |
| `23502` | Not null violation | `400 VALIDATION_ERROR` |
| `42P01` | Undefined table | `500 DB_ERROR` (log + alert) |

### Centralized errorHandler

```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, code: err.code },
    });
  }

  // Unknown error — do not leak details to client
  console.error('[Unhandled Error]', err);
  return res.status(500).json({
    success: false,
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
  });
};
```

---

## 5. Validation & Security

* **Strict Validation:** Use Zod to validate all `req.body`, `req.query`, and `req.params` before execution — including optional fields.
* **Secrets Management:** Use `dotenv` combined with Zod in `src/config/env.ts` to ensure all required environment variables are present and valid at startup.
* **Database Credentials:** Never hardcode connection strings. Always load `DATABASE_URL` via `src/config/env.ts`.
* **SQL Injection:** Always use parameterized queries (`$1`, `$2`, ...). Never concatenate user input into SQL strings.

---

## 6. Testing (TDD Policy)

**Golden Rule:** No new feature (Route or Service) shall be merged without a corresponding test file.

* **Test Framework:** Jest + Supertest
* **Mocking:** Use `jest.mock()` to mock repository interfaces. Never mock Services in controller tests.
* **Coverage Threshold:** Minimum 80% coverage enforced via Jest config.
* **Test Policy:** Every new feature must follow the Red-Green-Refactor methodology.

```typescript
// Mock example — inject mock repository into Service
const mockUserRepo: IUserRepository = {
  findById: jest.fn().mockResolvedValue({ id: 1, email: 'test@example.com' }),
  create: jest.fn(),
};
const userService = new UserService(mockUserRepo);
```

---

## 7. Development Workflow

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Run development server |
| `npm test` | Execute test suite (must pass 100% to proceed) |
| `npm run lint && npm run format` | Enforce coding standards before commit |
| `npm run build` | Build production bundle (runs tests automatically via `prebuild` hook) |

> Schema migrations are managed manually via `.sql` files in `src/migrations/` and run with `psql` or a migration tool such as `db-migrate`.

---

---

## 3.6 Performance & Complexity (Big-O Awareness)

Before implementing any function, query, or cache strategy, reason about its time and space complexity. The goal is not to over-engineer, but to avoid obviously expensive patterns that will hurt at scale.

**Rule: Always ask before writing code — "What happens when this runs on 1 million rows?"**

### Complexity Targets by Layer

| Layer | Target | Hard Limit |
|---|---|---|
| Redis cache lookup | O(1) | — |
| Repository (single record) | O(1) via index | Never O(N) full scan |
| Repository (list/filter) | O(log N) with index | Avoid O(N) without WHERE index |
| Service logic | O(N) acceptable | Avoid O(N²) — refactor or cache |
| Cache invalidation (multi-key) | O(N/batch) via SCAN | Never `KEYS *` — blocks Redis |

### SQL — Avoid N+1 and Full Table Scans

```typescript
// ❌ WRONG — O(N) queries inside a loop (N+1 problem)
const orders = await orderRepo.findAll();
for (const order of orders) {
  order.user = await userRepo.findById(order.userId); // 1 query per row
}

// ✅ CORRECT — O(1) queries with JOIN, fetch everything at once
const orders = await orderRepo.findAllWithUsers(); // single JOIN query
```

Always add a database index on columns used in `WHERE`, `JOIN`, or `ORDER BY`. A missing index turns O(log N) into O(N).

### Service Layer — Avoid Nested Loops on Large Data

```typescript
// ❌ WRONG — O(N²): comparing every item against every other item
for (const a of items) {
  for (const b of items) { ... }
}

// ✅ CORRECT — O(N): use a Map/Set for O(1) lookup
const itemMap = new Map(items.map(i => [i.id, i]));
for (const a of items) {
  const match = itemMap.get(a.relatedId); // O(1)
}
```

### Redis — Key Design Affects Lookup Cost

All cache keys must resolve in O(1). Avoid patterns that require scanning all keys to find one record.

```typescript
// ❌ WRONG — requires SCAN to find a user's data (O(N))
redis.set(`cache:${Date.now()}:user`, data);

// ✅ CORRECT — deterministic key, O(1) lookup
redis.setex(`users:${userId}`, TTL, data);
```

Use `SCAN` with a specific `MATCH` pattern when bulk invalidation is needed — never `KEYS *`.


## 8. Anti-patterns (Never Do)

**Architecture:**
* ❌ Do NOT import a Repository class directly inside a Service — inject via constructor with its interface
* ❌ Do NOT write SQL queries inside Services — delegate to the Repository layer
* ❌ Do NOT put business logic in Controllers or Routes

**Error Handling:**
* ❌ Do NOT use `try/catch` in Controllers to return error responses — use `next(error)`
* ❌ Do NOT throw `new Error()` — always throw `new AppError(message, statusCode, code)`
* ❌ Do NOT return raw `pg` `DatabaseError` or raw database errors to the client — translate in the Repository layer
* ❌ Do NOT return `200 OK` for error responses — use the correct HTTP status code
* ❌ Do NOT expose raw Zod error objects — normalize to the standard error format

**Cache (Redis):**
* ❌ Do NOT call Redis directly inside Services or Repositories — use cache helper functions in `src/cache/`
* ❌ Do NOT cache data without a TTL — always use `setex`, never `set` alone
* ❌ Do NOT ignore Redis errors — catch and log, then fall back to PostgreSQL gracefully
* ❌ Do NOT forget to invalidate cache on write operations (create, update, delete)
* ❌ Do NOT use arbitrary string keys — define all cache keys in a `CACHE_KEY` constant object inside the cache helper file

**Database:**
* ❌ Do NOT use string interpolation in SQL — always use parameterized queries (`$1`, `$2`, ...)
* ❌ Do NOT return raw `pg` `QueryResult` objects — map to domain types before returning
* ❌ Do NOT hardcode secrets or connection strings — load from `src/config/env.ts`

**Performance (Big-O):**
* ❌ Do NOT write nested loops over large datasets — use Map/Set for O(1) lookup instead
* ❌ Do NOT query inside a loop — use JOIN or batch fetch (N+1 problem)
* ❌ Do NOT use `KEYS *` in Redis — always use `SCAN` with a `MATCH` pattern
* ❌ Do NOT filter/sort large datasets in JavaScript — push it to SQL with indexes
* ❌ Do NOT skip index design — every `WHERE` and `JOIN` column must have an index

**Clean Code:**
* ❌ Do NOT use the `any` type — use `unknown` and narrow explicitly
* ❌ Do NOT skip Zod validation even for optional fields
* ❌ Do NOT write functions longer than 20 lines — extract into smaller named functions
* ❌ Do NOT use boolean parameters — split into separate functions instead
* ❌ Do NOT use abbreviations in names (`usr`, `cfg`, `d`) — write the full word
* ❌ Do NOT leave comments that explain *what* the code does — rename until the code explains itself