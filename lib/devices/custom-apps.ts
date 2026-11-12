import {
  deviceAppIdFromTarget,
  isAbsoluteAppPath,
  type DeviceAppInfo,
} from "./commands"

export const DEVICE_CUSTOM_APPS_MAX = 50
export const DEVICE_CUSTOM_APP_NAME_MAX_LENGTH = 80

export type DeviceCustomApp = {
  name: string
  path: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Normaliza a lista de apps personalizados vinda do banco. Entradas inválidas
 * são descartadas em vez de derrubar a listagem inteira.
 */
export function parseDeviceCustomApps(value: unknown): DeviceCustomApp[] {
  if (!Array.isArray(value)) {
    return []
  }

  const apps: DeviceCustomApp[] = []
  const seenIds = new Set<string>()

  for (const entry of value) {
    if (apps.length >= DEVICE_CUSTOM_APPS_MAX) {
      break
    }

    if (!isRecord(entry)) {
      continue
    }

    const name = typeof entry.name === "string" ? entry.name.trim() : ""
    const path = typeof entry.path === "string" ? entry.path.trim() : ""

    if (
      name.length === 0 ||
      name.length > DEVICE_CUSTOM_APP_NAME_MAX_LENGTH ||
      path.length === 0 ||
      path.length > 1024 ||
      !isAbsoluteAppPath(path) ||
      /[\u0000-\u001f\u007f]/.test(name + path)
    ) {
      continue
    }

    const id = deviceAppIdFromTarget(name, path)

    if (seenIds.has(id)) {
      continue
    }

    seenIds.add(id)
    apps.push({ name, path })
  }

  return apps
}

export function toCustomAppInfo(app: DeviceCustomApp): DeviceAppInfo {
  return {
    id: deviceAppIdFromTarget(app.name, app.path),
    name: app.name,
    source: "custom",
    target: app.path,
  }
}

export function findCustomApp(
  apps: readonly DeviceCustomApp[],
  appId: string,
): DeviceCustomApp | undefined {
  return apps.find((app) => deviceAppIdFromTarget(app.name, app.path) === appId)
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function matchCustomApps(
  apps: readonly DeviceCustomApp[],
  query: string | undefined,
  limit: number,
): DeviceAppInfo[] {
  const needle = query ? normalize(query.trim()) : ""
  const matches = apps
    .map(toCustomAppInfo)
    .filter((app) => {
      if (needle.length === 0) {
        return true
      }

      return (
        normalize(app.id).includes(needle) ||
        normalize(app.name).includes(needle) ||
        (app.target ? normalize(app.target).includes(needle) : false)
      )
    })

  return matches.slice(0, Math.max(1, limit))
}
