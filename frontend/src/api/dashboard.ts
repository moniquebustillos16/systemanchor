import api from "./axios";

/** Dashboard range query used by GET /dashboard */
export type DashboardRange = "3m" | "7m" | "1y";

/**
 * Full operations overview from DashboardController.
 * Shape is large; keep as Record for now — pages already map fields.
 */
export type DashboardPayload = Record<string, unknown>;

/** GET /dashboard?range= */
export async function getDashboard(
  range: DashboardRange | string = "7m"
): Promise<DashboardPayload> {
  const { data } = await api.get("/dashboard", {
    params: { range },
  });
  return data as DashboardPayload;
}