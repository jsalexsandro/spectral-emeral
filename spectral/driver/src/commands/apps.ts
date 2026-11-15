import { execFile } from "node:child_process"
import { stat } from "node:fs/promises"
import { basename, extname } from "node:path"
import { promisify } from "node:util"
import {
  DEVICE_APP_PATH_EXTENSIONS,
  deviceAppIdFromTarget,
  type DeviceAppInfo,
  type DeviceAppSource,
} from "../../../shared/device-commands.js"
import { listCatalogApps, resolveCatalogApp } from "./catalog.js"

const execFileAsync = promisify(execFile)

const DISCOVERY_TIMEOUT_MS = 20_000
const DISCOVERY_CACHE_TTL_MS = 5 * 60_000
const DISCOVERY_MAX_BUFFER_BYTES = 4 * 1024 * 1024
const DISCOVERY_MAX_APPS = 400

export type AppDefinition = {
  id: string
  name: string
  win32?: string
  darwin?: string
  linux?: string
}

export const APPS: readonly AppDefinition[] = [
  {
    id: "chrome",
    name: "Google Chrome",
    win32: "chrome.exe",
    darwin: "Google Chrome",
    linux: "google-chrome",
  },
  {
    id: "edge",
    name: "Microsoft Edge",
    win32: "msedge.exe",
    darwin: "Microsoft Edge",
    linux: "microsoft-edge",
  },
  {
    id: "firefox",
    name: "Mozilla Firefox",
    win32: "firefox.exe",
    darwin: "Firefox",
    linux: "firefox",
  },
  {
    id: "notepad",
    name: "Bloco de Notas",
    win32: "notepad.exe",
    linux: "gedit",
  },
  {
    id: "explorer",
    name: "Explorador de Arquivos",
    win32: "explorer.exe",
    darwin: "Finder",
    linux: "nautilus",
  },
  {
    id: "vscode",
    name: "Visual Studio Code",
    win32: "code.cmd",
    darwin: "Visual Studio Code",
    linux: "code",
  },
  {
    id: "terminal",
    name: "Terminal",
    win32: "cmd.exe",
    darwin: "Terminal",
    linux: "x-terminal-emulator",
  },
  {
    id: "calculator",
    name: "Calculadora",
    win32: "calc.exe",
    darwin: "Calculator",
    linux: "gnome-calculator",
  },
]

const APP_BY_ID = new Map(APPS.map((app) => [app.id, app]))

type DiscoverySource = Extract<DeviceAppSource, "start-menu" | "app-path" | "store">

export type DiscoveredApp = {
  id: string
  name: string
  source: DiscoverySource
  target: string
}

function platformTarget(
  app: AppDefinition,
  platform: NodeJS.Platform,
): string | undefined {
  if (platform === "win32") {
    return app.win32
  }

  if (platform === "darwin") {
    return app.darwin
  }

  if (platform === "linux") {
    return app.linux
  }

  return undefined
}

export function findApp(appId: string): AppDefinition | undefined {
  return APP_BY_ID.get(appId)
}

export function getAppTarget(
  app: AppDefinition,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  return platformTarget(app, platform)
}

/**
 * Lista os apps fixos e, no Windows, os descobertos no Menu Iniciar e no
 * registro (App Paths). A descoberta fica em cache para não custar uma
 * varredura a cada mensagem.
 */
export function listApps(
  platform: NodeJS.Platform = process.platform,
): DeviceAppInfo[] {
  return APPS.filter((app) => platformTarget(app, platform) !== undefined).map(
    (app) => ({ id: app.id, name: app.name, source: "builtin" }),
  )
}

export function isDiscoverablePlatform(
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === "win32"
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeTarget(value: string): string {
  return value.replace(/\//g, "\\").toLowerCase()
}

function isExecutableTarget(target: string): boolean {
  const extension = extname(target).toLowerCase()

  if (!(DEVICE_APP_PATH_EXTENSIONS as readonly string[]).includes(extension)) {
    return false
  }

  const file = basename(target).toLowerCase()

  return !file.startsWith("unins") && !file.startsWith("uninstall")
}

function uniqueId(
  base: string,
  used: Set<string>,
): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base.slice(0, 37)}-${suffix}`

    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
  }

  used.add(base)
  return base
}

const DISCOVERY_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$items = New-Object System.Collections.Generic.List[object]

function Add-AppItem([string]$name, [string]$target, [string]$source) {
  if (-not $name -or -not $target) { return }
  # AUMIDs da Store (ex.: SpotifyAB....!Spotify) não são caminhos de arquivo:
  # pular a validação de existência para não rejeitá-los.
  $isFilePath = $target -match '^[a-zA-Z]:[\\/]|^[\\/]|^~[\\/]'
  if ($isFilePath -and -not (Test-Path -LiteralPath $target)) { return }
  $items.Add([pscustomobject]@{ name = $name; target = $target; source = $source })
}

$shell = New-Object -ComObject WScript.Shell
$startMenuRoots = @(
  [Environment]::GetFolderPath('StartMenu'),
  [Environment]::GetFolderPath('CommonStartMenu')
)

foreach ($root in $startMenuRoots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  Get-ChildItem -LiteralPath $root -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
    $shortcut = $shell.CreateShortcut($_.FullName)
    Add-AppItem $_.BaseName $shortcut.TargetPath 'start-menu'
  }
}

$registryRoots = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths'
)

foreach ($root in $registryRoots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue | ForEach-Object {
    $key = Get-Item -LiteralPath $_.PSPath
    $target = $key.GetValue('')
    if (-not $target) {
      $base = $key.GetValue('Path')
      if ($base) { $target = Join-Path $base $_.PSChildName }
    }
    if ($target -like '*\\WindowsApps\\*') { continue }
    Add-AppItem ([System.IO.Path]::GetFileNameWithoutExtension($_.PSChildName)) $target 'app-path'
  }
}

$storeApps = Get-StartApps -ErrorAction SilentlyContinue | Where-Object { $_.AppID -and $_.Name } | ForEach-Object {
  Add-AppItem $_.Name $_.AppID 'store'
}

# Fallback para Windows sem Get-StartApps: enumera shell:AppsFolder pelo COM
# do Shell.Application. $_.Path traz o AUMID (ex.: SpotifyAB....!Spotify).
$shellApps = New-Object -ComObject Shell.Application
$appsFolder = $shellApps.NameSpace('shell:AppsFolder')
if ($appsFolder) {
  $appsFolder.Items() | ForEach-Object {
    $aumid = $_.Path
    $name = $_.Name
    if ($aumid -and $name -and $aumid -like '*!*') {
      Add-AppItem $name $aumid 'store'
    }
  }
}

ConvertTo-Json -InputObject $items.ToArray() -Compress -Depth 3
`

function parseDiscoveryOutput(stdout: string): DiscoveredApp[] {
  const trimmed = stdout.trim()

  if (trimmed.length === 0) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return []
  }

  const entries = Array.isArray(parsed) ? parsed : [parsed]
  const apps: DiscoveredApp[] = []
  const usedIds = new Set(
    listApps("win32").map((app) => app.id),
  )
  const seenTargets = new Set<string>()

  for (const entry of entries) {
    if (apps.length >= DISCOVERY_MAX_APPS) {
      break
    }

    if (typeof entry !== "object" || entry === null) {
      continue
    }

    const record = entry as Record<string, unknown>
    const name = typeof record.name === "string" ? record.name.trim() : ""
    const target =
      typeof record.target === "string" ? record.target.trim() : ""
    const source = record.source

    // Dedup: a mesma descoberta pode vir de Get-StartApps e de
    // shell:AppsFolder (ex.: Spotify listado duas vezes com o mesmo AUMID).
    if (target.length > 0 && seenTargets.has(target)) {
      continue
    }
    if (target.length > 0) {
      seenTargets.add(target)
    }

    // Nunca expõe shims descobertos dentro de WindowsApps (ex.: spotify_cli.exe
    // do Spotify da Store). Eles não abrem nada visível; apps de Store devem
    // ser usados pelo AUMID (source "store").
    if (target.toLowerCase().includes("\\windowsapps\\")) {
      continue
    }

    if (
      name.length === 0 ||
      name.length > 120 ||
      (source !== "store" && !isExecutableTarget(target)) ||
      (source !== "start-menu" && source !== "app-path" && source !== "store")
    ) {
      continue
    }

    apps.push({
      id: uniqueId(deviceAppIdFromTarget(name, target), usedIds),
      name: name.slice(0, 120),
      source,
      target: target.slice(0, 1024),
    })
  }

  return apps
}

async function discoverWindowsApps(): Promise<DiscoveredApp[]> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      DISCOVERY_SCRIPT,
    ],
    {
      timeout: DISCOVERY_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: DISCOVERY_MAX_BUFFER_BYTES,
    },
  )

  return parseDiscoveryOutput(stdout)
}

let discoveryCache: { at: number; apps: DiscoveredApp[] } | null = null
let discoveryInFlight: Promise<DiscoveredApp[]> | null = null

export async function listDiscoveredApps(
  refresh = false,
): Promise<DiscoveredApp[]> {
  if (!isDiscoverablePlatform()) {
    return []
  }

  const now = Date.now()

  if (
    !refresh &&
    discoveryCache &&
    now - discoveryCache.at < DISCOVERY_CACHE_TTL_MS
  ) {
    return discoveryCache.apps
  }

  if (discoveryInFlight) {
    return discoveryInFlight
  }

  discoveryInFlight = (async () => {
    try {
      const apps = await discoverWindowsApps()
      discoveryCache = { at: Date.now(), apps }
      return apps
    } catch {
      return []
    }
  })()

  try {
    return await discoveryInFlight
  } finally {
    discoveryInFlight = null
  }
}

async function collectApps(refresh: boolean): Promise<DeviceAppInfo[]> {
  const builtins = listApps()
  const custom = await listCatalogApps()
  const discovered = (await listDiscoveredApps(refresh)).map<DeviceAppInfo>(
    (app) => ({
      id: app.id,
      name: app.name,
      source: app.source,
      target: app.target,
    }),
  )

  const builtinTargets = new Set(
    APPS.flatMap((app) => (app.win32 ? [app.win32.toLowerCase()] : [])),
  )
  const seenTargets = new Set<string>()
  const seenIds = new Set(builtins.map((app) => app.id))
  const merged: DeviceAppInfo[] = [...builtins]

  // O catálogo local entra depois dos builtins e antes da descoberta: um app
  // cadastrado explicitamente deve vencer a varredura do Menu Iniciar.
  for (const app of [...custom, ...discovered]) {
    if (!app.target) {
      continue
    }

    const file = basename(app.target).toLowerCase()
    const target = normalizeTarget(app.target)

    if (
      app.source !== "custom" &&
      (builtinTargets.has(file) || seenTargets.has(target))
    ) {
      continue
    }

    if (seenIds.has(app.id)) {
      continue
    }

    seenTargets.add(target)
    seenIds.add(app.id)
    merged.push(app)
  }

  return merged
}

function matches(app: DeviceAppInfo, query: string): boolean {
  const needle = normalize(query)

  if (needle.length === 0) {
    return true
  }

  if (normalize(app.id).includes(needle) || normalize(app.name).includes(needle)) {
    return true
  }

  return app.target ? normalize(app.target).includes(needle) : false
}

function rank(app: DeviceAppInfo, query: string): number | null {
  const needle = normalize(query)
  const id = normalize(app.id)
  const name = normalize(app.name)
  const target = app.target
    ? normalize(basename(app.target))
    : ""

  if (id === needle || name === needle || target === needle) {
    return 0
  }

  if (
    name.startsWith(needle) ||
    id.startsWith(needle) ||
    target.startsWith(needle)
  ) {
    return 1
  }

  if (
    name.includes(needle) ||
    id.includes(needle) ||
    target.includes(needle)
  ) {
    return 2
  }

  return null
}

export async function listAvailableApps(input?: {
  query?: string
  refresh?: boolean
  limit?: number
}): Promise<DeviceAppInfo[]> {
  const limit = Math.min(Math.max(input?.limit ?? 200, 1), 200)
  const apps = await collectApps(input?.refresh === true)
  const filtered =
    input?.query && input.query.trim().length > 0
      ? apps.filter((app) => matches(app, input.query ?? ""))
      : apps

  return filtered.slice(0, limit)
}

export async function findAvailableApps(input: {
  query: string
  refresh?: boolean
  limit?: number
}): Promise<DeviceAppInfo[]> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 200)
  const apps = await collectApps(input.refresh === true)
  const ranked: { app: DeviceAppInfo; rank: number }[] = []

  for (const app of apps) {
    const position = rank(app, input.query)

    if (position !== null) {
      ranked.push({ app, rank: position })
    }
  }

  ranked.sort(
    (left, right) =>
      left.rank - right.rank ||
      left.app.name.localeCompare(right.app.name, "pt-BR"),
  )

  return ranked.slice(0, limit).map((item) => item.app)
}

export async function resolveOpenableApp(
  appId: string,
): Promise<
  { name: string; target: string; args?: string[]; cwd?: string } | undefined
> {
  const custom = await resolveCatalogApp(appId)

  if (custom) {
    return {
      name: custom.name,
      target: custom.path,
      ...(custom.args ? { args: custom.args } : {}),
      ...(custom.cwd ? { cwd: custom.cwd } : {}),
    }
  }

  const builtin = findApp(appId)

  if (builtin) {
    const target = getAppTarget(builtin)
    return target ? { name: builtin.name, target } : undefined
  }

  const discovered = await listDiscoveredApps()

  if (discovered.length === 0) {
    // Cache vazio pode significar apenas uma varredura anterior sem sucesso;
    // tenta uma vez com refresh antes de desistir.
    const refreshed = await listDiscoveredApps(true)
    const match = refreshed.find((app) => app.id === appId)
    return match
      ? { name: match.name, target: match.target }
      : undefined
  }

  const match = discovered.find((app) => app.id === appId)

  return match ? { name: match.name, target: match.target } : undefined
}

/**
 * Confirma que um caminho informado por app personalizado existe, é arquivo e
 * tem extensão abrível. Retorna o caminho absoluto para o `start`.
 */
export async function assertLaunchablePath(
  target: string,
): Promise<void> {
  const extension = extname(target).toLowerCase()

  if (!(DEVICE_APP_PATH_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new Error("unsupported_app_path")
  }

  let info

  try {
    info = await stat(target)
  } catch {
    throw new Error("app_not_found")
  }

  if (!info.isFile()) {
    throw new Error("app_not_found")
  }
}
