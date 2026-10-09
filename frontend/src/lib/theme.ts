export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const PREFERENCE_KEY = "sa-theme-preference";
const RESOLVED_KEY = "sa-theme";

let systemQuery: MediaQueryList | null = null;
let systemListener: ((event: MediaQueryListEvent) => void) | null = null;

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function commitTheme(preference: ThemePreference, resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
  localStorage.setItem(RESOLVED_KEY, resolved);
  window.dispatchEvent(
    new CustomEvent("sa-theme-changed", { detail: { preference, resolved } })
  );
}

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(PREFERENCE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;

  const legacy = localStorage.getItem(RESOLVED_KEY);
  if (legacy === "light" || legacy === "dark") return legacy;
  return "system";
}

export function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  localStorage.setItem(PREFERENCE_KEY, preference);

  if (systemQuery && systemListener) {
    systemQuery.removeEventListener("change", systemListener);
  }

  const resolved = resolveTheme(preference);
  commitTheme(preference, resolved);

  if (preference === "system") {
    systemQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemListener = (event) => {
      commitTheme("system", event.matches ? "dark" : "light");
    };
    systemQuery.addEventListener("change", systemListener);
  } else {
    systemQuery = null;
    systemListener = null;
  }

  return resolved;
}