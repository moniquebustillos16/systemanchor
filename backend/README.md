# SystemAnchor Backend

The backend is a Laravel REST API for SystemAnchor. It validates and authorizes application operations and persists warehouse, inventory, purchasing, fulfillment, and user-access data in PostgreSQL.

## Requirements

- PHP 8.3 or newer with the PostgreSQL PDO extension enabled
- Composer
- PostgreSQL
- Node.js and npm only when building or serving the backend's bundled Vite assets

## Local setup

From `backend/`:

```powershell
composer install
Copy-Item .env.example .env
php artisan key:generate
```

Edit `.env` and set the PostgreSQL connection values for a local development database:

```env
APP_ENV=local
APP_DEBUG=true
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=systemanchor
DB_USERNAME=postgres
DB_PASSWORD=
```

Create the database before migrating. For a local development database that may be reset or seeded, run:

```powershell
php artisan migrate --seed
php artisan serve
```

The API is available at `http://127.0.0.1:8000/api` by default. The database seeder creates sample users and application data; only use it in a disposable local environment, and never rely on seeded credentials outside local development.

For the frontend, configure `VITE_API_URL` in `frontend/.env.local` if the API is not at its default URL. See the [frontend setup guide](../frontend/README.md).

## API and authorization

- `routes/api.php` is the source of truth for registered endpoints and route middleware.
- Controllers and form requests implement endpoint behavior and input validation.
- Protected routes use Sanctum authentication and permission middleware; administrator-only operations have additional authorization checks.
- Warehouse-scoped operations must enforce the authenticated user's assigned-warehouse access on list, aggregate, detail, and mutation paths.
- The API's response envelopes and supported filters vary by endpoint. Consult the relevant controller and request validation rather than assuming a uniform contract.

See the manual [API reference](../docs/API_REFERENCE.md) for a route-group overview.

## Inventory integrity

Warehouse-specific on-hand balances are stored in `inventories`; `products.qty` is compatibility data and is not the multi-warehouse source of truth. Use `App\Services\InventoryService` for stock posting so balance updates and movement-ledger entries remain transactional and consistent. Do not update inventory balances directly from controllers or document workflows.

Receiving, shipping, returns, and other document operations should preserve their warehouse scope, lifecycle validation, and idempotency behavior. Add regression tests when changing these workflows.

## Tests and code style

PHPUnit is configured for PostgreSQL and forces the test database name to `systemanchor_test`. Create that dedicated database and configure PostgreSQL connection credentials before running tests:

```powershell
php artisan test
```

Tests use `RefreshDatabase`, which resets the configured test database. Never change the test database setting to a development, shared, staging, or production database.

Run the Composer test script and check Laravel Pint formatting with:

```powershell
composer test
vendor\bin\pint --test
```

See the root [testing plan](../TESTING_PLAN.md) for coverage notes and known limitations.

## Related documentation

- [Architecture guide](../docs/ARCHITECTURE.md)
- [PostgreSQL migration runbook](../MIGRATION_RUNBOOK.md)
- [Production readiness checklist](../docs/PRODUCTION_READINESS.md)
- [Contributing guide](../CONTRIBUTING.md)
