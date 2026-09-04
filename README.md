# SystemAnchor

A full-stack warehouse management system (WMS) for tracking inventory, orders, and logistics across multiple warehouses — built with a Laravel API and a React/TypeScript client.

SystemAnchor covers the core operational loop of a warehouse: products come in through **Purchase Orders → Goods Receiving**, get tracked as **Inventory** across **Warehouses/Zones/Bins**, move through **Stock Movements** and **Cycle Counts**, and go out through **Sales Orders → Shipping**, with **Returns** handled on the way back. All of it sits behind a role-and-permission system enforced on the server, not just hidden in the UI.

> **Status:** Active portfolio project — the codebase is still being iterated on and hardened. See [Roadmap / known limitations](#roadmap--known-limitations) below.

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
- **The frontend uses stale-while-revalidate behavior.** Cached data is rendered immediately when available, while stale data refreshes in the background. TanStack Query persists user-scoped cache data in local storage for fast reloads; the cache is cleared on logout and expired authentication.
- **The dashboard is a single aggregated endpoint**, cached server-side for a short TTL, rather than the client stitching together multiple requests.
- **The backend is authoritative.** Sanctum authentication, permission checks, warehouse scope, validation, and database writes must be enforced by Laravel. Frontend guards and cached data must never be treated as a security boundary.

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

## Environment configuration

Do not commit `.env`, production credentials, database passwords, cloud keys, or API tokens.

### Backend

Important production variables include:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.example
APP_KEY=base64:your-generated-key

DB_CONNECTION=pgsql
DB_HOST=your-rds-endpoint
DB_PORT=5432
DB_DATABASE=systemanchor
DB_USERNAME=your-database-user
DB_PASSWORD=your-database-password

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=file
```

Generate the application key only once per environment:

```bash
php artisan key:generate
```

### Frontend

Vite reads environment variables at build time. Set the API URL before building:

```env
VITE_API_URL=https://your-domain.example/api
```

For local development, use `frontend/.env.local`:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

After changing a Vite environment variable, restart the development server or rebuild the frontend.

## AWS deployment

The recommended production topology is:

```text
Browser
  -> Route 53 / DNS
  -> HTTPS load balancer or Nginx on EC2
  -> React static files served by Nginx
  -> /api requests forwarded to Laravel through PHP-FPM
  -> PostgreSQL on Amazon RDS
```

For a small single-EC2 deployment, the current layout is:

```text
/home/ubuntu/systemanchor/frontend       frontend source
/var/www/systemanchor/frontend           published Vite dist files
/home/ubuntu/systemanchor/backend        Laravel application
/home/ubuntu/systemanchor/backend/public Laravel public directory
```

### AWS infrastructure checklist

- EC2 instance running Ubuntu with Nginx, PHP 8.3+, PHP-FPM, Composer, and Node.js.
- RDS PostgreSQL in a private subnet when possible.
- Security groups allowing HTTP/HTTPS to EC2 and PostgreSQL only from the application security group.
- IAM role on EC2 instead of access keys stored in the application.
- Route 53 record pointing the application domain to the load balancer or EC2 address.
- TLS certificate from AWS Certificate Manager when using an Application Load Balancer, or Certbot when terminating TLS in Nginx.
- CloudWatch logs and alarms for EC2, RDS, Nginx, PHP-FPM, disk, CPU, memory, and database connections.
- Automated RDS backups and a tested restore procedure.

### First-time server setup

Install the application in `/home/ubuntu/systemanchor`, configure the backend `.env`, and run:

```bash
cd /home/ubuntu/systemanchor/backend
composer install --no-dev --optimize-autoloader
php artisan storage:link
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

cd ../frontend
npm ci
npm run build
sudo mkdir -p /var/www/systemanchor/frontend
sudo rsync -a --delete dist/ /var/www/systemanchor/frontend/
```

The production Nginx configuration must serve the frontend `index.html` for client-side routes and forward `/api/` to Laravel. A typical shape is:

```nginx
server {
    listen 80;
    server_name your-domain.example;

    root /var/www/systemanchor/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ^~ /api/ {
        root /home/ubuntu/systemanchor/backend/public;
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ^~ /storage/ {
        alias /home/ubuntu/systemanchor/backend/public/storage/;
        try_files $uri =404;
    }

    location ~ ^/index\.php(/|$) {
        root /home/ubuntu/systemanchor/backend/public;
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }
}
```

Test and reload Nginx after configuration changes:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Normal release deployment

Run from the application server after reviewing the working tree:

```bash
cd /home/ubuntu/systemanchor
git pull --ff-only origin main

cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

cd ../frontend
npm ci
npm run build
sudo rsync -a --delete dist/ /var/www/systemanchor/frontend/

sudo nginx -t
sudo systemctl reload nginx
```

Do not run `git pull` when deploying uncommitted local changes. Commit and push the intended release first, or publish the local `dist` directory deliberately.

### Queue worker

Notifications and other queued work require a running worker when `QUEUE_CONNECTION=database`:

```bash
cd /home/ubuntu/systemanchor/backend
php artisan queue:work --tries=3 --timeout=120
```

Run this under Supervisor or systemd in production. After deploying changed PHP code, restart workers gracefully:

```bash
php artisan queue:restart
```

### File permissions and storage

Laravel must be able to write to `storage` and `bootstrap/cache`:

```bash
cd /home/ubuntu/systemanchor/backend
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R ug+rwX storage bootstrap/cache
php artisan storage:link
```

Do not make the entire project writable by the web server. Uploaded files should be served through the Laravel storage link or a private object-storage policy, not exposed from arbitrary application directories.

### Deployment verification

```bash
curl -I https://your-domain.example/
curl -i https://your-domain.example/api/me
sudo systemctl status nginx --no-pager
sudo systemctl status php8.3-fpm --no-pager
tail -f /home/ubuntu/systemanchor/backend/storage/logs/laravel.log
```

The unauthenticated `/api/me` check should return `401 Unauthorized`. That confirms the API is reachable and protected.

### Rollback

Keep the previous frontend `dist` directory or release artifact. To roll back the frontend, copy the previous artifact back to `/var/www/systemanchor/frontend`. For backend code, deploy the previous Git commit and clear/rebuild Laravel caches. Database migrations require a separately tested down/forward migration plan; never restore production data blindly.

## Performance and caching rules

- Persistent browser cache is an acceleration layer, not the source of truth.
- Query keys must include every filter, page, sort, user, and warehouse scope that changes the response.
- Mutations must update or invalidate all related queries, including Dashboard aggregates and lookup catalogs.
- Never use cached frontend data for authorization decisions.
- Server-side cache keys must include user or warehouse scope whenever a response can differ by access level.
- Keep large transactional lists lazy; prefetch only lightweight catalogs during idle time.
- Profile slow endpoints with database query logs before increasing client timeouts.

## Troubleshooting

### CORS error on localhost

Add the exact development origin, including its port, to `backend/config/cors.php`, then clear the Laravel configuration cache:

```bash
php artisan config:clear
```

`http://localhost:5173` and `http://127.0.0.1:5174` are different browser origins.

### `timeout of 15000ms exceeded`

Check the actual API response time and database queries. The frontend has a bounded Axios timeout, but increasing it only masks slow backend work. Optimize the endpoint, add appropriate indexes, or add server-side caching.

### New frontend code is not visible

Rebuild and republish `dist`, then hard-refresh the browser. Nginx serves the published directory, not the frontend source directory.

### API returns `500`

Inspect Laravel logs, confirm production environment variables, verify RDS security-group access, and run:

```bash
php artisan optimize:clear
php artisan about
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
