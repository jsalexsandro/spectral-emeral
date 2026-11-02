import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(moduleDir, "..")
const localEnvPath = join(packageDir, ".env")
const rootEnvPath = resolve(packageDir, "../..", ".env")

for (const envPath of [localEnvPath, rootEnvPath]) {
  if (!existsSync(envPath)) {
    continue
  }

  try {
    process.loadEnvFile(envPath)
  } catch {
    // Variáveis de ambiente do processo continuam válidas.
  }
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "")
}

function parseWsUrl(value: string): string {
  const parsed = new URL(value)

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error("SPECTRAL_WS_URL deve usar ws:// ou wss://")
  }

  return parsed.toString()
}

export type DriverConfig = {
  apiUrl: string
  wsUrl: string
  driverHome: string
}

export function loadConfig(): DriverConfig {
  const apiUrl = normalizeUrl(
    process.env.SPECTRAL_API_URL ?? "http://localhost:3000",
  )

  const wsUrl = parseWsUrl(
    process.env.SPECTRAL_WS_URL ?? "ws://localhost:4001",
  )

  const driverHome = process.env.SPECTRAL_DRIVER_HOME
    ? resolve(process.env.SPECTRAL_DRIVER_HOME)
    : join(homedir(), ".spectral", "driver")

  return { apiUrl, wsUrl, driverHome }
}
