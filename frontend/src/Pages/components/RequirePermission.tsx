import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { usePermissions } from "../../hooks/useCurrentUser";
import { getAuthToken } from "../../lib/auth";
import {
  ADMIN_ONLY_PATHS,
  AUTH_ONLY_PATHS,
  ROUTE_VIEW,
} from "../../lib/routePermissions";

type Props = {
  path: string;
  children: ReactNode;
  fallback?: string;
};

/**
 * UI route guard — no token → login; no permission → dashboard.
 * Laravel still enforces API authorization.
 */
export default function RequirePermission({
  path,
  children,
  fallback = "/dashboard",
}: Props) {
  const token = getAuthToken();
  const { can, isAdmin, isLoaded } = usePermissions({ enabled: !!token });

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (!isLoaded) {
    return null;
  }

  if (AUTH_ONLY_PATHS.has(path) || path === "/dashboard") {
    return <>{children}</>;
  }

  if (ADMIN_ONLY_PATHS.has(path)) {
    if (!isAdmin) return <Navigate to={fallback} replace />;
    return <>{children}</>;
  }

  const needed = ROUTE_VIEW[path];
  if (!needed || needed.length === 0) {
    return <>{children}</>;
  }

  if (!can(...needed)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}