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
2. Copy environment file if needed:
   Copy `.env.example` to `.env`
3. Start PostgreSQL and Redis via Docker Compose:
   docker compose up -d
4. Start the API:
   npm run dev

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

The current repositories store users, products, categories, and orders in memory;
their data is reset when the server restarts. Configure a persistent repository
before using this backend for production data.

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
- Redis failures degrade gracefully and the app continues safely with in-memory fallback behavior.
- Rate limiting remains enforced even when external cache services are unavailable.
- Prisma queries are configured for PostgreSQL and can be extended to fully transactional inventory deductions and order creation in a production deployment.
