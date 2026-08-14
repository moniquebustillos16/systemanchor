import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import "../css/Main.css";

const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconPlus = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const IconRefresh = () => (
  <svg {...svg} width="16" height="16">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconSearch = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const IconBox = () => (
  <svg {...svg} width="18" height="18">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconX = () => (
  <svg {...svg} width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconUpload = () => (
  <svg {...svg} width="16" height="16">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconEdit = () => (
  <svg {...svg} width="15" height="15">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = () => (
  <svg {...svg} width="15" height="15">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconEye = () => (
  <svg {...svg} width="15" height="15">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

type Category = { id: string; name: string };
type Warehouse = { id: string; code: string; name?: string };
type Supplier = { id: string; name: string };

type ProductImage = {
  id: string;
  product_id: string;
  image_path: string;
  image_url: string | null;
  file_name?: string | null;
  is_primary: boolean;
  sort_order: number;
  product?: { id: string; name: string; sku: string };
};

type Product = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  serial: string | null;
  category_id: string | null;
  warehouse_id: string | null;
  supplier_id: string | null;
  qty: number | string;
  min_stock: number | string;
  max_stock: number | string;
  price: number | string;
  status: string;
  display_status?: "active" | "low-stock" | "out-of-stock";
  stock_value?: number;
  category?: Category | null;
  warehouse?: Warehouse | null;
  supplier?: Supplier | null;
  images?: ProductImage[];
  primary_image?: ProductImage | null;
};

type Stats = {
  total_products: number;
  low_stock: number;
  out_of_stock: number;
  inventory_value: number;
};

type Paginated<T> = {
  data: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
};

type Tab = "products" | "categories";
type SortKey = "sku" | "name" | "qty" | "price" | "status";
type DisplayStatus = "active" | "low-stock" | "out-of-stock";
type ModalMode = "add" | "edit";

type ProductForm = {
  sku: string;
  name: string;
  barcode: string;
  serial: string;
  category_id: string;
  warehouse_id: string;
  supplier_id: string;
  qty: string;
  min_stock: string;
  max_stock: string;
  price: string;
  status: string;
};

const emptyForm = (): ProductForm => ({
  sku: "",
  name: "",
  barcode: "",
  serial: "",
  category_id: "",
  warehouse_id: "",
  supplier_id: "",
  qty: "0",
  min_stock: "0",
  max_stock: "0",
  price: "0",
  status: "active",
});

const CAT_COLORS: Record<string, { bg: string; fg: string }> = {
  Electronics: { bg: "#E8F0FE", fg: "#4A7AB5" },
  Machinery: { bg: "#F5EDE4", fg: "#9A6B45" },
  Safety: { bg: "#E8F5EC", fg: "#5A9A6E" },
  Hardware: { bg: "#F5F0E8", fg: "#8A7B6A" },
  Packaging: { bg: "#FEF3E8", fg: "#C49A5A" },
  Furniture: { bg: "#F0E8F5", fg: "#8A6B9A" },
  Tools: { bg: "#E8F0FE", fg: "#4A7AB5" },
  Consumables: { bg: "#FEF3E8", fg: "#C49A5A" },
  PPE: { bg: "#E8F5EC", fg: "#5A9A6E" },
  Lighting: { bg: "#F5EDE4", fg: "#9A6B45" },
};

function num(v: number | string | null | undefined): number {
  return Number(v ?? 0);
}

/** Format amount as Philippine Peso (₱) */
function formatPeso(amount: number, fractionDigits = 0): string {
  return `₱${Number(amount).toLocaleString("en-PH", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function getDisplayStatus(p: Product): DisplayStatus {
  if (p.display_status) return p.display_status;
  const qty = num(p.qty);
  const min = num(p.min_stock);
  if (qty <= 0) return "out-of-stock";
  if (qty < min) return "low-stock";
  return "active";
}

function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.replace("http://localhost:8000", "http://127.0.0.1:8000");
  if (u.startsWith("/storage/")) {
    u = "http://127.0.0.1:8000" + u;
  }
  return u;
}

function getPrimaryImageUrl(p: Product): string | null {
  const url =
    p.primary_image?.image_url ??
    (p.images?.find((i) => i.is_primary) ?? p.images?.[0])?.image_url ??
    null;
  return normalizeImageUrl(url);
}

function getAllImageUrls(p: Product): string[] {
  const imgs = p.images ?? [];
  const sorted = [...imgs].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const urls = sorted
    .map((i) => normalizeImageUrl(i.image_url))
    .filter((u): u is string => !!u);
  if (urls.length === 0) {
    const primary = getPrimaryImageUrl(p);
    if (primary) urls.push(primary);
  }
  return urls;
}

/* ── Role permissions (from /auth/me or /user) ─────────────── */

type AuthPayload = {
  permissions?: string[];
  data?: { permissions?: string[]; user?: { permissions?: string[] } };
  user?: { permissions?: string[]; role?: { permissions?: { name: string }[] } };
};

function extractPermissions(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const j = json as AuthPayload;
  if (Array.isArray(j.permissions)) return j.permissions.map(String);
  if (Array.isArray(j.data?.permissions)) return j.data!.permissions!.map(String);
  if (Array.isArray(j.user?.permissions)) return j.user!.permissions!.map(String);
  const rolePerms = j.user?.role?.permissions;
  if (Array.isArray(rolePerms)) {
    return rolePerms.map((p) => (typeof p === "string" ? p : p?.name)).filter(Boolean) as string[];
  }
  // nested data.user
  const du = (j as { data?: { user?: { permissions?: string[] } } }).data?.user;
  if (Array.isArray(du?.permissions)) return du!.permissions!.map(String);
  return [];
}

function can(perms: string[], ...needed: string[]): boolean {
  if (perms.includes("*") || perms.includes("admin") || perms.includes("Admin")) return true;
  return needed.some((n) => perms.includes(n));
}

function productToForm(p: Product): ProductForm {
  return {
    sku: p.sku ?? "",
    name: p.name ?? "",
    barcode: p.barcode ?? "",
    serial: p.serial ?? "",
    category_id: p.category_id ?? p.category?.id ?? "",
    warehouse_id: p.warehouse_id ?? p.warehouse?.id ?? "",
    supplier_id: p.supplier_id ?? p.supplier?.id ?? "",
    qty: String(num(p.qty)),
    min_stock: String(num(p.min_stock)),
    max_stock: String(num(p.max_stock)),
    price: String(num(p.price)),
    status: p.status || "active",
  };
}

type Toast = { type: "success" | "error"; title: string; message?: string } | null;

function Inventory() {
  const [tab, setTab] = useState<Tab>("products");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterWh, setFilterWh] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("sku");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  // Meta data from dedicated endpoints (Location + Categories + Suppliers APIs)
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category create/edit modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<Category | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [permsLoaded, setPermsLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [viewImageIndex, setViewImageIndex] = useState(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 320);
    return () => clearTimeout(t);
  }, [search]);

  const showToast = useCallback((type: "success" | "error", title: string, message?: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, title, message });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchUserPermissions = useCallback(async () => {
    const finish = (list: string[]) => {
      setUserPermissions(list);
      setPermsLoaded(true);
    };

    // 1) localStorage (set at login) — same keys Roles / axios may rely on
    try {
      const rawKeys = [
        "permissions",
        "user_permissions",
        "auth_permissions",
        "user",
        "auth_user",
        "authUser",
        "currentUser",
      ];
      for (const key of rawKeys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
            finish(parsed);
            return;
          }
          const list = extractPermissions(parsed);
          if (list.length > 0) {
            finish(list);
            return;
          }
        } catch {
          /* not JSON */
        }
      }
    } catch {
      /* ignore */
    }

    // 2) Auth endpoints via shared axios client (Bearer from interceptor)
    let roleId: string | null = null;
    for (const path of ["/user", "/me"]) {
      try {
        const { data: json } = await api.get(path);
        const list = extractPermissions(json);
        if (list.length > 0) {
          finish(list);
          return;
        }
        const u = json?.data ?? json?.user ?? json;
        roleId = u?.role_id || u?.role?.id || json?.role_id || null;
        if (list.length === 0 && !roleId) {
          finish([]);
          return;
        }
        break;
      } catch (err: any) {
        if (err.response?.status === 404) continue;
        /* try next */
      }
    }

    // 3) Load permissions via role (same route Roles.tsx uses)
    if (roleId) {
      try {
        const { data: json } = await api.get(`/roles/${roleId}/permissions`);
        const perms = json?.data?.permissions ?? json?.permissions ?? json?.data ?? [];
        if (Array.isArray(perms)) {
          const names = perms
            .map((p: { name?: string } | string) =>
              typeof p === "string" ? p : p?.name
            )
            .filter(Boolean) as string[];
          finish(names);
          return;
        }
      } catch {
        /* fall through */
      }
    }

    // 4) Dev fallback
    finish(["*"]);
  }, []);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  const canView = can(userPermissions, "inventory.view", "inventories.view", "products.view");
  const canCreate = can(userPermissions, "inventory.create", "inventories.create", "products.create");
  const canUpdate = can(userPermissions, "inventory.update", "inventories.update", "products.update");
  const canDelete = can(userPermissions, "inventory.delete", "inventories.delete", "products.delete");
  const canManageCategories = can(
    userPermissions,
    "categories.create",
    "categories.update",
    "categories.delete",
    "inventory.create",
    "inventory.update",
    "*"
  );


  /** Load categories + warehouses + suppliers via shared axios api */
  const fetchMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const loadWarehouses = async (): Promise<Warehouse[]> => {
        for (const path of ["/warehouses", "/locations/warehouses"]) {
          try {
            const { data: json } = await api.get(path);
            const list = Array.isArray(json) ? json : json.data ?? [];
            return list
              .map((w: Warehouse) => ({
                id: String(w.id),
                code: w.code,
                name: w.name,
              }))
              .sort((a: Warehouse, b: Warehouse) => a.code.localeCompare(b.code));
          } catch {
            /* try next */
          }
        }
        return [];
      };

      const [catRes, warehouses, supRes] = await Promise.all([
        api.get("/categories").then((r) => r.data).catch((e) => {
          console.warn("[Inventory] categories fetch failed:", e?.response?.status);
          return null;
        }),
        loadWarehouses(),
        api.get("/suppliers", { params: { per_page: 100 } }).then((r) => r.data).catch((e) => {
          console.warn("[Inventory] suppliers fetch failed:", e?.response?.status);
          return null;
        }),
      ]);

      if (catRes != null) {
        const list: Category[] = Array.isArray(catRes) ? catRes : catRes.data ?? [];
        setAllCategories(
          list
            .map((c) => ({ id: String(c.id), name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }

      setAllWarehouses(warehouses);
      if (warehouses.length === 0) {
        console.warn("[Inventory] warehouses: no data from /warehouses or /locations/warehouses");
      }

      if (supRes != null) {
        const list: Supplier[] = Array.isArray(supRes) ? supRes : supRes.data ?? [];
        setAllSuppliers(
          list
            .map((s) => ({ id: String(s.id), name: s.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }
    } catch (e) {
      console.error("[Inventory] meta fetch failed:", e);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params: Record<string, string | number> = {
      per_page: pageSize,
      page,
      sort: sortKey === "status" ? "sku" : sortKey,
      dir: sortAsc ? "asc" : "desc",
      with: "images,primaryImage,category,warehouse,supplier",
    };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (filterCat !== "all") params.category_id = filterCat;
    if (filterWh !== "all") params.warehouse_id = filterWh;
    if (filterStatus !== "all") params.status = filterStatus;

    try {
      const [listSettled, statsSettled, imagesSettled] = await Promise.allSettled([
        api.get("/inventories", { params }),
        api.get("/inventories/stats"),
        api.get("/product-images", { params: { per_page: 500 } }),
      ]);

      if (listSettled.status === "rejected") {
        const e = listSettled.reason;
        const status = e?.response?.status;
        const body = e?.response?.data;
        const msg =
          (typeof body === "string" ? body : body?.message) ||
          e?.message ||
          "Failed to load inventory";
        throw new Error(status ? `Inventories HTTP ${status}: ${String(msg).slice(0, 200)}` : msg);
      }
      if (statsSettled.status === "rejected") {
        const e = statsSettled.reason;
        const status = e?.response?.status;
        throw new Error(`Stats HTTP ${status ?? "?"}: ${e?.message || "failed"}`);
      }

      const listJson: Paginated<Product> | Product[] = listSettled.value.data;
      const statsJson: Stats = statsSettled.value.data;

      let allImages: ProductImage[] = [];
      if (imagesSettled.status === "fulfilled") {
        const imgJson = imagesSettled.value.data;
        allImages = Array.isArray(imgJson) ? imgJson : imgJson.data ?? [];
      }

      const imagesByProductId = new Map<string, ProductImage[]>();
      const imagesBySku = new Map<string, ProductImage[]>();

      allImages.forEach((img) => {
        const pid = String(img.product_id ?? "");
        if (pid) {
          const list = imagesByProductId.get(pid) ?? [];
          list.push(img);
          imagesByProductId.set(pid, list);
        }
        const sku = img.product?.sku;
        if (sku) {
          const list = imagesBySku.get(sku) ?? [];
          list.push(img);
          imagesBySku.set(sku, list);
        }
      });

      let rows = Array.isArray(listJson) ? listJson : listJson.data ?? [];
      const totalCount = Array.isArray(listJson) ? rows.length : listJson.total ?? rows.length;
      const pages = Array.isArray(listJson) ? 1 : listJson.last_page ?? 1;

      rows = rows.map((p) => {
        let imgs = imagesByProductId.get(String(p.id)) ?? [];
        if (imgs.length === 0 && p.sku) {
          imgs = imagesBySku.get(p.sku) ?? [];
        }
        const primary = imgs.find((i) => i.is_primary) ?? (imgs.length > 0 ? imgs[0] : null);
        return { ...p, images: imgs, primary_image: primary };
      });

      setProducts(rows);
      setTotal(totalCount);
      setLastPage(pages);
      setStats(statsJson);
    } catch (e) {
      console.error("[Inventory] fetch failed:", e);
      setError(e instanceof Error ? e.message : "Failed to load inventory");
      setProducts([]);
      setTotal(0);
      setLastPage(1);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterCat, filterWh, filterStatus, sortKey, sortAsc]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [imagePreviews]);

  // Prefer full lists from API; fall back to values embedded on products
  const categories = useMemo((): Category[] => {
    if (allCategories.length > 0) return allCategories;
    const map = new Map<string, Category>();
    products.forEach((p) => {
      if (p.category?.id) {
        map.set(String(p.category.id), {
          id: String(p.category.id),
          name: p.category.name,
        });
      }
    });
    return Array.from(map.values());
  }, [allCategories, products]);

  const warehouses = useMemo((): Warehouse[] => {
    if (allWarehouses.length > 0) return allWarehouses;
    const map = new Map<string, Warehouse>();
    products.forEach((p) => {
      if (p.warehouse?.id) {
        map.set(String(p.warehouse.id), {
          id: String(p.warehouse.id),
          code: p.warehouse.code,
          name: p.warehouse.name,
        });
      }
    });
    return Array.from(map.values());
  }, [allWarehouses, products]);

  const suppliers = useMemo((): Supplier[] => {
    if (allSuppliers.length > 0) return allSuppliers;
    const map = new Map<string, Supplier>();
    products.forEach((p) => {
      if (p.supplier?.id) {
        map.set(String(p.supplier.id), {
          id: String(p.supplier.id),
          name: p.supplier.name,
        });
      }
    });
    return Array.from(map.values());
  }, [allSuppliers, products]);

  const categoryCards = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; value: number }>();

    // Seed with every category from the Categories API so empty ones still appear
    categories.forEach((c) => {
      map.set(c.id, { id: c.id, name: c.name, count: 0, value: 0 });
    });

    products.forEach((p) => {
      const id = p.category?.id ?? p.category_id ?? "none";
      const name = p.category?.name ?? (id === "none" ? "Uncategorized" : "Unknown");
      const cur = map.get(String(id)) ?? { id: String(id), name, count: 0, value: 0 };
      cur.count += 1;
      cur.value += num(p.qty) * num(p.price);
      map.set(String(id), cur);
    });

    return Array.from(map.values()).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [products, categories]);

  const displayList = useMemo(() => {
    if (sortKey !== "status") return products;
    return [...products].sort((a, b) => {
      const cmp = getDisplayStatus(a).localeCompare(getDisplayStatus(b));
      return sortAsc ? cmp : -cmp;
    });
  }, [products, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(1);
  };

  const selectCategory = (categoryId: string) => {
    setFilterCat(categoryId === "none" ? "all" : categoryId);
    setTab("products");
    setPage(1);
  };

  const clearImages = () => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImageFiles([]);
    setImagePreviews([]);
  };

  const openAdd = () => {
    if (!canCreate) {
      showToast("error", "Permission denied", "You cannot create products.");
      return;
    }
    setModalMode("add");
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    clearImages();
    setModalOpen(true);
  };

  const openAddCategory = () => {
    if (!canManageCategories) {
      showToast("error", "Permission denied", "You cannot manage categories.");
      return;
    }
    setEditingCategory(null);
    setCatName("");
    setCatError(null);
    setCatModalOpen(true);
  };

  const openEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCatName(c.name);
    setCatError(null);
    setCatModalOpen(true);
  };

  const closeCatModal = () => {
    if (catSaving) return;
    setCatModalOpen(false);
    setCatName("");
    setCatError(null);
    setEditingCategory(null);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = catName.trim();
    if (!name) {
      setCatError("Category name is required.");
      return;
    }
    setCatSaving(true);
    setCatError(null);
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, { name });
        showToast("success", "Category updated", `"${name}" has been saved.`);
      } else {
        await api.post("/categories", { name });
        showToast("success", "Category created", `"${name}" is now available.`);
      }
      closeCatModal();
      await fetchMeta();
    } catch (err: any) {
      const body = err.response?.data;
      const msg =
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        body?.message ||
        err.message ||
        "Failed to save category";
      setCatError(msg);
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!confirmDeleteCat) return;
    setDeletingCat(true);
    try {
      await api.delete(`/categories/${confirmDeleteCat.id}`);
      showToast("success", "Category deleted", `"${confirmDeleteCat.name}" was removed.`);
      setConfirmDeleteCat(null);
      if (filterCat === confirmDeleteCat.id) {
        setFilterCat("all");
      }
      await fetchMeta();
      await fetchInventory();
    } catch (err: any) {
      const body = err.response?.data;
      showToast(
        "error",
        "Delete failed",
        (typeof body === "string" ? body : body?.message) ||
          err.message ||
          "Could not delete category"
      );
    } finally {
      setDeletingCat(false);
    }
  };

  const openEdit = (p: Product) => {
    if (!canUpdate) {
      showToast("error", "Permission denied", "You cannot edit products.");
      return;
    }
    setModalMode("edit");
    setEditingId(p.id);
    setForm(productToForm(p));
    setFormError(null);
    clearImages();
    setModalOpen(true);
  };

  const openView = (p: Product) => {
    setViewProduct(p);
    setViewImageIndex(0);
  };

  const closeView = () => {
    setViewProduct(null);
    setViewImageIndex(0);
  };

  const openEditFromView = () => {
    if (!viewProduct) return;
    const p = viewProduct;
    closeView();
    openEdit(p);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setFormError(null);
    clearImages();
  };

  const setField = (key: keyof ProductForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const valid = files.filter((f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024);
    if (valid.length < files.length) {
      setFormError("Some files were skipped (only images ≤ 5MB allowed).");
    }

    const newPreviews = valid.map((f) => URL.createObjectURL(f));
    setImageFiles((prev) => [...prev, ...valid]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = () => ({
    sku: form.sku.trim(),
    name: form.name.trim(),
    barcode: form.barcode.trim() || null,
    serial: form.serial.trim() || null,
    category_id: form.category_id || null,
    warehouse_id: form.warehouse_id || null,
    supplier_id: form.supplier_id || null,
    qty: Number(form.qty) || 0,
    min_stock: Number(form.min_stock) || 0,
    max_stock: Number(form.max_stock) || 0,
    price: Number(form.price) || 0,
    status: form.status || "active",
  });

  const uploadImages = async (productId: string) => {
    if (imageFiles.length === 0) return;
    const formData = new FormData();
    formData.append("product_id", productId);
    imageFiles.forEach((file) => formData.append("images[]", file));
    formData.append("is_primary", "1");

    try {
      await api.post("/product-images", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (err: any) {
      const status = err.response?.status;
      const body = err.response?.data;
      const errText =
        (typeof body === "string" ? body : body ? JSON.stringify(body) : "") ||
        err.message ||
        "upload failed";
      throw new Error(`Image upload failed (${status ?? "?"}): ${String(errText).slice(0, 300)}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.sku.trim() || !form.name.trim()) {
      setFormError("SKU and Product name are required.");
      return;
    }

    const payload = buildPayload();
    setSaving(true);

    try {
      if (modalMode === "add") {
        let created: any;
        try {
          const { data } = await api.post("/inventories", payload);
          created = data;
        } catch (err: any) {
          const status = err.response?.status;
          if (status === 404 || status === 405) {
            const { data } = await api.post("/products", payload);
            created = data;
          } else {
            const body = err.response?.data;
            if (body?.errors) {
              throw new Error(Object.values(body.errors).flat().join(" ") || body.message);
            }
            throw new Error(body?.message || err.message || `HTTP ${status}`);
          }
        }

        const productId = created.id ?? created.data?.id;
        if (!productId) throw new Error("Product created but no ID returned");

        if (imageFiles.length > 0) {
          try {
            await uploadImages(productId);
          } catch (imgErr) {
            try {
              await api.delete(`/inventories/${productId}`);
            } catch {
              /* ignore rollback failure */
            }
            const reason = imgErr instanceof Error ? imgErr.message : "Failed to upload image";
            throw new Error(`Product was not saved because the image upload failed: ${reason}`);
          }
        }

        showToast("success", "Product added", `${payload.name} is now in inventory.`);
      } else if (modalMode === "edit" && editingId) {
        try {
          await api.put(`/inventories/${editingId}`, payload);
        } catch (err: any) {
          const body = err.response?.data;
          if (body?.errors) {
            throw new Error(Object.values(body.errors).flat().join(" ") || body.message);
          }
          throw new Error(body?.message || err.message || "Update failed");
        }

        if (imageFiles.length > 0) {
          await uploadImages(editingId);
        }

        showToast("success", "Product updated", `${payload.name} has been saved.`);
      }

      setModalOpen(false);
      setForm(emptyForm());
      clearImages();
      setPage(1);
      await fetchInventory();
    } catch (err) {
      console.error("[Inventory] save failed:", err);
      setFormError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      showToast("error", "Permission denied", "You cannot delete products.");
      return;
    }
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/inventories/${confirmDelete.id}`);
      showToast("success", "Product deleted", `${confirmDelete.name} was removed.`);
      setConfirmDelete(null);
      await fetchInventory();
    } catch (err: any) {
      console.error("[Inventory] delete failed:", err);
      const body = err.response?.data;
      showToast(
        "error",
        "Delete failed",
        (typeof body === "string" ? body : body?.message) ||
          err.message ||
          "Could not delete product"
      );
    } finally {
      setDeleting(false);
    }
  };

  const statsView = stats ?? {
    total_products: 0,
    low_stock: 0,
    out_of_stock: 0,
    inventory_value: 0,
  };

  return (
    <div className="inventory-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Inventory</h1>
              <p className="page-subtitle">
                Live from API · {total.toLocaleString()} product{total === 1 ? "" : "s"}
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  fetchInventory();
                  fetchMeta();
                }}
                disabled={loading || metaLoading}
              >
                <IconRefresh /> Refresh
              </button>
              {tab === "categories"
                ? canManageCategories && (
                    <button type="button" className="btn btn-primary" onClick={openAddCategory}>
                      <IconPlus /> Add Category
                    </button>
                  )
                : canCreate && (
                    <button type="button" className="btn btn-primary" onClick={openAdd}>
                      <IconPlus /> Add Product
                    </button>
                  )}
            </div>
          </div>

          {permsLoaded && !canView ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <div className="empty-state">
                <p style={{ fontWeight: 600, marginBottom: 6 }}>Access restricted</p>
                <p className="text-muted">
                  You do not have permission to view inventory. Ask an admin to grant{" "}
                  <code>inventory.view</code>.
                </p>
              </div>
            </div>
          ) : (
          <>

          <div className="inv-tabs">
            <button
              type="button"
              className={`inv-tab ${tab === "products" ? "active" : ""}`}
              onClick={() => setTab("products")}
            >
              Products
            </button>
            <button
              type="button"
              className={`inv-tab ${tab === "categories" ? "active" : ""}`}
              onClick={() => setTab("categories")}
            >
              Categories
            </button>
          </div>

          {error && (
            <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: "var(--sa-clay)" }}>
              <strong>API error:</strong> {error}
            </div>
          )}

          {tab === "products" && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Products</div>
                  <div className="stat-value">{statsView.total_products.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Low Stock</div>
                  <div className="stat-value warning">{statsView.low_stock.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Out of Stock</div>
                  <div className="stat-value danger">{statsView.out_of_stock.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Inventory Value</div>
                  <div className="stat-value">
                    {formatPeso(Number(statsView.inventory_value))}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="table-toolbar">
                  <div className="table-search">
                    <IconSearch />
                    <input
                      type="text"
                      placeholder="Search SKU, name, barcode, serial…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="table-filters">
                    <select
                      value={filterCat}
                      onChange={(e) => {
                        setFilterCat(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterStatus}
                      onChange={(e) => {
                        setFilterStatus(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All statuses</option>
                      <option value="active">Active</option>
                      <option value="low-stock">Low stock</option>
                      <option value="out-of-stock">Out of stock</option>
                    </select>
                    <select
                      value={filterWh}
                      onChange={(e) => {
                        setFilterWh(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All warehouses</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name ? `${w.code} — ${w.name}` : w.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="inv-table">
                    <thead>
                      <tr>
                        <th className="no-sort" style={{ width: 56 }}>
                          Image
                        </th>
                        <th onClick={() => toggleSort("sku")}>
                          SKU {sortKey === "sku" ? (sortAsc ? "↑" : "↓") : ""}
                        </th>
                        <th onClick={() => toggleSort("name")}>
                          Product {sortKey === "name" ? (sortAsc ? "↑" : "↓") : ""}
                        </th>
                        <th className="no-sort">Category</th>
                        <th className="no-sort">Warehouse</th>
                        <th onClick={() => toggleSort("qty")}>
                          Qty {sortKey === "qty" ? (sortAsc ? "↑" : "↓") : ""}
                        </th>
                        <th className="no-sort">Min / Max</th>
                        <th onClick={() => toggleSort("price")}>
                          Price {sortKey === "price" ? (sortAsc ? "↑" : "↓") : ""}
                        </th>
                        <th className="no-sort">Value</th>
                        <th onClick={() => toggleSort("status")}>
                          Status {sortKey === "status" ? (sortAsc ? "↑" : "↓") : ""}
                        </th>
                        <th className="no-sort" style={{ width: 120 }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <tr key={`skel-${i}`}>
                            <td>
                              <div className="skel" style={{ width: 42, height: 42, borderRadius: 10 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 70 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 140, marginBottom: 6 }} />
                              <div className="skel" style={{ width: 90, height: 10 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 80 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 50 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 40 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 55 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 50 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 60 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 72, height: 22, borderRadius: 20 }} />
                            </td>
                            <td>
                              <div className="skel" style={{ width: 60 }} />
                            </td>
                          </tr>
                        ))
                      ) : displayList.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="empty-row">
                            <div className="empty-state">
                              <IconBox />
                              <p>No products match your filters</p>
                              {canCreate && (
                              <button type="button" className="btn btn-primary" onClick={openAdd} style={{ marginTop: 8 }}>
                                <IconPlus /> Add your first product
                              </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        displayList.map((p) => {
                          const catName = p.category?.name ?? "—";
                          const colors = CAT_COLORS[catName] || CAT_COLORS.Hardware;
                          const displayStatus = getDisplayStatus(p);
                          const qty = num(p.qty);
                          const price = num(p.price);
                          const value = p.stock_value ?? qty * price;
                          const imgUrl = getPrimaryImageUrl(p);

                          return (
                            <tr
                              key={p.id}
                              className="clickable-row"
                              onClick={() => openView(p)}
                            >
                              <td>
                                <div className="thumb" style={{ background: colors.bg, color: colors.fg }}>
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={p.name}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <IconBox />
                                  )}
                                </div>
                              </td>
                              <td className="fw-600">{p.sku}</td>
                              <td>
                                <div className="product-cell">
                                  <div>
                                    <div className="product-name">{p.name}</div>
                                    <div className="product-meta">
                                      {p.supplier?.name ?? "—"}
                                      {p.serial ? ` · ${p.serial}` : ""}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="cat-chip" style={{ background: colors.bg, color: colors.fg }}>
                                  {catName}
                                </span>
                              </td>
                              <td>{p.warehouse?.code ?? "—"}</td>
                              <td className="fw-600">{qty.toLocaleString()}</td>
                              <td className="text-muted">
                                {num(p.min_stock)} / {num(p.max_stock)}
                              </td>
                              <td>{formatPeso(price, 2)}</td>
                              <td className="fw-600">
                                {formatPeso(value)}
                              </td>
                              <td>
                                <span className={`status-badge status-${displayStatus}`}>
                                  {displayStatus.replace("-", " ")}
                                </span>
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    title="View"
                                    onClick={() => openView(p)}
                                  >
                                    <IconEye />
                                  </button>
                                  {canUpdate && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-icon"
                                      title="Edit"
                                      onClick={() => openEdit(p)}
                                    >
                                      <IconEdit />
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-icon"
                                      title="Delete"
                                      onClick={() => setConfirmDelete(p)}
                                    >
                                      <IconTrash />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="table-pagination">
                  <span className="pagination-info">
                    Page {page} of {lastPage} · {total.toLocaleString()} total
                  </span>
                  <div className="pagination-btns">
                    <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                      ‹
                    </button>
                    {Array.from({ length: lastPage }, (_, i) => i + 1)
                      .slice(Math.max(0, page - 3), page + 2)
                      .map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={n === page ? "active" : ""}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      ))}
                    <button
                      type="button"
                      disabled={page >= lastPage || loading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "categories" && (
            <div className="cat-grid">
              {categoryCards.length === 0 ? (
                <div className="card" style={{ padding: 32, gridColumn: "1 / -1" }}>
                  <div className="empty-state">
                    <IconBox />
                    <p>{loading || metaLoading ? "Loading…" : "No categories yet"}</p>
                    {canManageCategories && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={openAddCategory}
                      style={{ marginTop: 8 }}
                    >
                      <IconPlus /> Create your first category
                    </button>
                    )}
                  </div>
                </div>
              ) : (
                categoryCards.map((c) => {
                  const colors = CAT_COLORS[c.name] || CAT_COLORS.Hardware;
                  return (
                    <div key={c.id} className="cat-card">
                      <div
                        className="cat-card-top"
                        style={{ cursor: "pointer" }}
                        onClick={() => selectCategory(c.id)}
                      >
                        <div className="cat-icon" style={{ background: colors.bg, color: colors.fg }}>
                          <IconBox />
                        </div>
                        <div>
                          <div className="cat-name">{c.name}</div>
                          <div className="cat-count">
                            {c.count} product{c.count === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <div className="cat-value" style={{ cursor: "pointer" }} onClick={() => selectCategory(c.id)}>
                          {formatPeso(c.value)}
                        </div>
                        {c.id !== "none" && (
                          <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                            {canManageCategories && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon"
                                  title="Edit category"
                                  onClick={() => openEditCategory({ id: c.id, name: c.name })}
                                >
                                  <IconEdit />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon"
                                  title="Delete category"
                                  onClick={() => setConfirmDeleteCat({ id: c.id, name: c.name })}
                                >
                                  <IconTrash />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
          </>
          )}
        </main>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === "add" ? "Add Product" : "Edit Product"}</h2>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={closeModal}
                disabled={saving}
              >
                <IconX />
              </button>
            </div>

            {formError && <div className="form-error">{formError}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-field full" style={{ marginBottom: 16 }}>
                <label>Product Images</label>
                <div className="upload-zone">
                  {imagePreviews.length > 0 && (
                    <div className="preview-row">
                      {imagePreviews.map((url, idx) => (
                        <div key={idx} className="preview-item">
                          <img src={url} alt={`preview-${idx}`} />
                          <button type="button" className="rm" onClick={() => removeImage(idx)}>
                            ×
                          </button>
                          {idx === 0 && <span className="primary-tag">Primary</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="upload-btn">
                    <IconUpload />
                    {imageFiles.length ? "Add more images" : "Upload images"}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      onChange={handleImageSelect}
                      style={{ display: "none" }}
                    />
                  </label>
                  <div className="upload-hint">JPEG, PNG, GIF, WebP · max 5MB each</div>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>SKU *</label>
                  <input
                    required
                    value={form.sku}
                    onChange={(e) => setField("sku", e.target.value)}
                    placeholder="e.g. SKU-001"
                  />
                </div>
                <div className="form-field">
                  <label>Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="Product name"
                  />
                </div>
                <div className="form-field">
                  <label>Barcode</label>
                  <input value={form.barcode} onChange={(e) => setField("barcode", e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Serial</label>
                  <input value={form.serial} onChange={(e) => setField("serial", e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <select value={form.category_id} onChange={(e) => setField("category_id", e.target.value)}>
                    <option value="">— None —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Warehouse</label>
                  <select value={form.warehouse_id} onChange={(e) => setField("warehouse_id", e.target.value)}>
                    <option value="">— None —</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name ? `${w.code} — ${w.name}` : w.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Supplier</label>
                  <select value={form.supplier_id} onChange={(e) => setField("supplier_id", e.target.value)}>
                    <option value="">— None —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.qty}
                    onChange={(e) => setField("qty", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Min stock</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.min_stock}
                    onChange={(e) => setField("min_stock", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Max stock</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.max_stock}
                    onChange={(e) => setField("max_stock", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setField("price", e.target.value)}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : modalMode === "add" ? "Add Product" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="modal confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ justifyContent: "center" }}>
              <h2>Delete product?</h2>
            </div>
            <p>
              <strong>{confirmDelete.name}</strong> ({confirmDelete.sku}) will be permanently removed from
              inventory. This cannot be undone.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product detail modal */}
      {viewProduct && (() => {
        const p = viewProduct;
        const catName = p.category?.name ?? "—";
        const colors = CAT_COLORS[catName] || CAT_COLORS.Hardware;
        const displayStatus = getDisplayStatus(p);
        const qty = num(p.qty);
        const price = num(p.price);
        const value = p.stock_value ?? qty * price;
        const imageUrls = getAllImageUrls(p);
        const activeUrl = imageUrls[viewImageIndex] ?? null;

        return (
          <div className="modal-overlay" onClick={closeView}>
            <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Product details</h2>
                <button type="button" className="btn btn-secondary btn-icon" onClick={closeView}>
                  <IconX />
                </button>
              </div>

              <div className="detail-layout">
                <div className="detail-gallery">
                  <div
                    className="detail-hero"
                    style={{ background: colors.bg, color: colors.fg }}
                  >
                    {activeUrl ? (
                      <img src={activeUrl} alt={p.name} />
                    ) : (
                      <IconBox />
                    )}
                  </div>
                  {imageUrls.length > 1 && (
                    <div className="detail-thumbs">
                      {imageUrls.map((url, idx) => (
                        <button
                          key={url + idx}
                          type="button"
                          className={`detail-thumb ${idx === viewImageIndex ? "active" : ""}`}
                          onClick={() => setViewImageIndex(idx)}
                        >
                          <img src={url} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="detail-body">
                  <div className="detail-title-row">
                    <div>
                      <div className="detail-sku">{p.sku}</div>
                      <h3 className="detail-name">{p.name}</h3>
                    </div>
                    <span className={`status-badge status-${displayStatus}`}>
                      {displayStatus.replace("-", " ")}
                    </span>
                  </div>

                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Category</span>
                      <span className="detail-value">
                        <span className="cat-chip" style={{ background: colors.bg, color: colors.fg }}>
                          {catName}
                        </span>
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Warehouse</span>
                      <span className="detail-value">{p.warehouse?.code ?? "—"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Supplier</span>
                      <span className="detail-value">{p.supplier?.name ?? "—"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Barcode</span>
                      <span className="detail-value">{p.barcode || "—"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Serial</span>
                      <span className="detail-value">{p.serial || "—"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Status</span>
                      <span className="detail-value" style={{ textTransform: "capitalize" }}>
                        {p.status || "—"}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Quantity</span>
                      <span className="detail-value fw-600">{qty.toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Min / Max stock</span>
                      <span className="detail-value">
                        {num(p.min_stock).toLocaleString()} / {num(p.max_stock).toLocaleString()}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Unit price</span>
                      <span className="detail-value">{formatPeso(price, 2)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Stock value</span>
                      <span className="detail-value fw-600">
                        {formatPeso(value)}
                      </span>
                    </div>
                  </div>

                  <div className="detail-actions">
                    <button type="button" className="btn btn-secondary" onClick={closeView}>
                      Close
                    </button>
                    {canUpdate && (
                    <button type="button" className="btn btn-primary" onClick={openEditFromView}>
                      <IconEdit /> Edit product
                    </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Category create / edit modal */}
      {catModalOpen && (
        <div className="modal-overlay" onClick={closeCatModal}>
          <div className="modal confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? "Edit Category" : "Add Category"}</h2>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={closeCatModal}
                disabled={catSaving}
              >
                <IconX />
              </button>
            </div>
            {catError && <div className="form-error">{catError}</div>}
            <form onSubmit={handleSaveCategory}>
              <div className="form-field full" style={{ marginBottom: 16 }}>
                <label>Category name *</label>
                <input
                  required
                  autoFocus
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Electronics"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeCatModal} disabled={catSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={catSaving}>
                  {catSaving ? "Saving…" : editingCategory ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category delete confirmation */}
      {confirmDeleteCat && (
        <div className="modal-overlay" onClick={() => !deletingCat && setConfirmDeleteCat(null)}>
          <div className="modal confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ justifyContent: "center" }}>
              <h2>Delete category?</h2>
            </div>
            <p>
              <strong>{confirmDeleteCat.name}</strong> will be permanently removed. Products using this
              category will keep their data but appear as uncategorized until reassigned.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDeleteCat(null)}
                disabled={deletingCat}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteCategory}
                disabled={deletingCat}
              >
                {deletingCat ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`inv-toast ${toast.type}`}>
          <strong>{toast.title}</strong>
          {toast.message && <span>{toast.message}</span>}
        </div>
      )}
    </div>
  );
}

export default Inventory;