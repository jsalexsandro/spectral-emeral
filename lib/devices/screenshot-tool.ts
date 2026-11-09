import type { DeviceScreenshot } from "@/spectral/shared/device-commands"

export const DEVICE_SCREENSHOT_TOOL_NAME = "device-screenshot"

export type DeviceScreenshotToolOutput =
  | {
      ok: true
      deviceId: string
      screenshot: DeviceScreenshot
    }
  | {
      ok: false
      code?: string
      error?: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isScreenshot(value: unknown): value is DeviceScreenshot {
  if (!isRecord(value)) {
    return false
  }

  const region = value.region

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.scale === "number" &&
    (value.monitor === null || typeof value.monitor === "number") &&
    isRecord(region) &&
    typeof region.x === "number" &&
    typeof region.y === "number" &&
    typeof region.width === "number" &&
    typeof region.height === "number" &&
    (value.format === "jpeg" || value.format === "png") &&
    typeof value.byteLength === "number" &&
    typeof value.capturedAt === "string"
  )
}

export function readDeviceScreenshotToolOutput(
  value: unknown,
): DeviceScreenshotToolOutput | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return null
  }

  if (value.ok) {
    return typeof value.deviceId === "string" && isScreenshot(value.screenshot)
      ? {
          ok: true,
          deviceId: value.deviceId,
          screenshot: value.screenshot,
        }
      : null
  }

  return {
    ok: false,
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.error === "string" ? { error: value.error } : {}),
  }
}
