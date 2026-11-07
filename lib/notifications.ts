export type NotificationPermissionState = "granted" | "denied" | "default"

export type NotificationChannel = "native" | "in-app" | "none"

export const NOTIFICATIONS_ENABLED_KEY = "spectral:notifications:enabled"
export const NOTIFICATIONS_ASKED_KEY = "spectral:notifications:asked"

export const NOTIFICATION_PREVIEW_LENGTH = 100

function readBoolean(key: string): boolean {
  if (typeof window === "undefined") {
    return false
  }

  try {
    return window.localStorage.getItem(key) === "true"
  } catch {
    return false
  }
}

function writeBoolean(key: string, value: boolean): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(key, value ? "true" : "false")
  } catch {
    // localStorage indisponível (modo privado, storage cheio, etc.)
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

export function readNotificationEnabled(): boolean {
  return readBoolean(NOTIFICATIONS_ENABLED_KEY)
}

export function writeNotificationEnabled(enabled: boolean): void {
  writeBoolean(NOTIFICATIONS_ENABLED_KEY, enabled)
}

export function readNotificationAsked(): boolean {
  return readBoolean(NOTIFICATIONS_ASKED_KEY)
}

export function writeNotificationAsked(asked: boolean): void {
  writeBoolean(NOTIFICATIONS_ASKED_KEY, asked)
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) {
    return "default"
  }

  return window.Notification.permission
}

type ResolveNotificationChannelInput = {
  enabled: boolean
  permission: NotificationPermissionState
  supported: boolean
  visibilityState: DocumentVisibilityState
}

/**
 * Decide como avisar o usuário:
 * - `native`: aba em segundo plano com permissão concedida
 * - `in-app`: aba visível (toast discreto)
 * - `none`: desativado, sem permissão ou sem suporte
 */
export function resolveNotificationChannel({
  enabled,
  permission,
  supported,
  visibilityState,
}: ResolveNotificationChannelInput): NotificationChannel {
  if (!supported || !enabled || permission !== "granted") {
    return "none"
  }

  return visibilityState === "hidden" ? "native" : "in-app"
}

export function buildNotificationPreview(
  text: string,
  maxLength = NOTIFICATION_PREVIEW_LENGTH,
): string {
  const normalized = text.replace(/\s+/g, " ").trim()

  if (!normalized) {
    return ""
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength).trimEnd()}…`
}
