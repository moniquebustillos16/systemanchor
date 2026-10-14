# SystemAnchor Engineering Health Review

## Executive summary

SystemAnchor is a React/TypeScript frontend, Laravel 13 API, and PostgreSQL warehouse-management application. The working workflows and backend test suite are functional, but this repository is **not ready to call fully verified or production-ready**: frontend lint currently fails, there is no CI workflow for application checks or application deployment, several lifecycle/API cases remain uncovered, and concurrent behavior outside direct inventory withdrawals has not been tested.

This report records code/configuration inspection and checks that were actually run. It is a prioritized engineering assessment, not a line-by-line audit of every component or an operational review of a production environment.

## Verified execution and project state

- Runtime inspected with `php artisan about`: Laravel 13.23.0, PHP 8.5.8, local environment, debug enabled, PostgreSQL connection, database-backed local cache/queue/session, and public storage link present. `APP_DEBUG=true` is appropriate only for local development; production must use debug off and production-safe infrastructure/configuration.
- Backend suite, using the dedicated PostgreSQL `systemanchor_test` database: **52 tests passed, 260 assertions**, including the simultaneous-withdrawal regression.
- Frontend `npm run build`: passed TypeScript project build and Vite production bundle. Vite warned that `src/api/warehouses.ts` is both dynamically and statically imported, so the dynamic import does not split it; the generated JavaScript bundle exceeds 500 kB.
- Frontend `npm run lint`: **failed with 86 errors and 12 warnings** across the project. Common errors are explicit `any`; warnings include React Hook dependency findings.
- `git diff --check`: passed in the latest review.
- The worktree contains accumulated changes spanning backend, frontend, docs, tests, migrations, and configuration. Review and group them before merging; do not assume they form one reviewed release.
- API route inspection found **174 API routes**. `route:list` confirmed the notification endpoints, including `/api/notifications/unread-count`, are inside `auth:sanctum` and active-account middleware.
- Local unauthenticated request to `/api/notifications/unread-count` returned **401**, as expected. The user's authenticated **200** is successful access. The endpoint returns that user's count (also for an Admin), not a cross-user dashboard count.
- `.env` and `frontend/.env.local` are ignored by Git. The only checked-in GitHub Actions workflow deploys static content under `docs/` to GitHub Pages; there is no application CI/test workflow or Laravel/React deployment workflow.
- Migrations contain non-reversible/data-transforming changes. The supplier/purchase-order identifier migration also needs a pre-release audit of dependent references and durable old-to-new ID mapping; see [MIGRATION_RUNBOOK.md](./MIGRATION_RUNBOOK.md).

## Risk-based coverage and gaps

| Priority | System area | Existing automated evidence | Main remaining risk |
|---|---|---|---|
| P0 | Inventory, stock movement, transfers, adjustments | Insufficient stock, transfer success, batch rollback, duplicate/conflicting idempotency keys, synchronized simultaneous withdrawals in separate PHP processes, ledger reconciliation, API transfer retry, and adjustment consistency. | Concurrent shipment/receipt API lifecycle operations and broader contention/load cases still need coverage. |
| P0 | Purchasing, receiving, sales, shipments, returns | Receipt completion/retry and invalid-quantity rollback; sales shipment issue/delivery, duplicate delivery, overship rejection, and restock-return completion/retry. | Purchase-order/receipt full API lifecycle, cancellation/partial states, race conditions, and more invalid transitions remain uncovered. |
| P1 | Authentication and access control | Unauthenticated and underprivileged denial, inactive login, Admin warehouse behavior, resource warehouse scoping, role/user assignment restrictions, and notification ownership. Admin unread-count auth and scope are tested. | Logout/token revocation and successful role/permission CRUD plus systematic route-by-route authorization tests remain incomplete. |
| P1 | Product, supplier, customer, warehouse, catalog data | Product opening stock is reflected in warehouse balance and movement ledger; missing warehouse and invalid supplier input are rejected. Warehouse assignments are exercised. | CRUD validation and referential integrity are not comprehensively covered for all resource endpoints. |
| P1 | Analytics, reports, dashboard | Frontend and API compile/build; some data/cache workflows are present. | Query correctness, authorization filters, large data performance, empty/error states, and refresh behavior need targeted integration/component tests. |
| P2 | Notifications, profile, settings, images, locations, zones/bins | Notification ownership/read/dismiss and the unread-count response have focused checks; build compiles relevant frontend code. | Bulk notification operations and API/UI behavior for profile/settings/uploads/location storage are not comprehensively covered. |
| P2 | React client and accessibility | TypeScript build succeeds; TanStack Query/Axios layers exist. | No frontend test runner is configured. Keyboard/screen-reader behavior, forms, loading/error states, cache invalidation, and browser workflows lack automated evidence. |

## Arrange

1. **Review the worktree before integration.** Split the 54 pending paths into coherent inventory, authorization, maintainability/frontend, PostgreSQL/test-configuration, and documentation changesets. Review each diff against its own tests; preserve changes that are not part of a selected patch.
2. **Add continuous integration.** Add CI jobs for PostgreSQL migrations and Laravel tests, frontend build/type-check, and ESLint. Use an isolated disposable PostgreSQL service/database and never expose production credentials to CI tests.
3. **Define production operations.** There is currently no versioned application deployment stack. Decide hosting for Laravel/API, React static assets, PostgreSQL, HTTPS, secrets, backups, logging/monitoring, persistent storage, queues, and scheduled tasks before deployment.
4. **Prepare migration recovery.** Follow [MIGRATION_RUNBOOK.md](./MIGRATION_RUNBOOK.md): audit dependent references, preserve needed identifier mappings, rehearse against a restored copy, and define backup/forward-fix/restore approval. Do not rely on `migrate:rollback` for identifier/status conversions.
5. **Keep environments separated.** PHPUnit forces PostgreSQL and `systemanchor_test`, and uses `RefreshDatabase`; keep test credentials/database separate from development and production.

## Modify next

1. **Unblock frontend quality checks (highest immediate quality issue).** Reduce the 86 ESLint errors and 12 warnings, prioritizing unsafe `any`, React Hook dependency correctness, and errors in frequently used forms/API code. Avoid blanket rule disables.
2. **Extend stock concurrency coverage on PostgreSQL.** `InventoryConcurrencyTest` starts two independent PHP worker processes at a shared barrier and makes both withdraw four units from a committed five-unit balance. It asserts exactly one succeeds, one receives insufficient-stock validation, the warehouse and product balances are one, and exactly one movement is recorded. Add equivalent races for document-based shipments and receipts, and run them in CI.
3. **Expand API workflow tests.** Add PostgreSQL-backed API tests for purchase-order and receipt create/update/cancel flows; role-permission success and token logout; cancellation/partial shipment and return state rules; resource CRUD validation; notification bulk operations.
4. **Add frontend tests deliberately.** Select a maintained component test approach and mock API boundary if UI regressions are in scope. Focus on order forms, invalid states, stale/loading/error states, and TanStack Query invalidation. Until added, do not describe browser workflows as tested.
5. **Improve client failure visibility.** Several areas use cached values or fallbacks after API failures. Keep stale data if useful, but distinguish it from a fresh successful response and surface actionable errors for failed operations. The notification count is one example, not the project-wide issue.
6. **Reduce and measure frontend bundle.** Resolve mixed static/dynamic imports and identify large route dependencies; add a build-size budget rather than merely increasing the warning threshold.
7. **Exercise authorization route-wide.** For every protected resource/action, assert unauthenticated, inactive, insufficient-permission, wrong-warehouse, and administrator cases as applicable. Verify both response status and unchanged persisted state on denied mutations.

## Remove, retain, and avoid

- **Retain** `/api/notifications/unread-count`: `200` for the authenticated Admin means success; it is correctly scoped to the signed-in user. Do not change it to return every user's count without a separate product requirement and explicit authorization.
- **Avoid restoring SQLite PHPUnit configuration** or SQLite database-file bootstrap. PostgreSQL is the target schema/engine and tests need to exercise its migrations.
- **Do not remove source code solely because lint/build warns.** Confirm usages and intended UX first. The warehouse dynamic import warning suggests import-boundary cleanup, not proof that its API code is dead.
- **Do not delete/mass-rewrite the accumulated pending worktree.** First identify ownership and intended patches; clean up only specific, confirmed dead code or generated artifacts that are tracked/in scope.
- The unused root npm manifest and lockfile were removed after confirming that application dependencies and scripts are owned by `frontend/` or `backend/`; all walkthrough videos and previews were retained.
- No other source deletion is justified by the checks run for this report.

## Safe test and build commands

From the repository root in PowerShell:

```powershell
Set-Location backend
createdb -h 127.0.0.1 -p 5432 -U postgres systemanchor_test
composer test

Set-Location ..\frontend
npm run build
npm run lint
```

Configure the test PostgreSQL host, port, username, and password in the backend environment. PHPUnit forces `DB_CONNECTION=pgsql`, `DB_DATABASE=systemanchor_test`, and an empty `DB_URL`; `RefreshDatabase` migrates/resets that database. Never point this configuration at development or production data.

## Exit criteria before calling the project ready

- Full Laravel suite and migrations pass against a clean disposable PostgreSQL database in CI.
- The multi-process PostgreSQL withdrawal regression test passes in the full CI suite, with additional shipment/receipt concurrency risks documented.
- Frontend lint is green (or a tracked, shrinking baseline is explicitly agreed); TypeScript/build stays green.
- Critical API workflows have authorization, validation, rollback, duplicate-request, and invalid-transition tests.
- Production debug is off; secrets, database, HTTPS, queue/scheduler, storage, backup/restore, logs, and deployment are configured and verified.
- Pending worktree changes are reviewed and grouped; release notes identify remaining uncovered paths and any accepted risks.
