import { DEVICE_ONLINE_WINDOW_MS } from "./constants"

export type DeviceStatus = "online" | "offline"

export type DeviceSummary = {
  id: string
  name: string
  hostname: string | null
  platform: string
  architecture: string | null
  fingerprint: string
  status: DeviceStatus
  lastSeenAt: string | null
  createdAt: string
  defaultWorkingDirectory: string | null
}

export type PairingStatus = "pending" | "paired" | "expired"

export type PairingRequestResult = {
  sessionId: string
  code: string
  expiresAt: string
  pollIntervalMs: number
}

export type PairingStatusResult = {
  status: PairingStatus
  deviceId?: string
}

export type PairingErrorCode =
  | "invalid_code"
  | "expired_code"
  | "used_code"
  | "already_paired"

export function isDeviceOnline(
  lastSeenAt: Date | string | null,
  now: number = Date.now(),
): boolean {
  if (!lastSeenAt) {
    return false
  }

  const value =
    lastSeenAt instanceof Date ? lastSeenAt.getTime() : Date.parse(lastSeenAt)

  if (Number.isNaN(value)) {
    return false
  }

  return now - value <= DEVICE_ONLINE_WINDOW_MS
}
