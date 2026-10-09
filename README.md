# SystemAnchor

SystemAnchor is a warehouse-management application with a Laravel API and a React/TypeScript client. It manages inventory, suppliers, purchase and sales orders, goods receiving, shipping, returns, warehouse locations, and role-based access.

## Stack

- Backend: PHP 8.3+, Laravel 13, Laravel Sanctum, PostgreSQL
- Frontend: React 19, TypeScript, Vite, TanStack Query, Axios, React Router

## Architecture

- Laravel is the security boundary. API routes require Sanctum authentication and server-side permissions.
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

### API

```bash
cd backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Set the `DB_*` values in `backend/.env` before migrating. The API runs at `http://127.0.0.1:8000/api`.

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

On GitHub, select a demo below to open it in GitHub's video viewer and watch
it in the browser:

- ▶ [Watch the main application walkthrough](<frontend/src/lib/Demo video/Main Demo.mp4>)
- ▶ [Watch the role-based access walkthrough](<frontend/src/lib/Demo video/RoleAccess Demo.mp4>)

The video files are intentionally stored with the frontend source. Commit the
files at these paths so the links remain available in GitHub.

## Permissions

Permissions use exact canonical names such as `inventory.view`, `purchase_orders.view`, and `users.update`. Assign the exact permission required by the API route; similar names are not interchangeable.

The main permission middleware is in `backend/app/Http/Middleware/PermissionMiddleware.php`, and protected routes are declared in `backend/routes/api.php`.

## Quality checks

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
```

## Current limitations

- Automated coverage and CI are still incomplete.
- The migration chain is PostgreSQL-specific and contains non-reversible data/schema transitions; rehearse upgrades against a production-like database.
- Permission names must remain synchronized between API routes, seeders, role configuration, and frontend UI checks.

## License

Portfolio and demonstration use.
