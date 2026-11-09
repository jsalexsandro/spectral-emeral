import { describe, expect, it } from "vitest"
import { commandResultMessageSchema } from "../../spectral/backend/src/websocket/messages"

const window = {
  id: "123",
  title: "Bloco de notas",
  processId: 4321,
  processName: "Notepad",
  bounds: { x: 0, y: 0, width: 800, height: 600 },
  focused: true,
  minimized: false,
}

function parseResult(result: unknown) {
  return commandResultMessageSchema.parse({
    type: "device:command:result",
    id: "req-1",
    result,
  })
}

describe("commandResultMessageSchema — janelas", () => {
  it("preserva windows na resposta de list-windows", () => {
    const parsed = parseResult({
      ok: true,
      windows: [window, { ...window, id: "456", minimized: true }],
    })

    expect(parsed.result.ok ? parsed.result.windows : undefined).toHaveLength(2)
  })

  it("preserva window na resposta de focus-window", () => {
    const parsed = parseResult({ ok: true, window })

    expect(parsed.result.ok ? parsed.result.window : undefined).toEqual(window)
  })

  it("aceita janela sem bounds", () => {
    const parsed = parseResult({
      ok: true,
      windows: [{ ...window, bounds: null }],
    })

    expect(
      parsed.result.ok ? parsed.result.windows?.[0]?.bounds : undefined,
    ).toBeNull()
  })
})
