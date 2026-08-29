/**
 * Shared API types and response helpers for SystemAnchor.
 * Laravel sometimes returns:
 *  - plain payload
 *  - { data: T }
 *  - paginator { data, current_page, last_page, total, ... }
 */

export type ListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
  [key: string]: unknown;
};

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
};

/** Pull array from plain array, { data: [] }, or paginator. */
export function extractArray<T = unknown>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as T[];
    if (o.data && typeof o.data === "object") {
      const inner = o.data as Record<string, unknown>;
      if (Array.isArray(inner.data)) return inner.data as T[];
    }
  }
  return [];
}

/** Prefer body.data when present (Laravel resource / message wrappers). */
export function extractData<T = unknown>(json: unknown): T {
  if (json && typeof json === "object" && "data" in (json as object)) {
    return (json as { data: T }).data;
  }
  return json as T;
}

/** Detect Laravel LengthAwarePaginator-shaped JSON. */
export function isPaginated(json: unknown): json is Paginated<unknown> {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
  return Array.isArray(o.data) && typeof o.total === "number";
}

export function toPaginated<T>(json: unknown): Paginated<T> {
  if (isPaginated(json)) {
    return json as Paginated<T>;
  }
  const rows = extractArray<T>(json);
  return {
    data: rows,
    current_page: 1,
    last_page: 1,
    per_page: rows.length || 15,
    total: rows.length,
  };
}