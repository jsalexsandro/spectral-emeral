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
  id: string
  name: string
  packageId: string
  /** `user` instala/desinstala só para o usuário atual; `machine` exige elevação. */
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
 * Instalação/desinstalação em andamento no driver. winget usa um lock próprio
 * e duas operações simultâneas brigam, então serializamos pelo menos durante
 * a largada do job (`startJob`). O modelo acompanha o restante via `job-output`.
 */
let installing: Promise<DeviceJob> | null = null

function isInstalling(): boolean {
  return installing !== null
}

async function buildWingetScript({
  packageId,
  scope,
  action,
}: {
  packageId: string
  scope: "user" | "machine"
  action: "install" | "uninstall"
}): Promise<string> {
  const args = [
    "winget",
    action,
    "--exact",
    "--id",
    packageId,
    "--source",
    "winget",
    "--silent",
    "--disable-interactivity",
    "--accept-package-agreements",
    "--accept-source-agreements",
  ]

  if (scope === "user") {
    args.push("--scope", "user")
  }

  args.push("exit", "$LASTEXITCODE")

  return args.join(" ")
}

/**
 * Instala ou desinstala um runtime via winget.
 * Aceita um id do catálogo fechado (`toolchain`) ou um `packageId` livre
 * (qualquer pacote do winget). O modelo escolhe; o driver monta o argv.
 * Quando `action` é "uninstall", não há detecção de "já instalado" nem
 * verificação de elevação no driver (fica por conta do winget).
 */
export async function setupToolchain(
  input: {
    toolchain?: DeviceToolchainId
    packageId?: string
    scope?: "user" | "machine"
    action?: "install" | "uninstall"
  },
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
      "Já existe uma instalação/desinstalação de runtime em andamento. Espere o job terminar.",
    )
  }

  const action = input.action ?? "install"

  if (action !== "install" && action !== "uninstall") {
    throw new DeviceToolchainError(
      "invalid_action",
      'Campo "action" deve ser "install" ou "uninstall".',
    )
  }

  let entry: ToolchainEntry
  let scope: "user" | "machine"

  if (input.toolchain) {
    entry = resolveToolchain(input.toolchain)
    scope = input.scope ?? entry.scope
  } else if (input.packageId) {
    // Pacote livre: sem catálogo, sem detecção de "já instalado".
    scope = input.scope ?? "user"
    entry = {
      id: input.packageId,
      name: input.packageId,
      packageId: input.packageId,
      scope,
      detect: [],
      versionArgs: ["--version"],
    }
  } else {
    throw new DeviceToolchainError(
      "invalid_toolchain",
      'Informe "toolchain" (catálogo fechado) ou "packageId" (qualquer pacote winget).',
    )
  }

  // Para pacotes do catálogo fechado em instalação, verifica se já está instalado.
  if (action === "install" && input.toolchain) {
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
  }

  const script = await buildWingetScript({
    packageId: entry.packageId,
    scope,
    action,
  })

  installing = startJob(
    {
      script,
      shell: "powershell",
      label: `winget ${action}: ${entry.name}`,
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
        action: action === "install" ? "install" : "uninstalled",
        version: null,
        jobId: snapshot.id,
      },
      jobId: snapshot.id,
    }
  } finally {
    installing = null
  }
}

/** Testa se há instalação/desinstalação em andamento (exposto para testes). */
export function isToolchainInstalling(): boolean {
  return isInstalling()
}
