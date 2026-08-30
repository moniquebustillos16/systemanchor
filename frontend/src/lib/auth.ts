/**
 * Single source of truth for reading/clearing the auth token.
 *
 * Previously this same "check 5 different storage keys" logic was copy-
 * pasted in 6 different files (api/axios.ts, hooks/useCurrentUser.ts,
 * hooks/useProfile.ts, Pages/components/RequirePermission.tsx,
 * Pages/components/Topbar.tsx). Only "token" is ever actually written on
 * login (see App.tsx) — the other keys (auth_token, sa-auth, access_token)
 * were dead reads left over from earlier iterations. Consolidating here so
 * there's exactly one place to update if the storage strategy ever changes.
 */

const TOKEN_KEY = "token";
const USER_KEY = "user";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

export function setAuthToken(token: string, persist: boolean): void {
  const store = persist ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
