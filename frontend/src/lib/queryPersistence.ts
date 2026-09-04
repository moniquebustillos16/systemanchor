import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

function currentUserNamespace(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as { id?: string | number };
    return user.id != null ? String(user.id) : null;
  } catch {
    return null;
  }
}

const namespacedStorage: Storage = {
  get length() {
    return localStorage.length;
  },
  clear() {
    const namespace = currentUserNamespace();
    if (namespace) localStorage.removeItem(`systemanchor-query-cache:${namespace}`);
  },
  getItem() {
    const namespace = currentUserNamespace();
    return namespace ? localStorage.getItem(`systemanchor-query-cache:${namespace}`) : null;
  },
  key() {
    return null;
  },
  removeItem() {
    const namespace = currentUserNamespace();
    if (namespace) localStorage.removeItem(`systemanchor-query-cache:${namespace}`);
  },
  setItem(_key, value) {
    const namespace = currentUserNamespace();
    if (namespace) localStorage.setItem(`systemanchor-query-cache:${namespace}`, value);
  },
};

export const queryPersister = createSyncStoragePersister({
  storage: namespacedStorage,
  key: "systemanchor-query-cache",
});

export const queryCacheMaxAge = 24 * 60 * 60 * 1000;