"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import {
  THEME_STORAGE_KEY,
  isTheme,
  type Theme,
} from "@/lib/theme"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const themeListeners = new Set<() => void>()

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener)
  window.addEventListener("storage", listener)

  return () => {
    themeListeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function notifyThemeChange() {
  for (const listener of themeListeners) {
    listener()
  }
}

function getStoredTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)

  return isTheme(stored) ? stored : "system"
}

function getServerTheme(): Theme {
  return "system"
}

function resolveTheme(theme: Theme) {
  if (theme !== "system") {
    return theme
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme)

  document.documentElement.classList.toggle("dark", resolved === "dark")
  document.documentElement.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // O tema persistido vive no localStorage, uma fonte externa ao React. O
  // snapshot do servidor é "system" para não quebrar a hidratação.
  const theme = useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    getServerTheme,
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (theme !== "system") {
      return
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => applyTheme("system")

    query.addEventListener("change", handleChange)

    return () => query.removeEventListener("change", handleChange)
  }, [theme])

  const setTheme = useCallback((nextTheme: Theme) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    applyTheme(nextTheme)
    notifyThemeChange()
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export {
  THEME_STORAGE_KEY,
  type Theme,
  type ResolvedTheme,
} from "@/lib/theme"

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider")
  }

  return context
}
