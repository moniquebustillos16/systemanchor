# Contributing to SystemAnchor

Thank you for helping improve SystemAnchor. This guide describes the checks and review expectations for changes to the React client and Laravel API.

## Development setup

Follow the installation instructions in [README.md](./README.md). Install dependencies from the project that owns them:

- Frontend: `frontend/`
- Backend: `backend/`

Use a local development database for manual work. Backend automated tests use PostgreSQL database `systemanchor_test` and `RefreshDatabase`; never configure that database name to point to shared, staging, or production data.

## Before making a change

1. Check the current branch and worktree. Preserve changes you did not create.
2. Read the related feature code, tests, and API route middleware before changing behavior.
3. Keep changes focused. Do not include generated bundles, runtime caches, `.env` files, credentials, database dumps, or user data.
4. For schema or data changes, add a forward migration and consider populated databases, foreign keys, rollback behavior, and operational recovery. Review [MIGRATION_RUNBOOK.md](./MIGRATION_RUNBOOK.md) before changing production-sensitive migrations.

## Implementation expectations

- Follow the existing React/TypeScript and Laravel patterns in the relevant module.
- Validate request data on the server; frontend validation is additional UX, not an authorization or integrity boundary.
- Protect API routes with authentication, active-account checks, the correct permission middleware, and warehouse-scoped authorization where applicable.
- Keep inventory balance changes and stock-movement ledger entries transactional. Use `InventoryService` for stock posting instead of updating balances directly.
- Preserve idempotency and retry behavior for document-driven inventory operations.
- Avoid broad exception catches, silent fallbacks, unnecessary abstractions, and unrelated formatting changes.
- Add or update focused tests for behavior changes. Update related user or operator documentation when workflows change.

## Verification

Run the smallest relevant checks, then broaden them when shared behavior changes.

```powershell
# Frontend
Set-Location frontend
npm run build
npm run lint

# Backend
Set-Location ..\backend
php artisan test
vendor\bin\pint --test
```

The frontend lint command currently reports pre-existing findings; consult [TESTING_PLAN.md](./TESTING_PLAN.md), run ESLint on changed files, and do not introduce additional lint findings. Backend tests require the isolated PostgreSQL test database described in the testing plan.

Before submitting, inspect `git diff --check` and the complete diff. Report checks that could not be run and any known limitations.

## Pull request checklist

- [ ] The change addresses one clearly stated problem or feature.
- [ ] Authorization and warehouse boundaries are preserved.
- [ ] Focused tests cover changed behavior and regression cases.
- [ ] Required build, tests, and formatting checks were run.
- [ ] Documentation and migrations are updated where required.
- [ ] No secrets, generated output, local data, or unrelated worktree changes are included.
- [ ] Remaining limitations and deployment considerations are stated.
