import { afterAll, beforeEach, describe, expect, it } from "vitest"
import {
  DEVICE_JOB_MAX_ACTIVE,
  type DeviceJob,
  type DeviceJobStatus,
} from "../../../shared/device-commands.js"
import {
  DeviceJobError,
  cancelJob,
  getJob,
  listJobs,
  readJobOutput,
  shutdownJobs,
  startJob,
} from "./jobs.js"

const LONG_SCRIPT = "ping -n 30 127.0.0.1 > nul"
const READ_BYTES = 64 * 1024

async function waitForStatus(
  jobId: string,
  statuses: DeviceJobStatus[],
  timeoutMs = 20_000,
): Promise<DeviceJob> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const job = await getJob(jobId)

    if (statuses.includes(job.status)) {
      return job
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error(`Job ${jobId} não chegou a ${statuses.join("|")}.`)
}

describe.skipIf(process.platform !== "win32")("jobs", () => {
  beforeEach(async () => {
    // Isola cada teste: um job que sobrevive a uma falha não pode estourar o
    // limite do teste seguinte.
    await shutdownJobs()
  })

  afterAll(async () => {
    await shutdownJobs()
  })

  it("inicia, conclui e lê a saída por cursor sem repetir trechos", async () => {
    const started = await startJob({
      script: "echo primeiro\necho segundo",
      shell: "cmd",
      maxRuntimeMs: 10_000,
    })

    expect(started.id).toMatch(/[0-9a-f-]{36}/)
    expect(started.status).toBe("running")
    expect(started.shell).toBe("cmd")

    const done = await waitForStatus(started.id, ["exited", "failed", "killed"])

    expect(done.status).toBe("exited")
    expect(done.exitCode).toBe(0)
    expect(done.durationMs).toBeGreaterThanOrEqual(0)

    const first = await readJobOutput(started.id, 0, READ_BYTES)

    expect(first.chunks.length).toBeGreaterThan(0)
    expect(first.chunks.map((chunk) => chunk.text).join("")).toContain(
      "primeiro",
    )
    expect(first.chunks.every((chunk) => chunk.stream === "stdout")).toBe(true)
    expect(first.nextCursor).toBeGreaterThan(0)
    expect(first.truncated).toBe(false)

    const second = await readJobOutput(started.id, first.nextCursor, READ_BYTES)

    expect(second.chunks).toEqual([])
    expect(second.nextCursor).toBe(first.nextCursor)
  })

  it("separa stderr e permite reler a saída em fatias de bytes", async () => {
    const started = await startJob({
      script: "echo saida\necho erro 1>&2",
      shell: "cmd",
      maxRuntimeMs: 10_000,
    })

    await waitForStatus(started.id, ["exited", "failed", "killed"])

    const all = await readJobOutput(started.id, 0, READ_BYTES)
    const streams = new Set(all.chunks.map((chunk) => chunk.stream))

    expect(streams.has("stdout")).toBe(true)
    expect(streams.has("stderr")).toBe(true)

    // Fatias de 5 bytes precisam reconstruir exatamente o fluxo, avançando o
    // cursor sem pular nem repetir caracteres (inclusive multibyte).
    const fullText = all.chunks.map((chunk) => chunk.text).join("")
    let cursor = 0
    let rebuilt = ""

    for (let index = 0; index < 100 && cursor < all.nextCursor; index += 1) {
      const slice = await readJobOutput(started.id, cursor, 5)

      rebuilt += slice.chunks.map((chunk) => chunk.text).join("")

      if (slice.nextCursor === cursor) {
        break
      }

      cursor = slice.nextCursor
    }

    expect(rebuilt).toBe(fullText)
  })

  it("cancela um job em execução e mata a árvore", async () => {
    const started = await startJob({
      script: LONG_SCRIPT,
      shell: "cmd",
      maxRuntimeMs: 60_000,
      label: "ping longo",
    })

    const result = await cancelJob(started.id)

    expect(result.cancelled).toBe(true)
    expect(result.job.cancelled).toBe(true)

    const done = await waitForStatus(started.id, ["killed"])

    expect(done.status).toBe("killed")
    expect(done.exitCode === null || done.exitCode !== 0).toBe(true)

    // Cancelar de novo é idempotente e não relança o sinal.
    const again = await cancelJob(started.id)

    expect(again.cancelled).toBe(false)
  }, 20_000)

  it("respeita o limite de 3 jobs simultâneos", async () => {
    const started: string[] = []

    try {
      for (let index = 0; index < DEVICE_JOB_MAX_ACTIVE; index += 1) {
        const job = await startJob({
          script: LONG_SCRIPT,
          shell: "cmd",
          maxRuntimeMs: 60_000,
        })

        started.push(job.id)
      }

      await expect(
        startJob({
          script: LONG_SCRIPT,
          shell: "cmd",
          maxRuntimeMs: 60_000,
        }),
      ).rejects.toMatchObject({ code: "job_limit" })
    } finally {
      await Promise.all(started.map((jobId) => cancelJob(jobId)))
    }
  }, 20_000)

  it("encerra o job quando maxRuntimeMs vence", async () => {
    const started = await startJob({
      script: LONG_SCRIPT,
      shell: "cmd",
      maxRuntimeMs: 1_000,
    })

    const done = await waitForStatus(started.id, ["killed", "exited", "failed"])

    expect(done.status).toBe("killed")
    expect(done.timedOut).toBe(true)
  }, 30_000)

  it("lista jobs e rejeita id desconhecido", async () => {
    const started = await startJob({
      script: "echo listado",
      shell: "cmd",
      maxRuntimeMs: 10_000,
    })

    await waitForStatus(started.id, ["exited", "failed", "killed"])

    const listed = listJobs()

    expect(listed.some((job) => job.id === started.id)).toBe(true)

    await expect(getJob("inexistente")).rejects.toBeInstanceOf(DeviceJobError)
    await expect(
      readJobOutput("inexistente", 0, READ_BYTES),
    ).rejects.toBeInstanceOf(DeviceJobError)
  })

  it("espera ativa segura a chamada até o job terminar", async () => {
    const started = await startJob({
      script: "ping -n 4 127.0.0.1 > nul",
      shell: "cmd",
      maxRuntimeMs: 30_000,
    })

    expect(started.status).toBe("running")

    const began = Date.now()
    const done = await getJob(started.id, 15_000)

    expect(done.status).not.toBe("running")
    expect(Date.now() - began).toBeLessThan(15_000)
  }, 30_000)

  it("espera ativa na saída para quando chega texto novo", async () => {
    const started = await startJob({
      script: "ping -n 3 127.0.0.1 > nul & echo tarde",
      shell: "cmd",
      maxRuntimeMs: 30_000,
    })

    const began = Date.now()
    const first = await readJobOutput(started.id, 0, READ_BYTES, 10_000)
    const text = first.chunks.map((chunk) => chunk.text).join("")

    expect(text).toContain("tarde")
    expect(Date.now() - began).toBeGreaterThanOrEqual(1_000)

    const done = await getJob(started.id, 10_000)

    expect(done.status).toBe("exited")
    expect(done.exitCode).toBe(0)
  }, 30_000)
})
