import { spawn, type ChildProcess } from "node:child_process"
import { rm } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { StringDecoder } from "node:string_decoder"
import {
  DEVICE_JOB_BUFFER_BYTES,
  DEVICE_JOB_MAX_ACTIVE,
  DEVICE_JOB_RETENTION_MS,
  type DeviceCommandInputMap,
  type DeviceJob,
  type DeviceJobChunk,
  type DeviceJobOutput,
  type DeviceJobStatus,
  type DeviceJobStream,
  type DeviceShellKind,
} from "../../../shared/device-commands.js"
import {
  buildShellEnv,
  detectShell,
  killTree,
  prepareShellScript,
  resolveWorkingDirectory,
  shellCommandArgs,
} from "./shell.js"

const IS_WINDOWS = process.platform === "win32"
const CANCEL_WAIT_MS = 2_000
const ERROR_MAX_LENGTH = 900
const WAIT_POLL_MS = 150

export class DeviceJobError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DeviceJobError"
    this.code = code
  }
}

/**
 * Buffer circular por cursor. O cursor é a contagem monotônica de code units
 * UTF-16 do fluxo combinado (stdout + stderr na ordem de chegada); quando o
 * buffer estoura, o começo é descartado e `startCursor` passa a apontar para o
 * primeiro caractere ainda retido. Cabeça e cauda (como no shell curto) não
 * servem aqui, porque o cursor precisa avançar sem pular trechos.
 */
class JobOutputBuffer {
  private readonly chunks: DeviceJobChunk[] = []
  private readonly maxChars: number
  private retained = 0
  private total = 0

  constructor(maxChars: number) {
    this.maxChars = Math.max(1024, maxChars)
  }

  push(stream: DeviceJobStream, text: string) {
    if (text.length === 0) {
      return
    }

    this.chunks.push({ cursor: this.total, stream, text })
    this.total += text.length
    this.retained += text.length
    this.trim()
  }

  private trim() {
    while (this.retained > this.maxChars && this.chunks.length > 0) {
      const first = this.chunks[0]

      if (!first) {
        break
      }

      const excess = this.retained - this.maxChars

      if (first.text.length <= excess) {
        this.chunks.shift()
        this.retained -= first.text.length
        continue
      }

      this.chunks[0] = {
        cursor: first.cursor + excess,
        stream: first.stream,
        text: first.text.slice(excess),
      }
      this.retained -= excess
    }
  }

  get nextCursor(): number {
    return this.total
  }

  get startCursor(): number {
    return this.chunks[0]?.cursor ?? this.total
  }

  get truncated(): boolean {
    return this.startCursor > 0
  }

  read(cursor: number, maxBytes: number): Omit<
    DeviceJobOutput,
    "jobId" | "status" | "exitCode" | "cancelled"
  > {
    const startCursor = this.startCursor
    const from = Math.min(Math.max(cursor, startCursor), this.total)
    const chunks: DeviceJobChunk[] = []
    let bytes = 0

    for (const chunk of this.chunks) {
      const end = chunk.cursor + chunk.text.length

      if (end <= from) {
        continue
      }

      const offset = Math.max(0, from - chunk.cursor)
      let text = chunk.text.slice(offset)
      const chunkCursor = chunk.cursor + offset
      const room = maxBytes - bytes

      if (room <= 0) {
        break
      }

      if (Buffer.byteLength(text, "utf8") > room) {
        let cut = 0
        let used = 0

        for (const symbol of text) {
          const size = Buffer.byteLength(symbol, "utf8")

          if (used + size > room) {
            break
          }

          used += size
          cut += symbol.length
        }

        if (cut === 0) {
          break
        }

        text = text.slice(0, cut)
      }

      chunks.push({ cursor: chunkCursor, stream: chunk.stream, text })
      bytes += Buffer.byteLength(text, "utf8")

      if (bytes >= maxBytes) {
        break
      }
    }

    const last = chunks[chunks.length - 1]
    const nextCursor = last ? last.cursor + last.text.length : from

    return {
      startCursor,
      chunks,
      nextCursor,
      truncated: cursor < startCursor,
    }
  }
}

type Job = {
  id: string
  label: string | null
  shell: Exclude<DeviceShellKind, "auto">
  shellPath: string
  cwd: string
  startedAt: number
  finishedAt: number | null
  status: DeviceJobStatus
  exitCode: number | null
  error: string | null
  stdoutBytes: number
  stderrBytes: number
  timedOut: boolean
  cancelled: boolean
  buffer: JobOutputBuffer
  child: ChildProcess
  directory: string
  maxRuntimeTimer: NodeJS.Timeout
  retentionTimer: NodeJS.Timeout | null
}

const jobs = new Map<string, Job>()
let starting = 0

function errorMessage(error: unknown): string {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Falha ao executar o job."

  return message.slice(0, ERROR_MAX_LENGTH)
}

function snapshot(job: Job): DeviceJob {
  return {
    id: job.id,
    label: job.label,
    status: job.status,
    shell: job.shell,
    shellPath: job.shellPath,
    cwd: job.cwd,
    startedAt: new Date(job.startedAt).toISOString(),
    durationMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    exitCode: job.exitCode,
    error: job.error,
    stdoutBytes: job.stdoutBytes,
    stderrBytes: job.stderrBytes,
    outputChars: job.buffer.nextCursor,
    truncated: job.buffer.truncated,
    timedOut: job.timedOut,
    cancelled: job.cancelled,
  }
}

function countActive(): number {
  let active = 0

  for (const job of jobs.values()) {
    if (job.status === "running") {
      active += 1
    }
  }

  return active
}

function forgetJob(job: Job) {
  clearTimeout(job.maxRuntimeTimer)

  if (job.retentionTimer) {
    clearTimeout(job.retentionTimer)
    job.retentionTimer = null
  }

  jobs.delete(job.id)
  void rm(job.directory, { recursive: true, force: true }).catch(
    () => undefined,
  )
}

/** Remove jobs concluídos cujo prazo de retenção já venceu. */
function purgeExpired(now = Date.now()) {
  for (const job of [...jobs.values()]) {
    if (
      job.status !== "running" &&
      job.finishedAt !== null &&
      now - job.finishedAt >= DEVICE_JOB_RETENTION_MS
    ) {
      forgetJob(job)
    }
  }
}

function finish(job: Job, status: DeviceJobStatus) {
  if (job.status !== "running") {
    return
  }

  job.status = status
  job.finishedAt = Date.now()
  clearTimeout(job.maxRuntimeTimer)
  void rm(job.directory, { recursive: true, force: true }).catch(
    () => undefined,
  )

  // O processo já saiu; o buffer fica disponível por um tempo para o modelo
  // terminar de ler a saída, depois o job some sozinho.
  job.retentionTimer = setTimeout(() => {
    job.retentionTimer = null
    forgetJob(job)
  }, DEVICE_JOB_RETENTION_MS)
  job.retentionTimer.unref?.()
}

function requireJob(jobId: string): Job {
  const job = jobs.get(jobId)

  if (!job) {
    throw new DeviceJobError(
      "job_not_found",
      "Job não encontrado. Ele pode ter expirado ou o driver foi reiniciado.",
    )
  }

  return job
}

/**
 * Mata a árvore do job. PIDs inválidos (processo já colhido) não podem ir para
 * `killTree`, porque `-1` no Unix sinaliza o grupo inteiro do driver.
 */
function killJob(job: Job): Promise<void> {
  const pid = job.child.pid

  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    return Promise.resolve()
  }

  return killTree(pid)
}

/** Último recurso quando o `taskkill`/sinal não fecha o processo a tempo. */
function forceKillJob(job: Job) {
  const pid = job.child.pid

  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    return
  }

  try {
    process.kill(pid, "SIGKILL")
  } catch {
    // O processo já terminou.
  }
}

function waitForClose(job: Job, timeoutMs: number): Promise<void> {
  if (job.finishedAt !== null) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer)
      job.child.removeListener("close", done)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    timer.unref?.()
    job.child.once("close", done)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Espera ativa para status/saída. O modelo não tem como dormir entre
 * chamadas; sem isso ele faz polling em rajada (dezenas de status seguidos).
 * Para quando o predicado fica verdadeiro ou quando o teto estoura.
 */
async function waitForChange(
  waitMs: number,
  predicate: () => boolean,
): Promise<void> {
  if (waitMs <= 0) {
    return
  }

  const deadline = Date.now() + waitMs

  while (Date.now() < deadline) {
    if (predicate()) {
      return
    }

    await sleep(Math.min(WAIT_POLL_MS, Math.max(0, deadline - Date.now())))
  }
}

export async function startJob(
  input: DeviceCommandInputMap["job-start"],
  defaultFolder?: string,
): Promise<DeviceJob> {
  purgeExpired()

  // Reserva a vaga antes dos `await` de preparação para dois start
  // simultâneos não passarem juntos pelo limite.
  if (countActive() + starting >= DEVICE_JOB_MAX_ACTIVE) {
    throw new DeviceJobError(
      "job_limit",
      `O limite de ${DEVICE_JOB_MAX_ACTIVE} jobs simultâneos foi atingido. Cancele um job ou espere terminar.`,
    )
  }

  starting += 1

  try {
    const cwd = await resolveWorkingDirectory(input.cwd, defaultFolder)
    const { info, candidate } = await detectShell(input.shell)
    const script = await prepareShellScript(candidate, input.script)
    const id = randomUUID()
    const startedAt = Date.now()
    const buffer = new JobOutputBuffer(DEVICE_JOB_BUFFER_BYTES)

    let child: ChildProcess

    try {
      child = spawn(
        candidate.command,
        shellCommandArgs(candidate, script.scriptPath),
        {
          cwd,
          env: buildShellEnv(input.env),
          windowsHide: true,
          detached: !IS_WINDOWS,
          // Sem stdin: processos que esperam entrada recebem EOF em vez de travar.
          stdio: ["ignore", "pipe", "pipe"],
          windowsVerbatimArguments: candidate.kind === "cmd" && IS_WINDOWS,
        },
      )
    } catch (error) {
      await rm(script.directory, { recursive: true, force: true }).catch(
        () => undefined,
      )
      throw new DeviceJobError("job_failed", errorMessage(error))
    }

    const job: Job = {
      id,
      label: input.label ?? null,
      shell: info.kind,
      shellPath: info.path,
      cwd,
      startedAt,
      finishedAt: null,
      status: "running",
      exitCode: null,
      error: null,
      stdoutBytes: 0,
      stderrBytes: 0,
      timedOut: false,
      cancelled: false,
      buffer,
      child,
      directory: script.directory,
      maxRuntimeTimer: setTimeout(() => {
        job.timedOut = true
        void killJob(job)
      }, input.maxRuntimeMs),
      retentionTimer: null,
    }

    job.maxRuntimeTimer.unref?.()

    const stdout = new StringDecoder("utf8")
    const stderr = new StringDecoder("utf8")

    child.stdout?.on("data", (chunk: Buffer) => {
      job.stdoutBytes += chunk.length
      buffer.push("stdout", stdout.write(chunk))
    })

    child.stderr?.on("data", (chunk: Buffer) => {
      job.stderrBytes += chunk.length
      buffer.push("stderr", stderr.write(chunk))
    })

    child.on("error", (error) => {
      buffer.push("stdout", stdout.end())
      buffer.push("stderr", stderr.end())
      job.error = errorMessage(error)
      finish(job, "failed")
    })

    child.on("close", (code) => {
      buffer.push("stdout", stdout.end())
      buffer.push("stderr", stderr.end())
      job.exitCode = typeof code === "number" ? code : null

      if (job.cancelled || job.timedOut) {
        finish(job, "killed")
        return
      }

      finish(job, job.error ? "failed" : "exited")
    })

    jobs.set(id, job)

    return snapshot(job)
  } finally {
    starting -= 1
  }
}

export async function getJob(jobId: string, waitMs = 0): Promise<DeviceJob> {
  purgeExpired()
  const job = requireJob(jobId)

  await waitForChange(waitMs, () => job.status !== "running")

  return snapshot(job)
}

export async function readJobOutput(
  jobId: string,
  cursor: number,
  maxBytes: number,
  waitMs = 0,
): Promise<DeviceJobOutput> {
  purgeExpired()
  const job = requireJob(jobId)

  await waitForChange(
    waitMs,
    () => job.buffer.nextCursor > cursor || job.status !== "running",
  )

  return {
    ...job.buffer.read(cursor, maxBytes),
    jobId,
    status: job.status,
    exitCode: job.exitCode,
    cancelled: job.cancelled,
  }
}

export function listJobs(): DeviceJob[] {
  purgeExpired()

  return [...jobs.values()]
    .sort((left, right) => right.startedAt - left.startedAt)
    .map(snapshot)
}

export async function cancelJob(jobId: string): Promise<{
  cancelled: boolean
  job: DeviceJob
}> {
  purgeExpired()

  const job = requireJob(jobId)

  if (job.status !== "running") {
    return { cancelled: false, job: snapshot(job) }
  }

  job.cancelled = true
  await killJob(job).catch(() => undefined)
  await waitForClose(job, CANCEL_WAIT_MS)

  // Se nem o sinal derrubou o processo no prazo, tenta o término direto para
  // não deixar a árvore viva atrás do job cancelado.
  if (job.finishedAt === null) {
    forceKillJob(job)
    await waitForClose(job, CANCEL_WAIT_MS / 2)
  }

  return { cancelled: true, job: snapshot(job) }
}

/** Mata todos os jobs em andamento quando o driver está encerrando. */
export async function shutdownJobs(): Promise<void> {
  const running = [...jobs.values()].filter((job) => job.status === "running")

  for (const job of running) {
    clearTimeout(job.maxRuntimeTimer)
  }

  await Promise.all(running.map(killJob))

  for (const job of running) {
    forgetJob(job)
  }
}
