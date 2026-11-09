import { describe, expect, it } from "vitest"
import { commandResultMessageSchema } from "../../spectral/backend/src/websocket/messages"

function parseResult(result: unknown) {
  return commandResultMessageSchema.parse({
    type: "device:command:result",
    id: "req-1",
    result,
  })
}

describe("commandResultMessageSchema — clipboard", () => {
  it("preserva texto, tamanho e estado de truncamento", () => {
    const parsed = parseResult({
      ok: true,
      clipboard: {
        text: "conteúdo copiado",
        length: 17,
        truncated: false,
      },
    })

    expect(parsed.result.ok ? parsed.result.clipboard : undefined).toEqual({
      text: "conteúdo copiado",
      length: 17,
      truncated: false,
    })
  })

  it("aceita texto vazio e marcado como truncado", () => {
    const parsed = parseResult({
      ok: true,
      clipboard: { text: "", length: 0, truncated: false },
    })

    expect(parsed.result.ok ? parsed.result.clipboard?.text : undefined).toBe("")

    expect(
      parseResult({
        ok: true,
        clipboard: { text: "a".repeat(100_000), length: 150_000, truncated: true },
      }).result.ok,
    ).toBe(true)
  })

  it("rejeita texto acima do limite e campos inválidos", () => {
    expect(() =>
      parseResult({
        ok: true,
        clipboard: { text: "a".repeat(100_001), length: 100_001, truncated: false },
      }),
    ).toThrow()

    expect(() =>
      parseResult({
        ok: true,
        clipboard: { text: "ok", length: -1, truncated: false },
      }),
    ).toThrow()

    expect(() =>
      parseResult({
        ok: true,
        clipboard: { text: "ok", length: 2 },
      }),
    ).toThrow()
  })
})
