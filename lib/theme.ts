export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "spectral-theme";

export function isTheme(value: string | null): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Lê o tema armazenado no localStorage do navegador.
 * Deve ser usado apenas no cliente.
 */
export function readStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "system";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : "system";
}

/**
 * Resolve o tema efetivo aplicado no documento (`<html class="dark">`).
 * Útil quando a preferência é "system": revela se o SO está em dark ou light.
 * Deve ser usado apenas no cliente.
 */
export function getResolvedTheme(): ResolvedTheme | null {
  if (typeof window === "undefined") {
    return null;
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
