import { spawn, execFile } from "node:child_process"
import { lstat, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
import { randomUUID } from "node:crypto"
import { promisify } from "node:util"
import type {
  DeviceCommandInputMap,
  DeviceShellInfo,
  DeviceShellKind,
  DeviceShellResult,
} from "../../../shared/device-commands.js"

const execFileAsync = promisify(execFile)
const IS_WINDOWS = process.platform === "win32"
const PROBE_TIMEOUT_MS = 4_000
const KILL_TIMEOUT_MS = 5_000
const MAX_CAPTURE_BYTES = 2 * 1024 * 1024

export class DeviceShellError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceShellError"
    this.code = code
  }
}

const ANSI_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g

/** Remove ANSI e normaliza quebras de linha antes de devolver ao modelo. */
export function normalizeShellOutput(value: string): string {
  return value.replace(ANSI_PATTERN, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

/**
 * Buffer circular com cabeça e cauda: mantém o começo (contexto) e o fim
 * (erro) sem deixar um comando barulhento estourar a memória do driver.
 */
export class BoundedOutput {
  private readonly maxBytes: number
  private readonly headLimit: number
  private readonly tailLimit: number
  private head: Buffer[] = []
  private tail: Buffer[] = []
  private headBytes = 0
  private tailBytes = 0
  totalBytes = 0
  truncated = false

  constructor(maxBytes: number) {
    this.maxBytes = Math.max(1024, maxBytes)
    this.headLimit = Math.floor(this.maxBytes / 2)
    this.tailLimit = this.maxBytes - this.headLimit
  }

  push(chunk: Buffer) {
    this.totalBytes += chunk.length

    if (this.headBytes < this.headLimit) {
      const room = this.headLimit - this.headBytes
      const slice = chunk.length <= room ? chunk : chunk.subarray(0, room)
      this.head.push(slice)
      this.headBytes += slice.length

      if (slice.length === chunk.length) {
        return
      }

      chunk = chunk.subarray(slice.length)
    }

    this.tail.push(chunk)
    this.tailBytes += chunk.length

    while (this.tailBytes > this.tailLimit && this.tail.length > 1) {
      const oldest = this.tail[0]

      if (!oldest) {
        break
      }

      const excess = this.tailBytes - this.tailLimit

      if (oldest.length <= excess) {
        this.tail.shift()
        this.tailBytes -= oldest.length
        continue
      }

      this.tail[0] = oldest.subarray(excess)
      this.tailBytes -= excess
    }

    if (this.tailBytes > this.tailLimit) {
      const only = this.tail[0]

      if (only && only.length > this.tailLimit) {
        this.tail[0] = only.subarray(only.length - this.tailLimit)
        this.tailBytes = this.tailLimit
      }
    }

    this.truncated = this.totalBytes > this.maxBytes
  }

  toString(): string {
    const omitted = Math.max(0, this.totalBytes - this.headBytes - this.tailBytes)
    const parts = [
      ...this.head.map((item) => item.toString("utf8")),
      ...(omitted > 0 ? [`\n...[${omitted} bytes omitidos]...\n`] : []),
      ...this.tail.map((item) => item.toString("utf8")),
    ]

    return normalizeShellOutput(parts.join(""))
  }
}

export type ShellCandidate = {
  kind: Exclude<DeviceShellKind, "auto">
  command: string
  args: string[]
  versionArgs: string[]
  scriptExtension: string
}

const WINDOWS_CANDIDATES: ShellCandidate[] = [
  {
    kind: "pwsh",
    command: "pwsh.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
    ],
    versionArgs: ["-NoLogo", "-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"],
    scriptExtension: "ps1",
  },
  {
    kind: "powershell",
    command: "powershell.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
    ],
    versionArgs: ["-NoLogo", "-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"],
    scriptExtension: "ps1",
  },
  {
    kind: "cmd",
    command: process.env.COMSPEC || "cmd.exe",
    args: ["/d", "/s", "/c"],
    versionArgs: ["/d", "/c", "ver"],
    scriptExtension: "cmd",
  },
]

const UNIX_CANDIDATES: ShellCandidate[] = [
  {
    kind: "bash",
    command: "bash",
    args: [],
    versionArgs: ["--version"],
    scriptExtension: "sh",
  },
  {
    kind: "zsh",
    command: "zsh",
    args: [],
    versionArgs: ["--version"],
    scriptExtension: "sh",
  },
  {
    kind: "sh",
    command: "sh",
    args: [],
    versionArgs: ["--version"],
    scriptExtension: "sh",
  },
]

type LocatedCommand = {
  path: string
  version: string | null
}

export async function locateCommand(command: string): Promise<string | null> {
  try {
    if (IS_WINDOWS) {
      const { stdout } = await execFileAsync("where.exe", [command], {
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 64 * 1024,
      })

      const first = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean)

      return first ?? null
    }

    const { stdout } = await execFileAsync("which", [command], {
      timeout: PROBE_TIMEOUT_MS,
      maxBuffer: 64 * 1024,
    })

    return stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null
  } catch {
    return null
  }
}

export async function readVersion(
  command: string,
  args: readonly string[],
): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, [...args], {
      timeout: PROBE_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 64 * 1024,
    })
    const text = (stdout || stderr).split(/\r?\n/).find((line) => line.trim())

    return text?.trim().slice(0, 120) ?? null
  } catch {
    return null
  }
}

async function describeCandidate(
  candidate: ShellCandidate,
): Promise<DeviceShellInfo | null> {
  const located = await locateCommand(basename(candidate.command))

  if (!located) {
    return null
  }

  const version = await readVersion(located, candidate.versionArgs)

  return { kind: candidate.kind, path: located, version }
}

let shellCache: Promise<DeviceShellInfo[]> | undefined

/** Detecta os shells disponíveis uma vez por processo. */
export function detectShells(): Promise<DeviceShellInfo[]> {
  if (!shellCache) {
    const candidates = IS_WINDOWS ? WINDOWS_CANDIDATES : UNIX_CANDIDATES

    shellCache = Promise.all(candidates.map(describeCandidate)).then((items) =>
      items.filter((item): item is DeviceShellInfo => item !== null),
    )
  }

  return shellCache
}

/** Descarta o cache de shells para forçar nova detecção na próxima chamada. */
export function refreshShellCache(): Promise<DeviceShellInfo[]> {
  shellCache = undefined

  return detectShells()
}

export async function detectShell(
  requested: DeviceShellKind,
): Promise<{ info: DeviceShellInfo; candidate: ShellCandidate }> {
  const candidates = IS_WINDOWS ? WINDOWS_CANDIDATES : UNIX_CANDIDATES

  if (requested === "auto") {
    const available = await detectShells()
    const preferred = candidates.find((candidate) =>
      available.some((item) => item.kind === candidate.kind),
    )

    if (!preferred) {
      throw new DeviceShellError(
        "shell_unavailable",
        "Nenhum shell compatível foi encontrado nesta máquina.",
      )
    }

    const info = available.find((item) => item.kind === preferred.kind)

    if (!info) {
      throw new DeviceShellError(
        "shell_unavailable",
        `O shell ${preferred.kind} não está disponível.`,
      )
    }

    return { info, candidate: preferred }
  }

  const candidate = candidates.find((item) => item.kind === requested)

  if (!candidate) {
    throw new DeviceShellError(
      "shell_unavailable",
      `O shell ${requested} não é compatível com ${process.platform}.`,
    )
  }

  const info = await describeCandidate(candidate)

  if (!info) {
    throw new DeviceShellError(
      "shell_unavailable",
      `O shell ${requested} não está instalado ou não está no PATH.`,
    )
  }

  return { info, candidate }
}

/** Diretórios que nunca podem ser alvo de escrita/exclusão, mesmo em Poder Total. */
export const PROTECTED_PATHS = [
  // Instalação e config interna do Spectral.
  join(__dirname, ".."),
  join(__dirname, "..", ".."),
  // Sistema do Windows.
  process.env.SystemRoot ?? join(process.env.windir ?? "C:", "Windows"),
  join(process.env.SystemRoot ?? join(process.env.windir ?? "C:", "Windows"), "System32"),
  join(process.env.SystemRoot ?? join(process.env.windir ?? "C:", "Windows"), "WinSxS"),
  join(process.env.SystemRoot ?? join(process.env.windir ?? "C:", "Windows"), "Boot"),
]

function isProtectedPath(real: string): boolean {
  const lower = real.toLowerCase()

  return PROTECTED_PATHS.some((root) => {
    const rootLower = root.toLowerCase()

    return lower === rootLower || lower.startsWith(rootLower + sep)
  })
}

export async function resolveWorkingDirectory(
  input: string | undefined,
  defaultFolder: string | undefined,
): Promise<string> {
  const requested = input ?? defaultFolder ?? homedir()
  const candidate = isAbsolute(requested)
    ? resolve(requested)
    : resolve(defaultFolder ?? homedir(), requested)

  let real: string

  try {
    real = await realpath(candidate)
  } catch {
    throw new DeviceShellError(
      "cwd_not_found",
      "O diretório de trabalho informado não existe.",
    )
  }

  const stats = await lstat(real).catch(() => null)

  if (!stats || !stats.isDirectory()) {
    throw new DeviceShellError(
      "not_a_directory",
      "O diretório de trabalho informado não é um diretório.",
    )
  }

  if (isProtectedPath(real)) {
    throw new DeviceShellError(
      "cwd_protected",
      "Este diretório é protegido pelo sistema e não pode ser usado como diretório de trabalho.",
    )
  }

  return real
}

/**
 * Allowlist de ambiente: o script recebe apenas o necessário para funcionar,
 * nunca os segredos do processo do driver.
 */
const BASE_ENV_NAMES = [
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "COMSPEC",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramData",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "windir",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "SHELL",
  "TZ",
  "USER",
  "LOGNAME",
  "NODE_ENV",
]

export function buildShellEnv(
  extra: Record<string, string> | undefined,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
  }

  for (const name of BASE_ENV_NAMES) {
    const value = process.env[name]

    if (value !== undefined) {
      env[name] = value
    }
  }

  if (env.PATH === undefined && process.env.Path !== undefined) {
    env.PATH = process.env.Path
  }

  // Evita que ferramentas interativas fiquem esperando entrada.
  env.CI = "1"
  env.NO_COLOR = "1"
  env.TERM = "dumb"

  if (extra) {
    Object.assign(env, extra)
  }

  return env
}

type ShellRunOptions = {
  scriptPath: string
  candidate: ShellCandidate
  cwd: string
  env: NodeJS.ProcessEnv
  stdin: string | undefined
  timeoutMs: number
  maxOutputBytes: number
}

type ShellRunOutcome = {
  exitCode: number
  stdout: string
  stderr: string
  stdoutBytes: number
  stderrBytes: number
  durationMs: number
  truncated: boolean
  timedOut: boolean
}

export async function killTree(pid: number) {
  try {
    if (IS_WINDOWS) {
      await execFileAsync("taskkill.exe", ["/pid", String(pid), "/T", "/F"], {
        timeout: KILL_TIMEOUT_MS,
        windowsHide: true,
      })
      return
    }

    process.kill(-pid, "SIGKILL")
  } catch {
    try {
      process.kill(pid, "SIGKILL")
    } catch {
      // O processo já terminou.
    }
  }
}

function runProcess(options: ShellRunOptions): Promise<ShellRunOutcome> {
  const { candidate } = options

  return new Promise<ShellRunOutcome>((resolvePromise, reject) => {
    const stdout = new BoundedOutput(options.maxOutputBytes)
    const stderr = new BoundedOutput(options.maxOutputBytes)
    const startedAt = Date.now()

    const child = spawn(candidate.command, shellCommandArgs(candidate, options.scriptPath), {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      // No Unix o processo vira líder do próprio grupo, o que permite matar a
      // árvore inteira (npm → node → workers) com um único sinal.
      detached: !IS_WINDOWS,
      stdio: ["pipe", "pipe", "pipe"],
      windowsVerbatimArguments: candidate.kind === "cmd" && IS_WINDOWS,
    })

    let timedOut = false
    let settled = false

    const timer = setTimeout(() => {
      timedOut = true
      void killTree(child.pid ?? -1)
    }, options.timeoutMs)

    function settle(outcome: ShellRunOutcome) {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      resolvePromise(outcome)
    }

    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk))
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk))

    if (options.stdin !== undefined) {
      child.stdin?.end(options.stdin)
    } else {
      child.stdin?.end()
    }

    child.on("error", (error) => {
      clearTimeout(timer)

      if (settled) {
        return
      }

      settled = true

      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new DeviceShellError(
            "shell_unavailable",
            "O shell selecionado não está disponível nesta máquina.",
          ),
        )
        return
      }

      reject(
        new DeviceShellError(
          "shell_failed",
          error.message || "Não foi possível iniciar o shell.",
        ),
      )
    })

    child.on("close", (code, signal) => {
      const exitCode =
        timedOut || signal
          ? -1
          : typeof code === "number"
            ? code
            : -1

      settle({
        exitCode,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        stdoutBytes: stdout.totalBytes,
        stderrBytes: stderr.totalBytes,
        durationMs: Date.now() - startedAt,
        truncated: stdout.truncated || stderr.truncated,
        timedOut,
      })
    })
  })
}

function wrapScript(kind: ShellCandidate["kind"], script: string): string {
  if (kind === "pwsh" || kind === "powershell") {
    // Garante UTF-8 na saída redirecionada do PowerShell 5.1.
    return [
      "$ProgressPreference = 'SilentlyContinue'",
      "try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch {}",
      script,
    ].join("\n")
  }

  if (kind === "cmd") {
    return ["@echo off", "chcp 65001 >nul", script].join("\r\n")
  }

  return script
}

/** Monta os argumentos do shell para executar o script temporário. */
export function shellCommandArgs(
  candidate: ShellCandidate,
  scriptPath: string,
): string[] {
  return [
    ...candidate.args,
    ...(candidate.kind === "cmd" && IS_WINDOWS
      ? [`"${scriptPath}"`]
      : [scriptPath]),
  ]
}

/**
 * Grava o script num arquivo temporário com nome aleatório. O chamador é dono
 * do diretório e precisa removê-lo (o shell curto remove ao terminar; o job
 * remove quando o processo sai).
 */
export async function prepareShellScript(
  candidate: ShellCandidate,
  script: string,
): Promise<{ directory: string; scriptPath: string }> {
  const directory = await mkdtemp(join(tmpdir(), "spectral-shell-"))
  const scriptPath = join(
    directory,
    `script-${randomUUID().slice(0, 8)}.${candidate.scriptExtension}`,
  )
  const wrapped = wrapScript(candidate.kind, script)

  // BOM no PowerShell: sem ele, o Windows PowerShell 5.1 lê UTF-8 como ANSI
  // e corrompe acentos em comandos e caminhos.
  const content =
    candidate.kind === "pwsh" || candidate.kind === "powershell"
      ? `\ufeff${wrapped}`
      : wrapped

  await writeFile(scriptPath, content, { encoding: "utf8", mode: 0o700 })

  return { directory, scriptPath }
}

export async function runShell(
  input: DeviceCommandInputMap["shell"],
  defaultFolder?: string,
): Promise<DeviceShellResult> {
  const cwd = await resolveWorkingDirectory(input.cwd, defaultFolder)
  const { info, candidate } = await detectShell(input.shell)
  const { directory, scriptPath } = await prepareShellScript(
    candidate,
    input.script,
  )

  try {
    const outcome = await runProcess({
      scriptPath,
      candidate,
      cwd,
      env: buildShellEnv(input.env),
      stdin: input.stdin,
      timeoutMs: input.timeoutMs,
      maxOutputBytes: input.maxOutputBytes,
    })

    return {
      shell: info.kind,
      shellPath: info.path,
      cwd,
      ...outcome,
    }
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
  }
}
