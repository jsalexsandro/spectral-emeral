import { hostname } from "node:os"
import type { DriverConfig } from "./config.js"
import type { DeviceIdentity } from "./identity.js"

const REQUEST_TIMEOUT_MS = 10_000

type PairingRequest = {
  sessionId: string
  code: string
  expiresAt: string
  pollIntervalMs: number
}

type PairingStatus = {
  status: "pending" | "paired" | "expired"
  deviceId?: string
}

async function requestJson(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  })

  let body: unknown = null

  try {
    body = await response.json()
  } catch {
    body = null
  }

  return { status: response.status, body }
}

function isPairingRequest(value: unknown): value is PairingRequest {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.code === "string" &&
    typeof candidate.expiresAt === "string" &&
    typeof candidate.pollIntervalMs === "number"
  )
}

export async function requestPairing(
  config: DriverConfig,
  identity: DeviceIdentity,
): Promise<PairingRequest> {
  const response = await requestJson(`${config.apiUrl}/api/devices/pairing`, {
    method: "POST",
    body: JSON.stringify({
      publicKey: identity.publicKey,
      hostname: hostname(),
      platform: process.platform,
      architecture: process.arch,
    }),
  })

  if (response.status !== 200 || !isPairingRequest(response.body)) {
    throw new Error(
      `Não foi possível solicitar o emparelhamento (HTTP ${response.status}).`,
    )
  }

  return response.body
}

export async function getPairingStatus(
  config: DriverConfig,
  sessionId: string,
): Promise<PairingStatus> {
  const response = await requestJson(
    `${config.apiUrl}/api/devices/pairing/${encodeURIComponent(sessionId)}`,
    { method: "GET" },
  )

  if (response.status !== 200) {
    throw new Error(
      `Não foi possível consultar o emparelhamento (HTTP ${response.status}).`,
    )
  }

  const candidate = response.body as Partial<PairingStatus> | null

  if (
    !candidate ||
    (candidate.status !== "pending" &&
      candidate.status !== "paired" &&
      candidate.status !== "expired")
  ) {
    throw new Error("Resposta de emparelhamento inválida.")
  }

  return {
    status: candidate.status,
    deviceId:
      typeof candidate.deviceId === "string" ? candidate.deviceId : undefined,
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
