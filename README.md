# Production-Grade E-Commerce Backend System

This repository contains a unified Node.js + TypeScript e-commerce backend that integrates the requested modules for:

- Native HTTP request inspector
- Fault-tolerant async data engine
- Express API architecture with routes, controllers, services, repositories, middleware, validation, and observability
- JWT authentication and RBAC
- Prisma PostgreSQL schema and transactional patterns
- Redis caching and distributed rate limiting
- Docker and GitHub Actions CI/CD
- Redis-stream event processing for order workflows

## Quick start

1. Install dependencies:
   npm install
2. Copy `.env.example` to `.env` and replace its local-only values if needed.
3. Start PostgreSQL and Redis:
   `docker compose up -d postgres redis`
4. Apply migrations and start the API:
   `npm run prisma:migrate:deploy`
   `npm run dev`

For the complete containerized stack, run `docker compose up --build`. Compose
requires the database credentials and all three application secrets to be set in
the environment or `.env`; use unique, strong secrets for production. The sample
`.env.example` secrets are local-development placeholders and are rejected when
`NODE_ENV=production`. Use a URL-safe PostgreSQL password, or percent-encode it
when placing it in `DATABASE_URL`.

The English, left-to-right store dashboard is served by the API at `http://localhost:4000/`.
It includes account registration and login, product browsing, order checkout, and
administration pages for products, categories, orders, and users.
Administrators can manage products and categories. The Customers page lists customer
accounts separately from the Users page, which lists Admin and Staff accounts. Admins
and staff can create, edit, and delete orders, including changing the customer, order
items, and status. Admins and staff can add customer accounts from the Customers page
and use them when creating orders. Admins and staff can also create team accounts with
either the Admin or Staff role. Staff can manage orders and customer accounts, but
cannot modify products or categories. Customers can place orders from the product catalog.

In non-production environments, startup seeds three demo customers and three sample
orders. Use `sarah@example.test`, `omar@example.test`, or `mia@example.test` with
password `DemoPass123` to test customer login and order history. Demo data is created
only when missing and is not added in production.

Newly registered accounts have the `CUSTOMER` role. To enable the administration
pages, set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (at least 8 characters) in
`.env` before starting the server. `ADMIN_NAME` is optional. The configured admin
account is created on startup and is not reset when it already exists.

Production uses Prisma/PostgreSQL for users, products, categories, orders, and
refresh-token records. The in-memory repositories are retained for automated
tests and local development when `STORAGE_MODE=memory`. Production startup
requires PostgreSQL and `STORAGE_MODE=prisma`.

## Core endpoints

- GET /api/health
- POST /api/auth/register
- POST /api/auth/login
- GET /api/users (admin or staff)
- POST /api/users (admin or staff; creates a customer account)
- POST /api/users/staff (admin or staff; creates an Admin or Staff account)
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/products
- GET /api/products?q=natural-language-query (embedding-based semantic search)
- POST /api/products
- POST /api/orders
- GET /api/orders (admin or staff)
- GET /api/orders/mine (authenticated user)
- PUT /api/orders/:id (admin or staff)
- DELETE /api/orders/:id (admin or staff)
- PATCH /api/orders/:id/status (admin or staff)

## Production notes

- JWT secrets and API keys are loaded from environment variables.
- API requests are rate-limited; dashboard and static asset requests are excluded.
  The default is 1,000 API requests per 15 minutes in development and 100 in
  production. `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MINUTES` override these defaults.
- Redis failures degrade gracefully; rate limiting falls back to local memory, while pending order events remain durable in PostgreSQL.
- Rate limiting remains enforced even when external cache services are unavailable.
- Order rows and `OrderCreated` outbox events are committed together; the Redis Streams relay retries unpublished events, and the worker uses consumer groups, acknowledgements, pending-message recovery, idempotency records, and a dead-letter stream.
- Refresh JWTs are stored only as SHA-256 digests and rotated atomically.
- The async data engine uses `Promise.allSettled()` with bounded concurrency, per-operation timeouts, and structured failures.
- Semantic search uses PostgreSQL pgvector and an OpenAI-compatible embedding endpoint. Configure `EMBEDDING_API_URL`, `EMBEDDING_API_KEY`, and `EMBEDDING_MODEL`; without a configured key or if the provider/vector query fails, search falls back to the standard catalog rather than simulating semantic relevance with text matching.
- Apply schema changes with `npm run prisma:migrate` during development. Container startup applies committed migrations with `prisma migrate deploy`.
- Use `npm run typecheck`, `npm test`, and `npm run build` for local validation.
