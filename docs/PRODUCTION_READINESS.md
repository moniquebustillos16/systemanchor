# Production readiness checklist

This is a release and operations checklist, not a deployment recipe for a particular cloud provider. The repository currently contains a GitHub Pages workflow for `docs/`; it does not provision or deploy the Laravel API, React application, PostgreSQL, workers, or production storage. Choose and document that hosting architecture before serving real users.

## Infrastructure and configuration

- [ ] Host the frontend and API on approved infrastructure, use HTTPS, and configure trusted origins and CORS intentionally.
- [ ] Set a unique production `APP_KEY`; keep it and database/API credentials in a managed secret store, not in Git or a build artifact.
- [ ] Set `APP_ENV=production`, `APP_DEBUG=false`, and a production-safe logging level/channel.
- [ ] Configure PostgreSQL with least-privilege application and migration accounts, encrypted connections where supported, backups, and monitoring.
- [ ] Configure persistent, private storage for uploads. The local filesystem default is not a shared or durable production storage strategy.
- [ ] Select production queue, cache, and session backends. The example environment uses database drivers; size, supervise, and monitor them for the deployment.
- [ ] Configure mail, outbound network access, DNS, TLS renewal, and any required scheduled tasks.
- [ ] Set `VITE_API_URL` at frontend build time to the production HTTPS API base URL. Treat all `VITE_*` values as public client-side configuration; never place secrets there.
- [ ] Review seeded accounts and sample data. Do not use demo/default credentials or run sample-data seeders in production.

## Release procedure

1. Review the exact commit and complete diff. Build the frontend and run the backend suite on an isolated PostgreSQL test database.
2. Review pending migrations and rehearse them against a recent production-like backup restored to a separate database.
3. Verify backup restoration, migration runtime/locking impact, and reconciliation queries. Follow [MIGRATION_RUNBOOK.md](../MIGRATION_RUNBOOK.md) for identifier-changing migrations.
4. Back up production and confirm the recovery owner, maintenance window, forward-fix/restore decision process, and communication plan.
5. Deploy the reviewed API and frontend artifacts. Run the reviewed migration process once with an appropriately authorized deployment identity.
6. Smoke-test login, role/warehouse access, inventory reads, order and receiving/shipping workflows, notifications, and health/logging signals.
7. Reconcile stock ledger and warehouse balances, then monitor application errors, queues, database health, and user-facing workflows before closing the release.

## Recovery and operations

- Prefer a tested corrective forward migration for application/schema defects. A database restore discards writes made after the backup and requires explicit business approval.
- Keep database backups encrypted, access-controlled, retention-limited, and periodically restore-tested.
- Define alert ownership for failed jobs, database saturation, storage exhaustion, elevated API errors, and backup failures.
- Establish a patch process for Laravel, PHP, Node.js, and npm dependencies; review lockfile updates and run the project checks before deployment.
- Never run `php artisan migrate:rollback` as an assumed recovery procedure for a data migration. Confirm reversibility from the migration implementation and runbook first.

## Current release limitations

- Application hosting and deployment infrastructure are not versioned here.
- The frontend lint command has existing failures; see [TESTING_PLAN.md](../TESTING_PLAN.md) and do not interpret a successful build as a clean lint/security review.
- Automated coverage does not prove production scale, infrastructure recovery, or every API authorization path.
