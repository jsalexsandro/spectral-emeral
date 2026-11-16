import {
  arch,
  homedir,
  hostname,
  platform,
  release,
  tmpdir,
  type,
  userInfo,
  version,
} from "node:os"
import { execFileSync } from "node:child_process"
import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import {
  DEVICE_COMMAND_NAMES,
  type DeviceCommandName,
  type DeviceEnv,
  type DeviceRuntimeInfo,
} from "../../../shared/device-commands.js"
import {
  detectShells,
  locateCommand,
  readVersion,
  refreshShellCache,
} from "./shell.js"

function isElevated(): boolean {
  try {
    if (process.platform === "win32") {
      const output = execFileSync("whoami", ["/groups"], {
        encoding: "utf8",
        windowsHide: true,
      })

      return output.includes("S-1-16-12288")
    }

    return (process.getuid?.() ?? -1) === 0
  } catch {
    return false
  }
}

export function getOsInfo() {
  return {
    platform: platform() || "unknown",
    type: type() || "unknown",
    release: release() || "unknown",
    version: version() || "unknown",
    architecture: arch() || "unknown",
    elevated: isElevated(),
  }
}

type RuntimeCandidate = {
  id: string
  command: string
  versionArgs: string[]
}

const RUNTIME_CANDIDATES: RuntimeCandidate[] = [
  { id: "node", command: "node", versionArgs: ["--version"] },
  { id: "npm", command: "npm", versionArgs: ["--version"] },
  { id: "pnpm", command: "pnpm", versionArgs: ["--version"] },
  { id: "yarn", command: "yarn", versionArgs: ["--version"] },
  { id: "bun", command: "bun", versionArgs: ["--version"] },
  { id: "deno", command: "deno", versionArgs: ["--version"] },
  { id: "python", command: "python", versionArgs: ["--version"] },
  { id: "python3", command: "python3", versionArgs: ["--version"] },
  { id: "pip", command: "pip", versionArgs: ["--version"] },
  { id: "pip3", command: "pip3", versionArgs: ["--version"] },
  { id: "git", command: "git", versionArgs: ["--version"] },
  { id: "docker", command: "docker", versionArgs: ["--version"] },
  { id: "rg", command: "rg", versionArgs: ["--version"] },
  { id: "go", command: "go", versionArgs: ["version"] },
  { id: "java", command: "java", versionArgs: ["-version"] },
  { id: "dotnet", command: "dotnet", versionArgs: ["--version"] },
  { id: "cargo", command: "cargo", versionArgs: ["--version"] },
  { id: "code", command: "code", versionArgs: ["--version"] },
  { id: "uv", command: "uv", versionArgs: ["--version"] },
  { id: "ruby", command: "ruby", versionArgs: ["--version"] },
  { id: "php", command: "php", versionArgs: ["-version"] },
]

const IS_WINDOWS = process.platform === "win32"

async function describeRuntime(
  candidate: RuntimeCandidate,
): Promise<DeviceRuntimeInfo | null> {
  let path = await locateCommand(candidate.command)

  // O PATH do processo do driver fica velho depois de uma instalação: o
  // runtime já pode estar no disco, mas ainda não no PATH. Tenta caminhos
  // absolutos conhecidos por runtime (só Windows).
  if (!path && IS_WINDOWS) {
    path = await findFirstExisting(runtimeFallbackPaths(candidate.id))
  }

  if (!path) {
    return null
  }

  const version = await readVersion(path, candidate.versionArgs)

  return { id: candidate.id, version, path }
}

function runtimeFallbackPaths(id: string): string[] {
  if (!IS_WINDOWS) {
    return []
  }

  const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files"
  const localAppData =
    process.env["LOCALAPPDATA"] ?? join(homedir(), "AppData", "Local")
  const userProfile = process.env["USERPROFILE"] ?? homedir()

  const patterns: Record<string, string[]> = {
    node: [`${programFiles}\\nodejs\\node.exe`],
    python: [
      `${localAppData}\\Programs\\Python\\Python3*\\python.exe`,
      `${programFiles}\\Python3*\\python.exe`,
    ],
    git: [`${programFiles}\\Git\\cmd\\git.exe`],
    go: [`${programFiles}\\Go\\bin\\go.exe`],
    dotnet: [`${programFiles}\\dotnet\\dotnet.exe`],
    java: [
      `${programFiles}\\Microsoft\\jdk-*\\bin\\java.exe`,
      `${programFiles}\\Eclipse Adoptium\\jdk-*\\bin\\java.exe`,
    ],
    rust: [`${userProfile}\\.cargo\\bin\\cargo.exe`],
    pnpm: [`${localAppData}\\Microsoft\\WinGet\\Links\\pnpm.exe`],
    yarn: [`${localAppData}\\Microsoft\\WinGet\\Links\\yarn.exe`],
    bun: [`${localAppData}\\Microsoft\\WinGet\\Links\\bun.exe`],
    uv: [`${localAppData}\\Microsoft\\WinGet\\Links\\uv.exe`],
  }

  return patterns[id] ?? []
}

/**
 * Retorna o primeiro caminho existente entre os padrões. Padrões com `*`
 * são resolvidos listando o diretório pai e casando o nome. Só Windows;
 * em outros sistemas retorna vazio.
 */
async function findFirstExisting(patterns: string[]): Promise<string | null> {
  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      const star = pattern.indexOf("*")
      const dir = pattern.slice(0, star)
      const glob = new RegExp(
        "^" + pattern.slice(star).replace(/[.+^${}()|[\\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
      )

      let entries: string[]

      try {
        entries = await readdir(dir)
      } catch {
        continue
      }

      const match = entries.find((name) => glob.test(name))

      if (match) {
        return join(dir, match)
      }

      continue
    }

    try {
      await stat(pattern)

      return pattern
    } catch {
      continue
    }
  }

  return null
}

let runtimeCache: Promise<DeviceRuntimeInfo[]> | undefined

/**
 * Descobre runtimes uma vez por processo; a lista muda pouco. Passe
 * `refresh: true` para descartar o cache e detectar de novo (útil depois de
 * instalar um runtime via winget).
 */
export function detectRuntimes({ refresh } = { refresh: false }): Promise<DeviceRuntimeInfo[]> {
  if (refresh) {
    runtimeCache = undefined
  }

  if (!runtimeCache) {
    runtimeCache = Promise.all(
      RUNTIME_CANDIDATES.map(describeRuntime),
    ).then((items) =>
      items.filter((item): item is DeviceRuntimeInfo => item !== null),
    )
  }

  return runtimeCache
}

/** Runtimes já detectados (sem pagar a detecção de shells). */
export async function getInstalledRuntimes(): Promise<DeviceRuntimeInfo[]> {
  return detectRuntimes().catch(() => [])
}

/** Descarta o cache de runtimes para forçar nova detecção. */
export function clearRuntimeCache(): void {
  runtimeCache = undefined
}

// Comandos disponíveis apenas no Windows nesta versão. São comandos cuja
// implementação depende de APIs do Windows (shell, jobs, UI Automation,
// processos, ações de sistema) e que não têm equivalente em macOS/Linux.
const WINDOWS_ONLY_COMMANDS: DeviceCommandName[] = [
  "shell",
  "job-start",
  "job-status",
  "job-output",
  "job-cancel",
  "job-list",
  "inspect-ui",
  "ui-action",
  "list-processes",
  "kill-process",
  "get-system-status",
  "set-volume",
  "set-brightness",
  "lock-screen",
  "power",
  "media-control",
  "setup-toolchain",
] as const

function getCapabilities(): DeviceCommandName[] {
  if (process.platform === "win32") {
    return [...DEVICE_COMMAND_NAMES]
  }

  // UI Automation e comandos dependentes do Windows são excluídos em
  // macOS/Linux. Os demais degradam por plataforma dentro do executor.
  const windowsOnly = new Set<string>(WINDOWS_ONLY_COMMANDS)
  return DEVICE_COMMAND_NAMES.filter((name) => !windowsOnly.has(name))
}

export async function getDeviceEnv(
  defaultFolder?: string,
  options?: { refresh?: boolean },
): Promise<DeviceEnv> {
  const refresh = options?.refresh === true

  if (refresh) {
    clearRuntimeCache()
    void refreshShellCache()
  }

  const [shells, runtimes] = await Promise.all([
    detectShells().catch(() => []),
    detectRuntimes({ refresh }).catch(() => []),
  ])

  const shell = shells[0] ?? null

  return {
    platform: platform() || "unknown",
    arch: arch() || "unknown",
    hostname: hostname() || "unknown",
    user: safeUsername(),
    home: homedir(),
    temp: tmpdir(),
    cwd: defaultFolder || homedir(),
    shell:
      shell ?? {
        kind: process.platform === "win32" ? "powershell" : "sh",
        path: process.platform === "win32" ? "powershell.exe" : "/bin/sh",
        version: null,
      },
    shells,
    runtimes,
    elevated: isElevated(),
    locale: safeLocale(),
    capabilities: getCapabilities(),
    collectedAt: new Date().toISOString(),
  }
}

function safeUsername(): string {
  try {
    return userInfo().username
  } catch {
    return process.env.USERNAME ?? process.env.USER ?? "unknown"
  }
}

function safeLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return null
  }
}

export function getDefaultWorkingDirectory(defaultFolder?: string): string {
  return defaultFolder || join(homedir())
}
