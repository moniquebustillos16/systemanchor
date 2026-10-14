# PostgreSQL Migration Safety Runbook

This runbook applies to production-like PostgreSQL databases. Do not use the production database for rehearsals or automated tests.

## Migrations requiring a release gate

- `backend/database/migrations/2026_10_07_000005_align_supplier_and_purchase_order_ids.php` replaces supplier and purchase-order primary keys with newly generated UUIDs, rebuilds the purchase-order supplier reference, and drops the old identifiers. Its `down()` intentionally throws.
- `backend/database/migrations/2026_10_07_000006_align_purchase_order_status.php` removes the legacy status check, converts values to lowercase strings, and changes the default. Its `down()` intentionally throws; the expanded string status set is not equivalent to the old enum.

Treat both as forward-only data migrations. Do not run `php artisan migrate:rollback` expecting either migration to reverse.

### Mandatory data-mapping review

Before release, inspect every column that refers to suppliers or purchase orders. The identifier migration creates new supplier and purchase-order UUIDs and preserves the purchase-order-to-supplier link, but it does not create/reuse a durable old-ID-to-new-ID mapping for other referencing columns. In particular, audit `products.supplier_id` and `goods_receipts.purchase_order_id` against real target data and any other discovered references.

If any such references contain values that must continue pointing to the same records, **do not deploy this migration as written**. First implement and test a mapping-based forward migration that updates every dependent reference before dropping/replacing the old primary keys. Keep the mapping available until post-migration reconciliation passes. If migration `000005` has already run in a shared environment, do not edit that migration file; add a new corrective migration based on the affected data and the saved mapping/backup.

## Release procedure

1. **Establish state.** Record the release commit, PostgreSQL version, current migration status, row counts for suppliers, purchase orders, products, and goods receipts, and counts of null/orphan references. Review the SQL and expected data mapping with the application owner.
2. **Create and verify a restorable backup.** Use the approved backup process, store it encrypted with restricted access, verify the archive, and restore it into a separate disposable database. Do not rely only on a successful `pg_dump` exit code.
3. **Rehearse.** Restore a recent production-like backup into an isolated PostgreSQL database. Run `php artisan migrate --force`, then run reconciliation queries and smoke-test purchasing, receiving, supplier/product lookups, and status filters against that restored copy.
4. **Schedule a maintenance window.** Pause writes and background workers that mutate orders or inventory. Ensure the application release and migration are coordinated so old application code is not writing incompatible identifiers/status values during the conversion.
5. **Deploy forward once.** Take the final pre-migration backup, apply the reviewed application release and migrations once, and capture command output and migration status. Do not issue manual `ALTER TABLE` repairs outside the reviewed migration.
6. **Reconcile before reopening writes.** Confirm expected row counts, no missing supplier/order references, expected status conversions, and successful API smoke tests. Resume workers and user traffic only after checks pass.
7. **Recover deliberately.** If the migration fails inside PostgreSQL's transaction, verify the database state and migration table before retrying. If it completed but the release is faulty, prefer a tested forward-fix. Restore the complete pre-migration backup only when the business owner approves losing every write made after that backup; restore into the intended recovery target and verify it before redirecting traffic.

## Useful safe checks

Run status checks against the explicitly selected target:

```powershell
Set-Location backend
php artisan migrate:status
```

For an approved database backup using PostgreSQL client tools, set PostgreSQL client variables for the intended database and use a protected destination. Do not assume PowerShell automatically loads values from Laravel's `.env` file:

```powershell
$env:PGHOST = "approved-postgres-host"
$env:PGPORT = "5432"
$env:PGUSER = "approved-backup-user"
$env:PGDATABASE = "systemanchor-production"
$backupPath = "D:\database-backups\systemanchor-pre-migration.dump"
pg_dump --host=$env:PGHOST --port=$env:PGPORT --username=$env:PGUSER --dbname=$env:PGDATABASE --format=custom --no-owner --no-acl --file=$backupPath
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL backup failed" }
pg_restore --list $backupPath
if ($LASTEXITCODE -ne 0) { throw "Backup archive validation failed" }
```

The archive-list check does not prove restorability; perform the separate restore rehearsal before the production window. Avoid putting passwords on command lines or committing backup artifacts.

## Post-migration reconciliation examples

Run these read-only checks against the restored rehearsal database and after deployment. A nonzero count requires investigation; do not hide or automatically delete those rows.

```sql
SELECT COUNT(*) AS products_with_missing_supplier
FROM products p
LEFT JOIN suppliers s ON s.id = p.supplier_id
WHERE p.supplier_id IS NOT NULL AND s.id IS NULL;

SELECT COUNT(*) AS receipts_with_missing_purchase_order
FROM goods_receipts r
LEFT JOIN purchase_orders po ON po.id = r.purchase_order_id
WHERE r.purchase_order_id IS NOT NULL AND po.id IS NULL;

SELECT status, COUNT(*)
FROM purchase_orders
GROUP BY status
ORDER BY status;
```

Compare row counts and status totals to the recorded pre-migration baseline, accounting only for planned transformations. Archive the results with the release record.
