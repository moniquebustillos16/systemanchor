export { default as api } from "./axios";

export * from "./types";
export * from "./auth";
export * from "./dashboard";

export {
  getInventoryStats,
  getInventoryList,
  getInventoryItem,
  createInventory,
  updateInventory,
  deleteInventory,
  getCategories,
  type InventoryListParams,
  type InventoryStats,
} from "./inventory";

export * from "./stockMovements";
export * from "./orders";
export * from "./warehouses";