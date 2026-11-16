import {
  DEVICE_TOOLCHAIN_IDS,
  DEVICE_TOOLCHAIN_JOB_MAX_RUNTIME_MS,
  type DeviceJob,
  type DeviceToolchainId,
  type DeviceToolchainResult,
} from "../../../shared/device-commands.js"
import { locateCommand, readVersion } from "./shell.js"
import { getOsInfo } from "./system.js"
import { startJob } from "./jobs.js"

const IS_WINDOWS = process.platform === "win32"

type ToolchainEntry = {
  id: DeviceToolchainId
  name: string
  packageId: string
  /** `user` instala só para o usuário atual; `machine` exige elevação. */
  scope: "user" | "machine"
  /** Comandos usados para detectar se já está instalado. */
  detect: string[]
  versionArgs: string[]
}

const TOOLCHAIN_CATALOG: Record<DeviceToolchainId, ToolchainEntry> = {
  node: {
    id: "node",
    name: "Node.js LTS",
    packageId: "OpenJS.NodeJS.LTS",
    scope: "user",
    detect: ["node"],
    versionArgs: ["--version"],
  },
  pnpm: {
    id: "pnpm",
    name: "pnpm",
    packageId: "pnpm.pnpm",
    scope: "user",
    detect: ["pnpm"],
    versionArgs: ["--version"],
  },
  yarn: {
    id: "yarn",
    name: "Yarn Classic",
    packageId: "Yarn.Yarn",
    scope: "user",
    detect: ["yarn"],
    versionArgs: ["--version"],
  },
  bun: {
    id: "bun",
    name: "Bun",
    packageId: "Oven-sh.Bun",
    scope: "user",
    detect: ["bun"],
    versionArgs: ["--version"],
  },
  python: {
    id: "python",
    name: "Python 3.14",
    packageId: "Python.Python.3.14",
    scope: "user",
    detect: ["python", "python3"],
    versionArgs: ["--version"],
  },
  uv: {
    id: "uv",
    name: "uv",
    packageId: "astral-sh.uv",
    scope: "user",
    detect: ["uv"],
    versionArgs: ["--version"],
  },
  rust: {
    id: "rust",
    name: "Rustup",
    packageId: "Rustlang.Rustup",
    scope: "user",
    detect: ["cargo", "rustc"],
    versionArgs: ["--version"],
  },
  git: {
    id: "git",
    name: "Git",
    packageId: "Git.Git",
    scope: "machine",
    detect: ["git"],
    versionArgs: ["--version"],
  },
  go: {
    id: "go",
    name: "Go",
    packageId: "GoLang.Go",
    scope: "machine",
    detect: ["go"],
    versionArgs: ["version"],
  },
  dotnet: {
    id: "dotnet",
    name: ".NET SDK 10",
    packageId: "Microsoft.DotNet.SDK.10",
    scope: "machine",
    detect: ["dotnet"],
    versionArgs: ["--version"],
  },
  java: {
    id: "java",
    name: "OpenJDK 25",
    packageId: "Microsoft.OpenJDK.25",
    scope: "machine",
    detect: ["java"],
    versionArgs: ["-version"],
  },
}

export class DeviceToolchainError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceToolchainError"
    this.code = code
  }
}

export function resolveToolchain(id: string): ToolchainEntry {
  const entry = TOOLCHAIN_CATALOG[id as DeviceToolchainId]

  if (!entry) {
    throw new DeviceToolchainError(
      "invalid_toolchain",
      `Runtime "${id}" não está no catálogo fechado.`,
    )
  }

  return entry
}

async function detectEntryVersion(entry: ToolchainEntry): Promise<string | null> {
  for (const command of entry.detect) {
    const path = await locateCommand(command)

    if (path) {
      const version = await readVersion(path, entry.versionArgs)

      return version
    }
  }

  return null
}

/**
 * Instalação em andamento no driver. winget usa um lock próprio e duas
 * instalações simultâneas brigam, então serializamos pelo menos durante a
 * largada do job (`startJob`). O modelo acompanha o restante via `job-output`.
 */
let installing: Promise<DeviceJob> | null = null

function isInstalling(): boolean {
  return installing !== null
}

async function buildWingetScript(entry: ToolchainEntry): Promise<string> {
  const args = [
    "winget",
    "install",
    "--exact",
    "--id",
    entry.packageId,
    "--source",
    "winget",
    "--silent",
    "--disable-interactivity",
    "--accept-package-agreements",
    "--accept-source-agreements",
  ]

  if (entry.scope === "user") {
    args.push("--scope", "user")
  }

  args.push("exit", "$LASTEXITCODE")

  return args.join(" ")
}

/**
 * Instala (ou confirma já instalado) um runtime do catálogo fechado via winget.
 * Nunca aceita script, versão, packageId ou args do modelo: o argv é inteiro de código.
 */
export async function setupToolchain(
  input: { toolchain: DeviceToolchainId },
  defaultFolder?: string,
): Promise<{ toolchain: DeviceToolchainResult; jobId: string | null }> {
  if (!IS_WINDOWS) {
    throw new DeviceToolchainError(
      "unsupported_platform",
      "Instalação automática só existe no Windows nesta versão.",
    )
  }

  const winget = await locateCommand("winget")

  if (!winget) {
    throw new DeviceToolchainError(
      "winget_missing",
      "O App Installer (winget) não está disponível. Instale pela Microsoft Store e tente de novo.",
    )
  }

  if (isInstalling()) {
    throw new DeviceToolchainError(
      "toolchain_busy",
      "Já existe uma instalação de runtime em andamento. Espere o job terminar.",
    )
  }

  const entry = resolveToolchain(input.toolchain)
  const version = await detectEntryVersion(entry)

  if (version !== null) {
    return {
      toolchain: {
        id: entry.id,
        name: entry.name,
        packageId: entry.packageId,
        action: "already_installed",
        version,
        jobId: null,
      },
      jobId: null,
    }
  }

  if (entry.scope === "machine" && !getOsInfo().elevated) {
    throw new DeviceToolchainError(
      "elevation_required",
      `O ${entry.name} instala para todos os usuários e precisa do Spectral como administrador. Feche e abra o Spectral como admin, ou instale manualmente.`,
    )
  }

  const script = await buildWingetScript(entry)

  installing = startJob(
    {
      script,
      shell: "powershell",
      label: `winget: ${entry.name}`,
      maxRuntimeMs: DEVICE_TOOLCHAIN_JOB_MAX_RUNTIME_MS,
    },
    defaultFolder,
  )

  try {
    const snapshot = await installing

    return {
      toolchain: {
        id: entry.id,
        name: entry.name,
        packageId: entry.packageId,
        action: "install",
        version: null,
        jobId: snapshot.id,
      },
      jobId: snapshot.id,
    }
  } finally {
    installing = null
  }
}

/** Testa se há instalação em andamento (exposto para testes). */
export function isToolchainInstalling(): boolean {
  return isInstalling()
}
