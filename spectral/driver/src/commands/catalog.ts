import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import {
  DEVICE_APP_ARGS_MAX,
  DEVICE_APP_ARG_MAX_LENGTH,
  DEVICE_APP_ID_PATTERN,
  DEVICE_APP_NAME_MAX_LENGTH,
  deviceAppIdFromTarget,
  hasAppPathExtension,
  isAbsoluteAppPath,
  type DeviceAppInfo,
} from "../../../shared/device-commands.js"
import { loadConfig } from "../config.js"

const CATALOG_VERSION = 1
const CATALOG_MAX_APPS = 100

export type CatalogApp = {
  id: string
  name: string
  path: string
  args?: string[]
  cwd?: string
  createdAt: string
}

type CatalogFile = {
  version: number
  apps: CatalogApp[]
}

export function catalogFilePath(): string {
  return join(loadConfig().driverHome, "apps.json")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizePath(value: string): string {
  return value.replace(/\//g, "\\").toLowerCase()
}

function parseArgs(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (!Array.isArray(value) || value.length > DEVICE_APP_ARGS_MAX) {
    return undefined
  }

  const args: string[] = []

  for (const item of value) {
    if (
      typeof item !== "string" ||
      item.length === 0 ||
      item.length > DEVICE_APP_ARG_MAX_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(item)
    ) {
      return undefined
    }

    args.push(item)
  }

  return args.length > 0 ? args : undefined
}

function parseCatalogApp(value: unknown): CatalogApp | null {
  if (!isRecord(value)) {
    return null
  }

  const id = typeof value.id === "string" ? value.id.trim().toLowerCase() : ""
  const name = typeof value.name === "string" ? value.name.trim() : ""
  const path = typeof value.path === "string" ? value.path.trim() : ""

  if (
    !DEVICE_APP_ID_PATTERN.test(id) ||
    name.length === 0 ||
    name.length > DEVICE_APP_NAME_MAX_LENGTH ||
    !isAbsoluteAppPath(path) ||
    !hasAppPathExtension(path) ||
    /[\u0000-\u001f\u007f]/.test(name + path)
  ) {
    return null
  }

  const args = parseArgs(value.args)
  const cwd =
    typeof value.cwd === "string" && isAbsoluteAppPath(value.cwd.trim())
      ? value.cwd.trim()
      : undefined
  const createdAt =
    typeof value.createdAt === "string" && value.createdAt.length > 0
      ? value.createdAt
      : new Date(0).toISOString()

  return {
    id,
    name,
    path,
    ...(args ? { args } : {}),
    ...(cwd ? { cwd } : {}),
    createdAt,
  }
}

function parseCatalogFile(raw: string): CatalogApp[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.apps)) {
    return []
  }

  const apps: CatalogApp[] = []
  const seenPaths = new Set<string>()
  const seenIds = new Set<string>()

  for (const entry of parsed.apps) {
    const app = parseCatalogApp(entry)

    if (!app) {
      continue
    }

    const path = normalizePath(app.path)

    if (seenPaths.has(path) || seenIds.has(app.id)) {
      continue
    }

    seenPaths.add(path)
    seenIds.add(app.id)
    apps.push(app)

    if (apps.length >= CATALOG_MAX_APPS) {
      break
    }
  }

  return apps
}

/**
 * O catálogo é a memória local do dispositivo: onde cada app está e quais
 * argumentos ele usa por padrão. Corrupção não derruba o driver; o arquivo é
 * tratado como vazio e a próxima gravação corrige o estado.
 */
export async function readCatalog(): Promise<CatalogApp[]> {
  try {
    const raw = await readFile(catalogFilePath(), "utf8")

    return parseCatalogFile(raw)
  } catch {
    return []
  }
}

async function writeCatalog(apps: readonly CatalogApp[]): Promise<void> {
  const file = catalogFilePath()
  const payload: CatalogFile = {
    version: CATALOG_VERSION,
    apps: [...apps],
  }
  const temporary = `${file}.tmp`

  await mkdir(dirname(file), { recursive: true })
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
  await rename(temporary, file)
}

let queue: Promise<unknown> = Promise.resolve()

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const run = queue.then(operation, operation)

  queue = run.then(
    () => undefined,
    () => undefined,
  )

  return run
}

function uniqueId(base: string, apps: readonly CatalogApp[]): string {
  const used = new Set(apps.map((app) => app.id))

  if (!used.has(base)) {
    return base
  }

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base.slice(0, 37)}-${suffix}`

    if (!used.has(candidate)) {
      return candidate
    }
  }

  return base
}

export function toCatalogAppInfo(app: CatalogApp): DeviceAppInfo {
  return {
    id: app.id,
    name: app.name,
    source: "custom",
    target: app.path,
    ...(app.args ? { args: app.args } : {}),
    ...(app.cwd ? { cwd: app.cwd } : {}),
  }
}

export function listCatalogApps(): Promise<DeviceAppInfo[]> {
  return readCatalog().then((apps) => apps.map(toCatalogAppInfo))
}

export function resolveCatalogApp(
  appId: string,
): Promise<CatalogApp | undefined> {
  return readCatalog().then((apps) =>
    apps.find((app) => app.id === appId),
  )
}

export type RegisterCatalogAppInput = {
  name: string
  path: string
  args?: string[]
  cwd?: string
}

/**
 * Cadastra ou atualiza pelo caminho. Re-cadastrar o mesmo caminho mantém o id
 * e troca nome/args/cwd, o que torna o comando idempotente para o modelo.
 */
export function registerCatalogApp(
  input: RegisterCatalogAppInput,
): Promise<CatalogApp> {
  return serialize(async () => {
    const apps = await readCatalog()
    const normalized = normalizePath(input.path)
    const existing = apps.find(
      (app) => normalizePath(app.path) === normalized,
    )
    const id = existing?.id ?? uniqueId(
      deviceAppIdFromTarget(input.name, input.path),
      apps,
    )
    const app: CatalogApp = {
      id,
      name: input.name,
      path: input.path,
      ...(input.args ? { args: input.args } : {}),
      ...(input.cwd ? { cwd: input.cwd } : {}),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    const next = existing
      ? apps.map((item) => (item.id === existing.id ? app : item))
      : [...apps, app].slice(0, CATALOG_MAX_APPS)

    await writeCatalog(next)

    return app
  })
}

export function removeCatalogApp(appId: string): Promise<boolean> {
  return serialize(async () => {
    const apps = await readCatalog()
    const next = apps.filter((app) => app.id !== appId)

    if (next.length === apps.length) {
      return false
    }

    await writeCatalog(next)
    return true
  })
}
