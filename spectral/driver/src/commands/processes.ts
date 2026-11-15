import { execFile } from "node:child_process"
import { promisify } from "node:util"
import {
  DEVICE_PROCESS_COMMAND_MAX_LENGTH,
  DEVICE_PROCESS_LIMIT_DEFAULT,
  DEVICE_PROCESS_LIMIT_MAX,
  DEVICE_PROCESS_QUERY_MAX_LENGTH,
  type DeviceProcessInfo,
} from "../../../shared/device-commands.js"

const execFileAsync = promisify(execFile)
const PROCESS_EXEC_TIMEOUT_MS = 20_000
const PROCESS_MAX_BUFFER_BYTES = 1024 * 1024
const MAX_ERROR_LENGTH = 900

/**
 * Nomes de processos críticos do Windows que nunca podem ser encerrados.
 * A comparação é feita em minúsculas contra o nome do executável.
 */
const CRITICAL_PROCESS_NAMES = new Set([
  "system",
  "registry",
  "smss",
  "csrss",
  "wininit",
  "winlogon",
  "services",
  "lsass",
  "lsaiso",
  "dwm",
  "svchost",
  "fontdrvhost",
  "memorycompression",
])

export class DeviceProcessError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceProcessError"
    this.code = code
  }
}

function errorMessage(error: unknown): string {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Falha ao executar o comando de processo no dispositivo."

  return message.slice(0, MAX_ERROR_LENGTH)
}

function unsupported(message: string): DeviceProcessError {
  return new DeviceProcessError("unsupported_platform", message)
}

/** Resultado cru de `Get-CimInstance Win32_Process`. */
type RawProcess = {
  ProcessId?: number
  ParentProcessId?: number
  Name?: string | null
  CommandLine?: string | null
  WorkingSetSize?: number | null
  CreationDate?: string | null
  SessionId?: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toInteger(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback
}

/**
 * Converte o formato de data do WMI (`YYYYMMDDHHMMSS.mmmmmm+Offset`) para
 * ISO 8601 UTC. Retorna null quando não dá para interpretar.
 */
function wmiDateToIso(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length < 14) {
    return null
  }

  const year = value.slice(0, 4)
  const month = value.slice(4, 6)
  const day = value.slice(6, 8)
  const hour = value.slice(8, 10)
  const minute = value.slice(10, 12)
  const second = value.slice(12, 14)

  if (!/^\d{14}$/.test(`${year}${month}${day}${hour}${minute}${second}`)) {
    return null
  }

  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
}

function normalizeProcess(raw: RawProcess): DeviceProcessInfo | null {
  const pid = toInteger(raw.ProcessId)
  const name = typeof raw.Name === "string" ? raw.Name.trim() : ""

  if (pid <= 0 || name.length === 0) {
    return null
  }

  const memoryBytes = toInteger(raw.WorkingSetSize)
  const command =
    typeof raw.CommandLine === "string"
      ? raw.CommandLine.trim().slice(0, DEVICE_PROCESS_COMMAND_MAX_LENGTH)
      : null

  return {
    pid,
    parentPid: toInteger(raw.ParentProcessId),
    name,
    command,
    memoryBytes: memoryBytes > 0 ? memoryBytes : null,
    startedAt: wmiDateToIso(raw.CreationDate),
    sessionId: raw.SessionId === undefined ? null : toInteger(raw.SessionId),
  }
}

/**
 * Lista de processos do Windows via `Get-CimInstance Win32_Process`. Retorna
 * vazio em plataformas não-Windows.
 */
export async function listProcesses(
  query?: string,
  limit: number = DEVICE_PROCESS_LIMIT_DEFAULT,
): Promise<DeviceProcessInfo[]> {
  if (process.platform !== "win32") {
    return []
  }

  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      String.raw`
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Get-CimInstance Win32_Process |
  Select-Object ProcessId, ParentProcessId, Name, CommandLine, WorkingSetSize, CreationDate, SessionId |
  ConvertTo-Json -Compress
`,
    ],
    {
      timeout: PROCESS_EXEC_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: PROCESS_MAX_BUFFER_BYTES,
    },
  )

  const parsed = JSON.parse(stdout || "[]")
  const entries = Array.isArray(parsed) ? parsed : [parsed]
  const processes: DeviceProcessInfo[] = []

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue
    }
    const process = normalizeProcess(entry)
    if (process === null) {
      continue
    }
    if (
      query !== undefined &&
      query.trim().length > 0 &&
      !process.name.toLowerCase().includes(query.toLowerCase()) &&
      !process.command?.toLowerCase().includes(query.toLowerCase())
    ) {
      continue
    }
    processes.push(process)
  }

  // Memória decrescente, depois nome e pid para ordem estável.
  processes.sort((a, b) => {
    const memA = a.memoryBytes ?? 0
    const memB = b.memoryBytes ?? 0
    if (memB !== memA) {
      return memB - memA
    }
    if (a.name !== b.name) {
      return a.name.localeCompare(b.name)
    }
    return a.pid - b.pid
  })

  return processes.slice(0, limit)
}

/**
 * Coleta os PIDs da cadeia de ancestrais do próprio driver (incluindo o driver
 * mesmo), subindo pelo `ParentProcessId` até não haver mais pai.
 *
 * Além da cadeia de ancestralidade, também protege qualquer processo cuja
 * linha de comando indique o driver Spectral (ex.: `tsx src/index.ts`),
 * porque o `process.pid` interno nem sempre corresponde ao PID visível no WMI
 * quando o driver roda via `npx`/`tsx`.
 */
export async function collectDriverAncestorPids(): Promise<Set<number>> {
  if (process.platform !== "win32") {
    return new Set([process.pid])
  }

  const all = await listProcesses(undefined, DEVICE_PROCESS_LIMIT_MAX)
  const byPid = new Map<number, DeviceProcessInfo>()
  for (const p of all) {
    byPid.set(p.pid, p)
  }

  const ancestors = new Set<number>()

  // Sempre proteger o próprio processo do driver
  ancestors.add(process.pid)

  // Proteger qualquer processo cuja linha de comando indica o driver Spectral,
  // porque o process.pid interno pode não bater com o PID visível no WMI.
  const driverPattern = /spectral\\driver|index\.ts|tsx/i
  for (const p of all) {
    if (p.command && driverPattern.test(p.command)) {
      ancestors.add(p.pid)
    }
  }

  // Subir pela cadeia de ancestrais a partir do próprio driver.
  let current: number | undefined = process.pid

  while (current !== undefined && !ancestors.has(current)) {
    ancestors.add(current)
    const processInfo = byPid.get(current)
    const parentPid: number | undefined =
      processInfo !== undefined ? processInfo.parentPid : undefined
    current =
      parentPid !== undefined && parentPid > 0 ? parentPid : undefined
  }

  return ancestors
}

/**
 * Verifica se um PID é protegido: <= 4, driver ou ancestral do driver, ou
 * processo crítico do sistema.
 */
/**
 * Verifica se um PID é protegido: <= 4, driver ou ancestral do driver, ou
 * processo crítico do sistema. Também protege qualquer processo cuja linha de
 * comando indique o driver Spectral (ex.: `tsx src/index.ts`).
 */
export function isProtectedProcess(
  pid: number,
  name: string,
  driverAncestors: Set<number>,
  command?: string | null,
): boolean {
  if (pid <= 4) {
    return true
  }

  if (driverAncestors.has(pid)) {
    return true
  }

  // Proteger qualquer processo do driver identificado pela linha de comando.
  if (command && /spectral\\driver|index\.ts|tsx/i.test(command)) {
    return true
  }

  return CRITICAL_PROCESS_NAMES.has(name.toLowerCase().replace(/\.exe$/, ""))
}

/**
 * Enumera descendentes diretos de um PID a partir da lista de processos
 * (filhos pelo `parentPid`), usados para validar `tree`.
 */
export function collectDescendantPids(
  rootPid: number,
  processes: DeviceProcessInfo[],
): number[] {
  const byParent = new Map<number, number[]>()
  for (const p of processes) {
    const children = byParent.get(p.parentPid) ?? []
    children.push(p.pid)
    byParent.set(p.parentPid, children)
  }

  const descendants: number[] = []
  const stack = [rootPid]

  while (stack.length > 0) {
    const current = stack.pop()!
    const children = byParent.get(current) ?? []
    for (const child of children) {
      descendants.push(child)
      stack.push(child)
    }
  }

  return descendants
}

/**
 * Mata um processo pelo PID no Windows usando `taskkill.exe`.
 * - `force` adiciona `/F`.
 * - `tree` adiciona `/T` (mata a árvore).
 * Retorna true quando o processo some após o comando.
 */
export async function killProcess(
  pid: number,
  options: { force?: boolean; tree?: boolean },
  processes: DeviceProcessInfo[],
  driverAncestors: Set<number>,
): Promise<{ killed: boolean }> {
  const target = processes.find((p) => p.pid === pid)

  if (target === undefined) {
    throw new DeviceProcessError(
      "process_not_found",
      `Processo ${pid} não encontrado.`,
    )
  }

  if (isProtectedProcess(pid, target.name, driverAncestors, target.command)) {
    throw new DeviceProcessError(
      "protected_process",
      `Processo ${pid} (${target.name}) é protegido e não pode ser encerrado.`,
    )
  }

  if (options.tree === true) {
    const descendants = collectDescendantPids(pid, processes)
    for (const descendant of descendants) {
      const descendantProcess = processes.find((p) => p.pid === descendant)
      if (
        descendantProcess !== undefined &&
        isProtectedProcess(
          descendant,
          descendantProcess.name,
          driverAncestors,
          descendantProcess.command,
        )
      ) {
        throw new DeviceProcessError(
          "protected_process",
          `Processo ${descendant} (${descendantProcess.name}) na árvore de ${pid} é protegido.`,
        )
      }
    }
  }

  const args = ["/PID", String(pid)]

  if (options.tree === true) {
    args.push("/T")
  }

  if (options.force === true) {
    args.push("/F")
  }

  try {
    await execFileAsync("taskkill.exe", args, {
      timeout: PROCESS_EXEC_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: PROCESS_MAX_BUFFER_BYTES,
    })
  } catch (error) {
    const message = errorMessage(error)
    throw new DeviceProcessError(
      "process_kill_failed",
      `Não foi possível encerrar o processo ${pid}: ${message}`,
    )
  }

  // Verifica se o processo realmente sumiu (até ~2 s).
  const deadline = Date.now() + 2_000

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const stillAlive = processes.some((p) => p.pid === pid)

    // Recarrega a lista para refletir a morte do processo.
    const updated = await listProcesses()
    if (!updated.some((p) => p.pid === pid)) {
      return { killed: true }
    }
  }

  throw new DeviceProcessError(
    "process_kill_failed",
    `Processo ${pid} ainda está em execução após o encerramento.`,
  )
}
