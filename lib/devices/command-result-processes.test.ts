import { describe, expect, it } from "vitest"
import { commandResultMessageSchema } from "../../spectral/backend/src/websocket/messages"

const processo = {
  pid: 1234,
  parentPid: 1,
  name: "notepad.exe",
  command: "C:\\Windows\\notepad.exe",
  memoryBytes: 10_000_000,
  startedAt: "2026-11-15T10:00:00Z",
  sessionId: 1,
}

function parseResult(result: unknown) {
  return commandResultMessageSchema.parse({
    type: "device:command:result",
    id: "req-1",
    result,
  })
}

describe("commandResultMessageSchema — processos", () => {
  it("preserva processes na resposta de list-processes", () => {
    const parsed = parseResult({
      ok: true,
      processes: [processo, { ...processo, pid: 5678, name: "chrome.exe" }],
    })

    expect(parsed.result.ok ? parsed.result.processes : undefined).toHaveLength(2)
  })

  it("preserva process na resposta de kill-process", () => {
    const parsed = parseResult({ ok: true, process: processo })

    expect(parsed.result.ok ? parsed.result.process : undefined).toEqual(processo)
  })

  it("preserva killed na resposta de kill-process", () => {
    const parsed = parseResult({ ok: true, killed: true })

    expect(parsed.result.ok ? parsed.result.killed : undefined).toBe(true)
  })

  it("recusa processo sem pid", () => {
    expect(() =>
      parseResult({
        ok: true,
        processes: [{ ...processo, pid: -1 }],
      }),
    ).toThrow()
  })

  it("limita processes a 100", () => {
    const muitos = Array.from({ length: 101 }, (_, i) => ({
      ...processo,
      pid: i + 1,
    }))

    expect(() => parseResult({ ok: true, processes: muitos })).toThrow()
  })
})
