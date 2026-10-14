# SystemAnchor Frontend

The frontend is the React and TypeScript web client for SystemAnchor. It uses Vite for development and production builds, React Router for navigation, Axios for API requests, and TanStack Query for server-state caching.

## Requirements

- Node.js 20 or newer
- npm
- The SystemAnchor API running locally, unless you are only working on UI that does not need API data

## Setup

From this directory:

```powershell
npm install
```

The client uses `http://127.0.0.1:8000/api` as its default API base URL. To use a different API, create a local `.env.local` file in `frontend/`:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

Vite exposes `VITE_*` variables to browser code. Do not put credentials, private keys, or other secrets in these values. Restart the Vite server after changing environment variables.

## Development

Start the development server:

```powershell
npm run dev
```

Vite normally serves the app at `http://localhost:5173`. Run the Laravel API separately; see [the backend setup guide](../backend/README.md).

## Checks and production build

```powershell
npm run build
npm run lint
```

The build runs the TypeScript project build before producing optimized static assets in `dist/`. To preview a production build locally:

```powershell
npm run preview
```

The lint script checks the frontend source using ESLint. Consult the repository [testing plan](../TESTING_PLAN.md) for known existing lint findings.

## Project structure

- `src/api/` — API client and feature request modules
- `src/hooks/` — shared React hooks, including server-state and current-user hooks
- `src/lib/` — shared authentication, permissions, theme, and query-cache utilities
- `src/Pages/` — routed application pages grouped by feature
- `src/App.tsx` and `src/main.tsx` — application composition and entry point
- `public/` — static assets copied as-is into the production build

The API client's base URL and bearer-token handling are centralized in `src/api/axios.ts`. The client can hide controls and routes based on permissions, but the backend remains the authorization boundary. Do not rely on frontend checks to protect data or operations.

## Troubleshooting

- **API requests fail:** confirm the API is running, `VITE_API_URL` includes the `/api` suffix, and the backend CORS configuration allows the frontend origin.
- **Changes to `.env.local` do not take effect:** restart the Vite development server.
- **A page shows stale data:** check its TanStack Query key and mutation invalidation before bypassing the shared query cache.
- **A request returns `401` or `403`:** verify the signed-in account is active and has the required backend permissions and warehouse access.

For cross-project design and authorization details, see the root [architecture guide](../docs/ARCHITECTURE.md). For contribution and review expectations, see [CONTRIBUTING.md](../CONTRIBUTING.md).
