# SystemAnchor

SystemAnchor is a full-stack warehouse-management system for teams that need a
clear view of stock, fulfillment, suppliers, and warehouse activity. It pairs a
Laravel API with a React/TypeScript client and enforces permissions on the
server—not only in the interface.

## Highlights

- Track products, categories, suppliers, customers, and stock across multiple warehouses, zones, and bins.
- Run purchase orders, goods receiving, sales orders, shipping, returns, transfers, adjustments, and cycle counts.
- Restrict access with Laravel Sanctum authentication, explicit permissions, and warehouse assignments.
- Surface dashboard metrics, inventory health, order pipelines, utilization, notifications, and recent activity.

## What the application covers

| Area | Capabilities |
| --- | --- |
| Inventory | Products, categories, stock levels, movements, adjustments, transfers, and cycle counts |
| Procurement | Suppliers, purchase orders, and goods receiving |
| Fulfillment | Customers, sales orders, shipping, and returns |
| Warehouse operations | Warehouses, zones, bins, capacity, and user warehouse assignments |
| Access control | Users, roles, permissions, Sanctum authentication, and server-side authorization |
| Visibility | Dashboard summaries, notifications, reports, and operational activity |

## Technology

- Backend: PHP 8.3+, Laravel 13, Laravel Sanctum, PostgreSQL
- Frontend: React 19, TypeScript, Vite, TanStack Query, Axios, React Router

## Architecture

```text
React + TypeScript client
        │ Axios / TanStack Query
        ▼
Laravel API ── Sanctum authentication ── Permission middleware
        │
        ▼
PostgreSQL ── warehouses, inventory, orders, roles, and operational data
```

- Laravel is the security boundary. API routes require Sanctum authentication and server-side permissions; hiding a control in the client is never authorization.
- The client uses permissions only to hide unavailable navigation and controls. A hidden control is not authorization.
- Users can be limited to assigned warehouses; controllers enforce warehouse scope when reading or changing operational data.
- TanStack Query stores server state and query invalidation rules live in `frontend/src/lib`.

## Requirements

- PHP 8.3+ with PostgreSQL PDO support
- Composer
- Node.js 20+ and npm
- PostgreSQL with the `pgcrypto` extension available (`gen_random_uuid()` is used by existing migrations)

PostgreSQL is the supported database. The migration history contains PostgreSQL-specific schema changes; SQLite is not a supported setup.

## Local setup

Use two terminals: one for the API and one for the React development server.

### API

```bash
cd backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Set the `DB_*` values in `backend/.env` before migrating. A typical local configuration is:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=systemanchor
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

The API runs at `http://127.0.0.1:8000/api`.

### Client

```bash
cd frontend
npm install
npm run dev
```

The development client runs at `http://localhost:5173`. To change the API address, set the following in `frontend/.env.local` and restart Vite:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

## Demo account

The demo seeder creates the following local-development account:

```text
email: admin@systemanchor.com
password: SystemAnchor@123
```

Do not seed or retain this credential in a production environment.

## Demo videos

Click a preview to open its compact recording, or use YouTube for the full walkthrough.

### Application walkthrough

[![Application walkthrough](docs/videos/main-demo-preview.gif)](https://github.com/moniquebustillos16/systemanchor/blob/main/docs/videos/main-demo-small.mp4)

[Watch on YouTube instead](https://youtu.be/x8MKAmA1D7g)

### Role-based access walkthrough

[![Role-based access walkthrough](docs/videos/role-access-preview.gif)](https://github.com/moniquebustillos16/systemanchor/blob/main/docs/videos/role-access-small.mp4)

[Watch on YouTube instead](https://youtu.be/TG1yWSiqX5g)

For autoplaying, in-browser previews, visit the [SystemAnchor demo page](https://moniquebustillos16.github.io/systemanchor/).

## Permissions

Permissions use exact canonical names such as `inventory.view`, `purchase_orders.view`, and `users.update`. Assign the exact permission required by the API route; similar names are not interchangeable.

The main permission middleware is in `backend/app/Http/Middleware/PermissionMiddleware.php`, and protected routes are declared in `backend/routes/api.php`.

## Quality checks

Run these before opening a pull request or deploying:

```bash
cd frontend
npm run lint
npm run build

cd ../backend
php artisan test
```

The current automated test suite is minimal. Before production use, add feature coverage for login, permission checks, warehouse scoping, migrations, and order workflows.

## Production notes

- Set `APP_ENV=production` and `APP_DEBUG=false`.
- Use HTTPS and a production PostgreSQL instance.
- Build the frontend before publishing it: `npm ci && npm run build`.
- Run `php artisan migrate --force` only through a reviewed deployment process.
- Run a queue worker when `QUEUE_CONNECTION=database`.
- Keep `storage` and `bootstrap/cache` writable by the application user, not the full repository.
- Back up PostgreSQL and test restores before deploying schema changes.

## Deployment checklist

1. Configure production environment variables, including `APP_URL`, database credentials, mail, cache, and queue settings.
2. Set `APP_ENV=production` and `APP_DEBUG=false`.
3. Build the web client with `cd frontend && npm ci && npm run build`.
4. Apply migrations only through a reviewed deployment process using `php artisan migrate --force`.
5. Start a queue worker when `QUEUE_CONNECTION=database` and verify backups before release.

## Repository layout

```text
backend/                 Laravel API
  app/                   Controllers, models, middleware
  database/              Migrations and seeders
  routes/api.php         API and permission declarations
frontend/                React client
  src/api/               HTTP request modules
  src/hooks/             Query hooks
  src/lib/               Query, cache, and permission utilities
  src/Pages/             Route-level UI
docs/                    Demo media and GitHub Pages assets
```

## Current limitations

- Automated coverage and CI are still incomplete.
- The migration chain is PostgreSQL-specific and contains non-reversible data/schema transitions; rehearse upgrades against a production-like database.
- Permission names must remain synchronized between API routes, seeders, role configuration, and frontend UI checks.

## License

Portfolio and demonstration use.
