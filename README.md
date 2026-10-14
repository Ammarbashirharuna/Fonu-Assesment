# Stockly: Inventory & Orders Service

A small but complete full-stack app: a **NestJS** REST API on **PostgreSQL**, a **React + TypeScript** storefront with an admin console, and a standalone **Go (Gin)** reporting microservice.

> API base path: `/api/v1`

## Architecture

```
React (Vite, TanStack Query)  ──►  NestJS API  ──►  PostgreSQL
                                       │
                                       └──►  Go/Gin reporting service (internal only)
```

| Folder | What it is |
|---|---|
| `backend/` | NestJS + TypeORM, JWT auth, RBAC, orders with transactional stock reservation, migrations, tests |
| `frontend/` | React + TS, shop, persistent cart, order history, admin products/orders/insights |
| `reporting-go/` | Stateless Gin service: order summary (count, revenue, AOV, status split, top products) |

## Quick start (Docker)
Requires Docker with Compose v2. **No other setup and no `.env` file needed.**

```bash
git clone https://github.com/Ammarbashirharuna/Fonu-Assesment.git && cd Fonu-Assesment
docker compose up --build
```

The first build takes a few minutes. When the logs show `Nest application successfully started`, open:

| What | URL | Credentials |
|---|---|---|
| Storefront | http://localhost:8088 | Register a customer on the login page |
| Admin console | http://localhost:8088/admin/login | `admin@example.com` / `Admin12345` |
| API | http://localhost:3000/api/v1 | JWT from the login endpoints |

These are **demo credentials and secrets**, set as defaults in `docker-compose.yml` for easy review. Override any of them by copying `.env.example` to `.env`.

On start the API container applies migrations, seeds the admin and a small demo catalogue (both idempotent: only when missing), then boots. The Go service is not published to the host; only the API can reach it. Stop with `Ctrl+C`; wipe all data with `docker compose down -v`. If a port is taken, set `FRONTEND_PORT` or `POSTGRES_PORT` in `.env`.

**What to try:** register a customer, add products to the cart, place an order, cancel it and watch stock return. Then sign in as admin: add and edit products, confirm orders, and open **Insights** (computed by the Go service).

## How the brief is covered

| Requirement | Where |
|---|---|
| REST API for products and orders (CRUD) | `backend/src/products`, `backend/src/orders` |
| PostgreSQL, schema, migrations | `backend/src/database/migrations` (`synchronize: false`) |
| JWT with admin and customer roles | `backend/src/auth` (`JwtAuthGuard`, `RolesGuard`, `@Roles()`) |
| Validation and error handling | global `ValidationPipe` + `AllExceptionsFilter` |
| Browse, order, history UI | `frontend/src/pages` (Shop, Cart, Orders) |
| Admin: add/edit products, incoming orders | Products modal, All orders (confirm, cancel, delete) |
| State management and API error handling | TanStack Query, axios interceptor, toasts |
| Go microservice | `reporting-go/`, called by `GET /reports/summary` |
| Backend tests for the order flow | `backend/src/orders/orders.service.spec.ts`, `backend/test/orders.e2e-spec.ts` |

## Local development
```bash
docker compose up -d postgres                        # database only (host port 5433)

cd backend && cp .env.example .env && npm ci
npm run migration:run && npm run seed && npm run start:dev    # :3000

cd ../reporting-go && INTERNAL_API_KEY=devkey go run .         # :8090

cd ../frontend && cp .env.example .env && npm ci && npm run dev    # :5173
```

In `backend/.env`, set `REPORTING_URL=http://localhost:8090` and `REPORTING_API_KEY=devkey` (it must match the Go service key).

## Configuration

| Variable | Used by | Purpose |
|---|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | backend | Postgres connection |
| `JWT_SECRET` | backend | Token signing key (min 16 chars, validated at boot) |
| `JWT_EXPIRES_IN` | backend | Customer token lifetime (default `1h`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | backend | Seeded admin account |
| `REPORTING_URL`, `REPORTING_API_KEY` | backend | Where/how to call the Go service |
| `REPORTING_PORT`, `INTERNAL_API_KEY` | reporting-go | Listen port and shared key |
| `VITE_API_URL` | frontend | API base URL (build-time) |

The API validates its environment at startup with Joi and refuses to boot on bad config.

## API overview

| Method | Path | Access |
|---|---|---|
| POST | `/auth/register` | public (always creates a customer) |
| POST | `/auth/login` | public, customers only |
| POST | `/auth/admin/login` | public, admins only, 30 min token |
| GET | `/auth/me` | authenticated |
| GET | `/products`, `/products/:id` | authenticated (`?search&page&limit`, admin: `includeInactive`) |
| POST / PATCH / DELETE | `/products`, `/products/:id` | admin (DELETE is a soft delete) |
| POST | `/orders` | authenticated |
| GET | `/orders`, `/orders/:id` | customer: own, admin: all (`?status&page&limit`) |
| POST | `/orders/:id/confirm` | admin |
| POST | `/orders/:id/cancel` | owner or admin |
| DELETE | `/orders/:id` | admin, cancelled orders only |
| GET | `/reports/summary` | admin (`?from&to`), served via the Go service |

Errors share one shape: `{ statusCode, error, message, path, timestamp }`. Validation returns every violation in one response.

## Data model

`users` (role enum) · `products` (numeric price, `CHECK stock >= 0`, `is_active`) · `orders` (status enum, total, user FK) · `order_items` (quantity, **`unit_price` snapshot**). Schema is owned by TypeORM migrations (`synchronize: false`).

## The order flow

Placing an order is **one DB transaction**:

1. Duplicate lines are merged; product ids are sorted.
2. Rows are locked with `SELECT ... FOR UPDATE` **in sorted id order**, so overlapping orders queue instead of deadlocking.
3. Stock and active status are checked under the lock: unknown/inactive product → `404`, insufficient stock → `409` with a per-product message.
4. Stock is decremented, `unit_price` is snapshotted from the locked row, and the total is computed **server-side in integer cents**.

Cancelling restores stock in a transaction. Status flow: `pending → confirmed` (admin) or `pending → cancelled` (owner/admin).

## Tests
```bash
cd backend && npm ci
npm test               # 11 unit tests: totals, merging, stock rules, cancel/restore, ownership
npm run test:e2e:db    # 6 e2e tests on real Postgres (needs `docker compose up -d postgres`)
cd ../reporting-go && go test ./...
```

`test:e2e:db` creates a separate `inventory_test` database, migrates it, and runs the suite, so your dev data is untouched. The suite includes an oversell race: 10 parallel orders against 5 units must give exactly 5 x `201`, 5 x `409` and final stock `0`.

## Assumptions and trade-offs

- **No payments or shipping.** An order reserves stock immediately; "confirmed" is an admin action.
- **Soft-delete products** so historical orders keep valid references. Orders can only be hard-deleted once cancelled, because stock has already been restored and live orders feed revenue.
- **Someone else's order returns 404, not 403**, so ids can't be probed.
- **Separate admin entry point** (`/admin/login`, `POST /auth/admin/login`). Admin credentials fail on the customer endpoint and vice versa with the same generic `401`, bcrypt runs even for unknown emails (no timing leak), admin tokens last 30 min, login routes are rate-limited (10/min/IP), and registration can never create an admin. This reduces exposure but is **not network isolation**: both flows share one user table and signing key.
- **Authorization is enforced server-side** (`JwtAuthGuard` + `RolesGuard`). Frontend route guards are UX only.
- **Cart is client-side** (persisted per user in localStorage). The server re-prices and re-checks stock on order, so a stale cart can only produce a clear `409`.
- **Reporting is isolated and fails soft.** The API sends non-cancelled orders (capped at 5,000) to the Go service with a 3 s timeout and a shared key. If Go is down, `/reports/summary` returns `503` and the rest of the API is unaffected.
- **JWT in localStorage**: simple, but exposed to XSS. Chosen for scope.
- **Offset pagination** everywhere; fine at this scale.
- **CORS is open** and demo secrets ship as defaults, which is convenient for review. Production would restrict origins and require real secrets.

## With more time

- Refresh tokens with rotation, and JWT in httpOnly cookies; admin MFA and audit log; account lockout.
- Separate signing key / `aud` claim for admin tokens; admin console on its own origin or behind a VPN.
- Idempotency keys on `POST /orders`; stock reservations with expiry.
- Reporting from SQL aggregates (or a read model) instead of shipping order payloads; caching.
- OpenAPI/Swagger docs, request-id logging, metrics, CI pipeline (lint, test, build images), frontend component and Playwright tests.
- Cursor pagination, product images and categories, email notifications.
