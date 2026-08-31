import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { usePermissions } from "../../hooks/useCurrentUser";
import {
  useInventoryPage,
  useInventoryCategories,
  fetchInventoryDetailCached,
} from "../../hooks/useInventory";
import {
  createInventory,
  updateInventory,
  deleteInventory,
} from "../../api/inventory";
import { useQuery } from "@tanstack/react-query";
import { queryClient, queryKeys } from "../../lib/queryClient";
import { getWarehouses } from "../../api/warehouses";
import { getSuppliers } from "../../api/partners";
import { invalidateInventory } from "../../lib/invalidate";
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

/** Resolve API origin from axios baseURL (falls back to current page origin). */
function apiOrigin(): string {
  const base = String((api as { defaults?: { baseURL?: string } })?.defaults?.baseURL || "");
  try {
    if (/^https?:\/\//i.test(base)) return new URL(base).origin;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

/**
 * Build a working image URL.
 * - Absolute URLs pointing at localhost/127.0.0.1 are rewritten to the API origin
 * - Relative /storage/... paths are prefixed with the API origin
 */
function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const origin = apiOrigin();

  if (/^https?:\/\//i.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
    try {
      const u = new URL(url);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        return origin ? `${origin}${u.pathname}${u.search}` : u.pathname + u.search;
      }
    } catch {
      /* keep as-is */
    }
    return url;
  }

  const path = url.startsWith("/") ? url : `/${url}`;
  return origin ? `${origin}${path}` : path;
}

/** Resolve image URL from an image object (supports url, path, camelCase). */
function imageSrc(img: ProductImage | null | undefined): string | null {
  if (!img) return null;
  const raw =
    img.image_url ||
    (img as { url?: string }).url ||
    img.image_path ||
    null;
  return normalizeImageUrl(raw);
}

function getPrimaryImageUrl(p: Product): string | null {
  // Support both snake_case and camelCase relation keys from Laravel
  const primary =
    p.primary_image ??
    (p as { primaryImage?: ProductImage | null }).primaryImage ??
    null;
  const fromPrimary = imageSrc(primary);
  if (fromPrimary) return fromPrimary;

  const imgs = p.images ?? [];
  const preferred = imgs.find((i) => i.is_primary) ?? imgs[0];
  return imageSrc(preferred);
}

function getAllImageUrls(p: Product): string[] {
  const imgs = p.images ?? [];
  const sorted = [...imgs].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const urls = sorted
    .map((i) => imageSrc(i))
    .filter((u): u is string => !!u);
  if (urls.length === 0) {
    const primary = getPrimaryImageUrl(p);
    if (primary) urls.push(primary);
  }
  return urls;
}

/** Normalize API product so images always have usable image_url + snake_case keys. */
function normalizeProductImages(p: Product): Product {
  const anyP = p as Product & { primaryImage?: ProductImage | null };
  const primaryRaw = p.primary_image ?? anyP.primaryImage ?? null;
  const imgsRaw = p.images ?? [];

  const fixImg = (img: ProductImage | null | undefined): ProductImage | null => {
    if (!img) return null;
    const path = img.image_path || null;
    const url = img.image_url || (path ? (path.startsWith("/") ? path : `/storage/${path}`) : null);
    return { ...img, image_path: path || img.image_path, image_url: url };
  };

  const images = imgsRaw.map((i) => fixImg(i)!).filter(Boolean);
  const primary_image = fixImg(primaryRaw) ?? images.find((i) => i.is_primary) ?? images[0] ?? null;

  return {
    ...p,
    images,
    primary_image,
  };
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
/* List/stats owned by TanStack Query (useInventoryPage).
 * Detail (View/Edit images) uses queryKeys.inventory.detail via fetchInventoryDetailCached.
 */
let invHasShownData = false;

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
  
 
  // Sales Orders pattern: "all" → null (API scopes non-admins)
  const effectiveWarehouseId =
    filterWh === "all" || !filterWh ? null : filterWh;

    
  
    const {
      
    stats: queryStats,
    list,
    isLoading: invLoading,
    isFetching: invFetching,
    refetchAll,

    
  } = useInventoryPage({
  page,
  perPage: pageSize,
  search: debouncedSearch,
  status: filterStatus === "all" ? "" : filterStatus,
  categoryId: filterCat === "all" ? null : filterCat,
  warehouseId: effectiveWarehouseId,
  sort: sortKey === "status" ? "sku" : sortKey,
  dir: sortAsc ? "asc" : "desc",
});
    
  /* Server data: TanStack Query is the single source of truth.
   * optimisticProducts is only a short-lived UI overlay for create/edit/delete;
   * it is cleared whenever list.rows updates from the server. */
  const [optimisticProducts, setOptimisticProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter meta via TanStack Query (single source of truth)
  const categoriesQuery = useInventoryCategories({ enabled: true });
  const warehousesQuery = useQuery({
    queryKey: queryKeys.warehouses.list({ per_page: 200, all: 1 }),
    queryFn: () => getWarehouses({ per_page: 200, all: 1 }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const suppliersQuery = useQuery({
    queryKey: queryKeys.suppliers.list({ per_page: 100 }),
    queryFn: () => getSuppliers({ per_page: 100 }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const allCategories: Category[] = useMemo(() => {
    const raw = categoriesQuery.data ?? [];
    return (Array.isArray(raw) ? raw : []).map((c: any) => ({
      id: String(c.id),
      name: String(c.name ?? ""),
    }));
  }, [categoriesQuery.data]);

    const allWarehouses: Warehouse[] = useMemo(() => {
    const raw = warehousesQuery.data as any;
    const arr = Array.isArray(raw) ? raw : raw?.data ?? raw?.data?.data ?? [];
    return (arr as any[]).map((w) => ({
      id: String(w.id),
      name: String(w.name ?? w.code ?? ""),
      code: w.code != null ? String(w.code) : "",
    }));
  }, [warehousesQuery.data]);

  const allSuppliers: Supplier[] = useMemo(() => {
    const raw = suppliersQuery.data as any;
    const arr = Array.isArray(raw) ? raw : raw?.data ?? raw?.data?.data ?? [];
    return (arr as any[])
      .map((s) => ({ id: String(s.id), name: String(s.name ?? "") }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliersQuery.data]);

  const metaLoading =
    categoriesQuery.isLoading || warehousesQuery.isLoading || suppliersQuery.isLoading;
  // Sales Orders pattern: filter options = useWarehouses list (API scopes non-admins)
const warehousesForFilter = allWarehouses;
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<Category | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [viewImageIndex, setViewImageIndex] = useState(0);

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

  const { can, isLoaded: permsLoaded } = usePermissions();




  
// Sales Orders: keep filter default "all"
  
  const canView = can("inventory.view", "inventories.view", "products.view");
  const canCreate = can("inventory.create", "inventories.create", "products.create");
  const canUpdate = can("inventory.update", "inventories.update", "products.update");
  const canDelete = can("inventory.delete", "inventories.delete", "products.delete");
     const canManageCategories = can("categories.create",
    "categories.update",
    "categories.delete",
    "inventory.create",
    "inventory.update"
  );

  /* ── List + stats: TanStack Query is the single source of truth ── */
  const serverProducts: Product[] = useMemo(() => {
    if (!list.rows) return [];
    // Keep previous rows while a fetch is in progress (placeholderData on the query
    // already preserves prior pages; empty+loading → show nothing until first paint)
    if (list.rows.length === 0 && invLoading) return [];
    return (list.rows as Product[]).map((r) => normalizeProductImages(r));
  }, [list.rows, invLoading]);

  // Drop optimistic overlay when server list updates
  useEffect(() => {
    setOptimisticProducts(null);
    setError(null);
  }, [list.rows, list.meta.total, list.meta.last_page]);

  const products: Product[] = optimisticProducts ?? serverProducts;
  const total = list.meta.total;
  const lastPage = list.meta.last_page;
  const stats: Stats | null = useMemo(
    () =>
      queryStats
        ? {
            total_products: queryStats.total_products,
            low_stock: queryStats.low_stock,
            out_of_stock: queryStats.out_of_stock,
            inventory_value: queryStats.inventory_value,
          }
        : null,
    [queryStats]
  );
  // Skeletons only when we have no rows to show yet
  const loading = products.length === 0 && invLoading;

  // Once we have shown any data this session, never use full-page loader again
  const hasDataRef = useRef(
    products.length > 0 || total > 0 || !!stats
  );

  useEffect(() => {
    if (products.length > 0 || total > 0) {
      hasDataRef.current = true;
    }
  }, [products.length, total]);

  // Module-level flag: once true, stays true for the whole tab session
  // even after navigate away and back to Inventory
  if (products.length > 0 || total > 0) {
    invHasShownData = true;
  }
  if (!invHasShownData && (products.length > 0 || !!stats)) {
    invHasShownData = true;
  }

  const pageLoading =
    tab === "products" &&
    !invHasShownData &&
    products.length === 0 &&
    invLoading;

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [imagePreviews]);

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
    setExistingImages([]);
    setDeletingImageId(null);
  };

  /** Delete a saved product image — optimistic remove, rollback on failure. */
  const removeExistingImage = async (img: ProductImage) => {
    if (!img?.id) return;
    setDeletingImageId(img.id);

    const prevExisting = existingImages;
    const prevProducts = products;
    const prevView = viewProduct;

    // Optimistic: remove from UI immediately
    setExistingImages((prev) => prev.filter((i) => i.id !== img.id));
    setOptimisticProducts((prev) =>
      (prev ?? products).map((p) => {
        if (!p.images?.some((i) => i.id === img.id) && p.primary_image?.id !== img.id) {
          return p;
        }
        const images = (p.images ?? []).filter((i) => i.id !== img.id);
        const primary =
          p.primary_image?.id === img.id
            ? images.find((i) => i.is_primary) ?? images[0] ?? null
            : p.primary_image;
        return { ...p, images, primary_image: primary };
      })
    );
    setViewProduct((vp) => {
      if (!vp) return vp;
      if (!vp.images?.some((i) => i.id === img.id) && vp.primary_image?.id !== img.id) return vp;
      const images = (vp.images ?? []).filter((i) => i.id !== img.id);
      const primary =
        vp.primary_image?.id === img.id
          ? images.find((i) => i.is_primary) ?? images[0] ?? null
          : vp.primary_image;
      return { ...vp, images, primary_image: primary };
    });
    showToast("success", "Image deleted", "The product image was removed.");

    try {
      await api.delete(`/product-images/${img.id}`);
    } catch (err: any) {
      // Rollback
      setExistingImages(prevExisting);
      setOptimisticProducts(prevProducts);
      setViewProduct(prevView);
      const body = err?.response?.data;
      showToast(
        "error",
        "Delete failed",
        (typeof body === "string" ? body : body?.message) || err?.message || "Could not delete image"
      );
    } finally {
      setDeletingImageId(null);
    }
  };

  /** Set an existing image as primary — optimistic, rollback on failure. */
  const setImageAsPrimary = async (img: ProductImage) => {
    if (!img?.id || img.is_primary) return;

    const prevExisting = existingImages;
    const prevProducts = products;

    // Optimistic: mark as primary in UI immediately
    setExistingImages((prev) =>
      prev.map((i) => ({ ...i, is_primary: i.id === img.id }))
    );
    setOptimisticProducts((prev) =>
      (prev ?? products).map((p) => {
        if (!p.images?.some((i) => i.id === img.id)) return p;
        const images = (p.images ?? []).map((i) => ({
          ...i,
          is_primary: i.id === img.id,
        }));
        const primary = images.find((i) => i.id === img.id) ?? null;
        return { ...p, images, primary_image: primary };
      })
    );
    showToast("success", "Primary image updated", "This image is now the primary.");

    try {
      await api.post(`/product-images/${img.id}/primary`);
    } catch (err: any) {
      setExistingImages(prevExisting);
      setOptimisticProducts(prevProducts);
      const body = err?.response?.data;
      showToast(
        "error",
        "Update failed",
        (typeof body === "string" ? body : body?.message) || err?.message || "Could not set primary"
      );
    }
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
    const editing = editingCategory;

    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, { name });
        showToast("success", "Category updated", `"${name}" has been saved.`);
      } else {
        await api.post("/categories", { name });
        showToast("success", "Category created", `"${name}" is now available.`);
      }
      setCatModalOpen(false);
      setCatName("");
      setEditingCategory(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    } catch (err: any) {
      const body = err.response?.data;
      const msg =
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        body?.message ||
        err.message ||
        "Failed to save category";
      showToast("error", "Category save failed", msg);
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!confirmDeleteCat) return;
    const doomed = confirmDeleteCat;
    setDeletingCat(true);
    try {
      await api.delete(`/categories/${doomed.id}`);
      if (filterCat === doomed.id) setFilterCat("all");
      setConfirmDeleteCat(null);
      showToast("success", "Category deleted", `"${doomed.name}" was removed.`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      void refetchAll();
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

    const source = p;

    setModalMode("edit");
    setEditingId(source.id);
    setForm(productToForm(source));
    setFormError(null);
    clearImages();
    setModalOpen(true);

    const applyImages = (prod: Product) => {
      const imgs = [...(prod.images ?? [])].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
      setExistingImages(imgs);
    };

    if ((source.images?.length ?? 0) > 0) {
      applyImages(source);
      return;
    }

    // TanStack Query detail cache (queryKeys.inventory.detail)
    void fetchInventoryDetailCached(source.id)
      .then((raw) => {
        const full = raw as unknown as Product;
        if (!full?.images) return;
        const normalized = normalizeProductImages(full);
        setEditingId((currentId) => {
          if (currentId === source.id) applyImages(normalized);
          return currentId;
        });
      })
      .catch(() => {});
  };
  const openView = (p: Product) => {
    const initial = p;

    setViewProduct(initial);
    setViewImageIndex(0);

    const hasImages = (initial.images?.length ?? 0) > 0;
    if (hasImages || !p.id) return;

    const requestedId = String(p.id);

    void fetchInventoryDetailCached(p.id)
      .then((raw) => {
        const full = raw as unknown as Product;
        if (!full?.id) return;
        const normalized = normalizeProductImages(full);
        setViewProduct((current) => {
          if (!current) return current;
          if (String(current.id) !== requestedId) return current;
          return normalized;
        });
      })
      .catch(() => {});
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

  const enrichProduct = useCallback(
    (raw: Partial<Product> & { id: string }): Product => {
      const catId = raw.category_id ?? raw.category?.id ?? null;
      const whId = raw.warehouse_id ?? raw.warehouse?.id ?? null;
      const supId = raw.supplier_id ?? raw.supplier?.id ?? null;
      const category =
        raw.category ??
        (catId ? allCategories.find((c) => c.id === String(catId)) ?? null : null);
      const warehouse =
        raw.warehouse ??
        (whId ? allWarehouses.find((w) => w.id === String(whId)) ?? null : null);
      const supplier =
        raw.supplier ??
        (supId ? allSuppliers.find((s) => s.id === String(supId)) ?? null : null);
      const qty = num(raw.qty);
      const price = num(raw.price);
      const min = num(raw.min_stock);
      let display_status: DisplayStatus = "active";
      if (qty <= 0) display_status = "out-of-stock";
      else if (qty < min) display_status = "low-stock";
      return {
        id: raw.id,
        sku: raw.sku ?? "",
        name: raw.name ?? "",
        barcode: raw.barcode ?? null,
        serial: raw.serial ?? null,
        category_id: catId ? String(catId) : null,
        warehouse_id: whId ? String(whId) : null,
        supplier_id: supId ? String(supId) : null,
        qty: raw.qty ?? 0,
        min_stock: raw.min_stock ?? 0,
        max_stock: raw.max_stock ?? 0,
        price: raw.price ?? 0,
        status: raw.status || "active",
        display_status,
        stock_value: qty * price,
        category: category as Category | null,
        warehouse: warehouse as Warehouse | null,
        supplier: supplier as Supplier | null,
        images: raw.images,
        primary_image: raw.primary_image,
      };
    },
    [allCategories, allWarehouses, allSuppliers]
  );

  /**
   * Create / Update product — optimistic UI.
   * - UI updates immediately (list + close modal + toast).
   * - API runs in background; on failure: rollback list + error toast.
   * - Create uses a temporary id until the server returns the real one.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.sku.trim() || !form.name.trim()) {
      setFormError("SKU and Product name are required.");
      return;
    }

    const payload = buildPayload();
    const pendingImages = [...imageFiles];
    setSaving(true);

    if (modalMode === "add") {
      // ── Optimistic create ──────────────────────────────────
      const tempId = `temp-${Date.now()}`;
      const optimisticRow = enrichProduct({
        ...payload,
        id: tempId,
        images: [],
        primary_image: null,
      });

      const prevRows = products;
      
      setOptimisticProducts((prev) => [optimisticRow, ...(prev ?? products)]);
      setModalOpen(false);
      setForm(emptyForm());
      clearImages();
      showToast("success", "Product added", `${payload.name} is now in inventory.`);
      setSaving(false);

      try {
        let created: any;
        try {
          created = await createInventory(payload);
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

        const body = (created?.data ?? created) as Partial<Product> & { id?: string };
        const productId = body?.id ?? (created as { id?: string })?.id;
        if (!productId) throw new Error("Product created but no ID returned");

        // Upload images after we have a real id
        if (pendingImages.length > 0) {
          const formData = new FormData();
          formData.append("product_id", String(productId));
          pendingImages.forEach((file) => formData.append("images[]", file));
          formData.append("is_primary", "1");
          try {
            await api.post("/product-images", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          } catch (imgErr) {
            // Product exists without images — keep row, warn user
            console.error("[Inventory] image upload after create failed:", imgErr);
            showToast(
              "error",
              "Images not uploaded",
              "Product was saved but image upload failed. You can add images via Edit."
            );
          }
        }

        // Replace temp row with server data
        const realRow = enrichProduct({ ...payload, ...body, id: String(productId) });
        setOptimisticProducts((prev) => (prev ?? products).map((p) => (p.id === tempId ? realRow : p)));
        /* Query invalidation handles cache */
        void refetchAll();
        void invalidateInventory();
      } catch (err: any) {
        // Rollback optimistic create
        setOptimisticProducts(prevRows);
        console.error("[Inventory] create failed:", err);
        const body = err?.response?.data;
        const msg =
          (body?.errors && Object.values(body.errors).flat().join(" ")) ||
          body?.message ||
          (err instanceof Error ? err.message : null) ||
          "Failed to save product";
        showToast("error", "Create failed", msg);
      }
      return;
    }

    if (modalMode === "edit" && editingId) {
      // ── Optimistic edit ────────────────────────────────────
      const prevSnapshot = products.find((p) => p.id === editingId);
      const optimistic = enrichProduct({
        ...(prevSnapshot || {}),
        ...payload,
        id: editingId,
      });

      setOptimisticProducts((prev) => (prev ?? products).map((p) => (p.id === editingId ? optimistic : p)));
      setModalOpen(false);
      setForm(emptyForm());
      clearImages();
      showToast("success", "Product updated", `${payload.name} has been saved.`);
      setSaving(false);

      try {
        const body = (await updateInventory(
          editingId,
          payload
        )) as Partial<Product> & { id?: string };

        if (pendingImages.length > 0) {
          const formData = new FormData();
          formData.append("product_id", editingId);
          pendingImages.forEach((file) => formData.append("images[]", file));
          formData.append("is_primary", existingImages.length === 0 ? "1" : "0");
          try {
            await api.post("/product-images", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          } catch (imgErr) {
            console.error("[Inventory] image upload after update failed:", imgErr);
            showToast(
              "error",
              "Images not uploaded",
              "Product was saved but image upload failed."
            );
          }
        }

        // Merge authoritative server body
        if (body && body.id) {
          setOptimisticProducts((prev) =>
      (prev ?? products).map((p) =>
              p.id === editingId
                ? enrichProduct({ ...optimistic, ...body, id: String(body.id) })
                : p
            )
          );
        }
        /* Query invalidation handles cache */
        void refetchAll();
        if (editingId) {
          void queryClient.removeQueries({
            queryKey: queryKeys.inventory.detail(String(editingId)),
          });
        }
        void invalidateInventory();
      } catch (err: any) {
        // Rollback optimistic edit
        if (prevSnapshot) {
          setOptimisticProducts((prev) => (prev ?? products).map((p) => (p.id === editingId ? prevSnapshot : p)));
        }
        console.error("[Inventory] update failed:", err);
        const body = err?.response?.data;
        const msg =
          (body?.errors && Object.values(body.errors).flat().join(" ")) ||
          body?.message ||
          (err instanceof Error ? err.message : null) ||
          "Failed to update product";
        showToast("error", "Update failed", msg);
      }
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      showToast("error", "Permission denied", "You cannot delete products.");
      return;
    }
    if (!confirmDelete) return;
    const doomed = confirmDelete;
    setDeleting(true);

    const prevRows = products;
        setOptimisticProducts((prev) => (prev ?? products).filter((p) => p.id !== doomed.id));
    setConfirmDelete(null);
    showToast("success", "Product deleted", `${doomed.name} was removed.`);

    try {
      await deleteInventory(doomed.id);
      /* Query invalidation handles cache */
      void refetchAll();
      void queryClient.removeQueries({ queryKey: queryKeys.inventory.detail(String(doomed.id)) });
      void invalidateInventory();
    } catch (err: any) {
      setOptimisticProducts(prevRows);
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

  if (pageLoading) {
    return (
      <div className="inventory-page">
        <Sidebar />
        <div className="main-wrapper">
          <Topbar />
          <main className="content">
            <div
              style={{
                minHeight: "calc(100vh - 120px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: 32,
              }}
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div
                className="roles-spinner"
                style={{ width: 36, height: 36, borderWidth: 3 }}
              />
              <div style={{ textAlign: "center", maxWidth: 320 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    marginBottom: 6,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Loading inventory
                </div>
                <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  Fetching products, stock levels, and warehouse data…
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
                  void refetchAll();
                  /* meta via Query */
                }}
                disabled={invFetching || metaLoading}
              >
                <IconRefresh /> {invFetching ? "Refreshing…" : "Refresh"}
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
  <option value="all">All sites</option>
  {warehousesForFilter.map((w) => (
    <option key={w.id} value={w.id}>
      {w.name ? `${w.code} — ${w.name}` : (w.code || "(No name)")}
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
                  {(existingImages.length > 0 || imagePreviews.length > 0) && (
                    <div className="preview-row">
                      {existingImages.map((img) => {
                        const url = normalizeImageUrl(img.image_url);
                        return (
                          <div key={img.id} className="preview-item">
                            {url ? (
                              <img src={url} alt={img.file_name || "product"} />
                            ) : (
                              <div className="skel" style={{ width: "100%", height: "100%" }} />
                            )}
                            <button
                              type="button"
                              className="rm"
                              title="Delete image"
                              disabled={deletingImageId === img.id || saving}
                              onClick={() => removeExistingImage(img)}
                            >
                              {deletingImageId === img.id ? "…" : "×"}
                            </button>
                            {img.is_primary ? (
                              <span className="primary-tag">Primary</span>
                            ) : (
                              <button
                                type="button"
                                className="primary-tag"
                                style={{ cursor: "pointer", border: "none" }}
                                title="Set as primary"
                                disabled={saving}
                                onClick={() => setImageAsPrimary(img)}
                              >
                                Set primary
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {imagePreviews.map((url, idx) => (
                        <div key={`new-${idx}`} className="preview-item">
                          <img src={url} alt={`new-${idx}`} />
                          <button type="button" className="rm" onClick={() => removeImage(idx)} disabled={saving}>
                            ×
                          </button>
                          {existingImages.length === 0 && idx === 0 && (
                            <span className="primary-tag">Primary</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="upload-btn">
                    <IconUpload />
                    {existingImages.length || imageFiles.length ? "Add more images" : "Upload images"}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      onChange={handleImageSelect}
                      style={{ display: "none" }}
                      disabled={saving}
                    />
                  </label>
                  <div className="upload-hint">JPEG, PNG, GIF, WebP · max 5MB each · click × to delete · Set primary on existing images</div>
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