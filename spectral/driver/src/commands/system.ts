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
import { join } from "node:path"
import {
  DEVICE_COMMAND_NAMES,
  type DeviceCommandName,
  type DeviceEnv,
  type DeviceRuntimeInfo,
} from "../../../shared/device-commands.js"
import { detectShells, locateCommand, readVersion } from "./shell.js"

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
]

async function describeRuntime(
  candidate: RuntimeCandidate,
): Promise<DeviceRuntimeInfo | null> {
  const path = await locateCommand(candidate.command)

  if (!path) {
    return null
  }

  const version = await readVersion(path, candidate.versionArgs)

  return { id: candidate.id, version, path }
}

let runtimeCache: Promise<DeviceRuntimeInfo[]> | undefined

/** Descobre runtimes uma vez por processo; a lista muda pouco. */
function detectRuntimes(): Promise<DeviceRuntimeInfo[]> {
  if (!runtimeCache) {
    runtimeCache = Promise.all(
      RUNTIME_CANDIDATES.map(describeRuntime),
    ).then((items) =>
      items.filter((item): item is DeviceRuntimeInfo => item !== null),
    )
  }

  return runtimeCache
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
): Promise<DeviceEnv> {
  const [shells, runtimes] = await Promise.all([
    detectShells().catch(() => []),
    detectRuntimes().catch(() => []),
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
