import type { DeviceSummary } from "./types"
import { isDeviceOnline } from "./types"

type DeviceRow = {
  id: string
  name: string
  hostname: string | null
  platform: string
  architecture: string | null
  fingerprint: string
  lastSeenAt: Date | null
  createdAt: Date
  defaultWorkingDirectory: string | null
}

export function toDeviceSummary(device: DeviceRow): DeviceSummary {
  return {
    id: device.id,
    name: device.name,
    hostname: device.hostname,
    platform: device.platform,
    architecture: device.architecture,
    fingerprint: device.fingerprint,
    status: isDeviceOnline(device.lastSeenAt) ? "online" : "offline",
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    defaultWorkingDirectory: device.defaultWorkingDirectory ?? null,
  }
}
