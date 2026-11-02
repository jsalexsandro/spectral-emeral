import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const rootEnvPath = resolve(moduleDir, "../../../.env")

if (existsSync(rootEnvPath)) {
  try {
    process.loadEnvFile(rootEnvPath)
  } catch {
    // Variáveis já definidas no processo continuam válidas.
  }
}

function readInteger(name: string, fallback: number): number {
  const raw = process.env[name]

  if (!raw) {
    return fallback
  }

  const parsed = Number.parseInt(raw, 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Variável de ambiente inválida: ${name}`)
  }

  return parsed
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL não definida")
}

export const config = {
  databaseUrl,
  host: process.env.SPECTRAL_WS_HOST ?? "0.0.0.0",
  port: readInteger("SPECTRAL_WS_PORT", 4001),
  heartbeatTimeoutMs: readInteger("DEVICE_HEARTBEAT_TIMEOUT_MS", 45_000),
  heartbeatIntervalMs: 15_000,
  challengeTtlMs: 30_000,
  authTimeoutMs: 10_000,
  maxPayloadBytes: 16 * 1024,
}
