# SystemAnchor

A full-stack warehouse management system (WMS) for tracking inventory, orders, and logistics across multiple warehouses — built with a Laravel API and a React/TypeScript client.

SystemAnchor covers the core operational loop of a warehouse: products come in through **Purchase Orders → Goods Receiving**, get tracked as **Inventory** across **Warehouses/Zones/Bins**, move through **Stock Movements** and **Cycle Counts**, and go out through **Sales Orders → Shipping**, with **Returns** handled on the way back. All of it sits behind a role-and-permission system enforced on the server, not just hidden in the UI.

**Live demo:** [systemanchor.duckdns.org](http://systemanchor.duckdns.org)

> **Status:** Active portfolio project — both the codebase and the AWS deployment are still being iterated on and hardened. See [Roadmap / known limitations](#roadmap--known-limitations) below.

## Why I built this

I wanted to build something bigger than a CRUD demo — a system with real operational logic (stock never goes negative, orders move through actual status pipelines, permissions are enforced per-endpoint) and a frontend that manages server state properly instead of `useEffect` + `fetch` everywhere. This project was also where I learned to use TanStack Query as an actual caching layer — query keys, invalidation, prefetching — rather than just a `fetch` replacement.



## Features

- **Dashboard** — live operational overview: inventory value, low/out-of-stock counts, sales & purchase order pipelines, warehouse utilization, category mix, recent activity, and trend charts, aggregated server-side and cached.
- **Inventory management** — products, categories, stock levels, and product images, with filtering, search, and pagination.
- **Stock movements** — stock in / out / transfer / adjustment tracking.
- **Purchase orders & goods receiving** — supplier ordering through to received stock.
- **Sales orders & shipping** — customer orders through to fulfillment.
- **Returns** — return intake tied back to the original sales order.
- **Cycle counts** — scheduled inventory accuracy checks.
- **Warehouses, zones, bins & capacity** — multi-warehouse location hierarchy with utilization tracking.
- **Customers & suppliers** — partner records used across orders.
- **Users, roles & permissions** — granular, per-action permissions (e.g. `inventory.view`, `orders.create`, `users.delete`) assigned via roles and enforced by API middleware.
- **Notifications** — in-app alerts (e.g. low stock) with read/unread state.
- **Profile & security** — session management and two-factor authentication support.
- **Reports & analytics** — exportable operational reports.

## Tech stack

**Backend**
- PHP 8.3, Laravel 13
- Laravel Sanctum (token authentication)
- Custom permission middleware for route-level authorization
- SQLite by default (config supports MySQL/PostgreSQL)

**Frontend**
- React 19 + TypeScript
- Vite
- TanStack Query (React Query) — server state, caching, invalidation, and prefetching
- Axios
- React Router
- Recharts

## Architecture notes

- **Authorization is enforced server-side.** Every protected route is wrapped in permission middleware (e.g. `->middleware('permission:inventory.delete')`); the frontend's route guards and `can()` checks are for UI/UX only, not the security boundary.
- **The frontend treats TanStack Query as the single source of truth for server data.** A shared `queryClient` and a centralized query-key factory are used across the app, with a dedicated `invalidate.ts` module that defines which queries need to be invalidated together after a mutation (e.g. updating stock invalidates both inventory and the dashboard).
- **The dashboard is a single aggregated endpoint**, cached server-side for a short TTL, rather than the client stitching together multiple requests.

## Getting started

### Prerequisites
- PHP 8.3+, Composer
- Node.js 20+, npm
- SQLite (bundled with PHP) or MySQL/PostgreSQL if you prefer

### Backend setup

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

The API will be available at `http://127.0.0.1:8000/api`.

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173` (Vite's default). Set `VITE_API_URL` in a `.env` file in `frontend/` if your API isn't running at the default address.

### Demo login

Seeding the database creates a default admin account:

```
email:    admin@systemanchor.com
password: SystemAnchor@123
```

## Deployment

SystemAnchor is deployed on **AWS**, using an EC2 `t3.micro` instance (Ubuntu 24.04 LTS) in the `us-east-1c` Availability Zone. The instance hosts the entire stack — the built React/Vite frontend, the Laravel backend, PHP 8.4-FPM, and PostgreSQL — behind **Nginx**, which acts as the single entry point:

- Requests to the main domain are served directly as static files from the compiled React build.
- Requests under `/api/` are routed to the Laravel backend, processed by PHP-FPM.
- Laravel connects to **PostgreSQL 16** over `localhost:5432` on the same instance.
- The instance sits in the SystemAnchor VPC/subnet, with an **AWS Security Group** controlling inbound network access, and an **IAM instance role** (`SystemAnchorEC2Role`) attached so the instance can access AWS resources without any credentials stored in the application itself.
- The app is publicly reachable via a **DuckDNS** domain pointed at the instance: [systemanchor.duckdns.org](http://systemanchor.duckdns.org).

In short: public traffic → Nginx → (static frontend) or (PHP-FPM → Laravel → PostgreSQL).

**This is an ongoing portfolio project, and the deployment is a work in progress alongside the code.** It currently runs without HTTPS/TLS and without a host-level firewall (UFW is inactive; access control is security-group-only) — closing those gaps, along with automating the deploy process, are the next infrastructure items planned. See the roadmap below.

## Project structure

```
systemanchor/
├── backend/                 # Laravel API
│   ├── app/Http/Controllers/Api/   # REST controllers (one per resource)
│   ├── app/Http/Middleware/        # Permission & warehouse-access middleware
│   ├── app/Models/                 # Eloquent models
│   ├── database/migrations/        # Schema
│   └── database/seeders/           # Demo user + permission seed data
└── frontend/                 # React + TypeScript client
    ├── src/api/               # Axios request functions, one module per resource
    ├── src/hooks/              # TanStack Query hooks (data fetching + caching)
    ├── src/lib/                # Query client, query keys, invalidation, permissions
    └── src/Pages/               # Route-level page components
```

## Roadmap / known limitations

This is an actively evolving portfolio project — both the application code and the AWS deployment are ongoing work, not a finished state. Current focus areas:

- Expanding automated test coverage (currently minimal)
- Consolidating a couple of ad-hoc client-side caches into the TanStack Query layer
- Adding CI (lint + test on push)
- Enabling HTTPS and a proper firewall (UFW) on the production instance
- Automating deploys instead of manual pull + build

## License

This project is for portfolio/demonstration purposes.
