# SystemAnchor

A full-stack warehouse management system (WMS) for tracking inventory, orders, and logistics across multiple warehouses — built with a Laravel API and a React/TypeScript client.

SystemAnchor covers the core operational loop of a warehouse: products come in through **Purchase Orders → Goods Receiving**, get tracked as **Inventory** across **Warehouses/Zones/Bins**, move through **Stock Movements** and **Cycle Counts**, and go out through **Sales Orders → Shipping**, with **Returns** handled on the way back. All of it sits behind a role-and-permission system enforced on the server, not just hidden in the UI.

> **Status:** Active portfolio project — the codebase is still being iterated on and hardened. See [Roadmap / known limitations](#roadmap--known-limitations) below.

## Why I built this

I wanted to build something bigger than a CRUD demo — a system with real operational logic (stock never goes negative, orders move through actual status pipelines, permissions are enforced per-endpoint) and a frontend that manages server state properly instead of `useEffect` + `fetch` everywhere. This project was also where I learned to use TanStack Query as an actual caching layer — query keys, invalidation, prefetching — rather than just a `fetch` replacement.

## Screenshots

<!-- Add 2–4 screenshots or a short GIF here, e.g.: -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->
<!-- ![Inventory](docs/screenshots/inventory.png) -->

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

This is an actively evolving portfolio project, not a finished state. Current focus areas:

- Expanding automated test coverage (currently minimal)
- Consolidating a couple of ad-hoc client-side caches into the TanStack Query layer
- Adding CI (lint + test on push)

## License

This project is for portfolio/demonstration purposes.
