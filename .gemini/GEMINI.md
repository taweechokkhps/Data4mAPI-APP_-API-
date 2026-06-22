# Project Brief: Node.js Express REST API (Clean Architecture)

## 1. Tech Stack & Runtime

* Runtime: Node.js (v20+ LTS)
* Framework: Express.js (v4.x)
* Language: TypeScript (v5.x), strict mode enabled
* Package Manager: npm
* Database: PostgreSQL (v16+)
* Database Driver: `pg` (node-postgres) + `pg-pool` for connection pooling

---

## 2. Clean Architecture (Modular Structure)

This architecture enforces a strict separation of concerns to ensure maintainability and scalability:

```
/root
  ├── config/           # Environment config, DB connection pool
  ├── controllers/      # Parameter extraction + call Services only
  ├── interfaces/       # Repository interfaces (IUserRepository, etc.)
  ├── middleware/        # Auth, validation, errorHandler
  ├── models/           # TypeScript type/interface definitions (domain models)
  ├── repositories/     # Raw SQL implementations using pg
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

**Database:**
* ❌ Do NOT use string interpolation in SQL — always use parameterized queries (`$1`, `$2`, ...)
* ❌ Do NOT return raw `pg` `QueryResult` objects — map to domain types before returning
* ❌ Do NOT hardcode secrets or connection strings — load from `src/config/env.ts`

**Clean Code:**
* ❌ Do NOT use the `any` type — use `unknown` and narrow explicitly
* ❌ Do NOT skip Zod validation even for optional fields
* ❌ Do NOT write functions longer than 20 lines — extract into smaller named functions
* ❌ Do NOT use boolean parameters — split into separate functions instead
* ❌ Do NOT use abbreviations in names (`usr`, `cfg`, `d`) — write the full word
* ❌ Do NOT leave comments that explain *what* the code does — rename until the code explains itself