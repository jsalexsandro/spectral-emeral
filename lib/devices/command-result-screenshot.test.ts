import { describe, expect, it } from "vitest"
import { commandResultMessageSchema } from "../../spectral/backend/src/websocket/messages"

const screenshot = {
  id: "6f1c2f7a-4a8a-4f8e-9d1b-2f7c9e6a1b3c",
  width: 1280,
  height: 720,
  scale: 2,
  monitor: 1,
  region: { x: 0, y: 0, width: 2560, height: 1440 },
  format: "jpeg" as const,
  byteLength: 180_000,
  capturedAt: "2026-11-09T12:00:00.000Z",
}

function parseResult(result: unknown) {
  return commandResultMessageSchema.parse({
    type: "device:command:result",
    id: "req-1",
    result,
  })
}

describe("commandResultMessageSchema — screenshot", () => {
  it("preserva os metadados e os bytes da captura", () => {
    const parsed = parseResult({
      ok: true,
      screenshot,
      imageBase64: "aGVsbG8=",
    })

    expect(parsed.result.ok ? parsed.result.screenshot : undefined).toEqual(
      screenshot,
    )
    expect(parsed.result.ok ? parsed.result.imageBase64 : undefined).toBe(
      "aGVsbG8=",
    )
  })

  it("aceita captura de tela inteira sem monitor", () => {
    const parsed = parseResult({
      ok: true,
      screenshot: { ...screenshot, monitor: null },
    })

    expect(parsed.result.ok ? parsed.result.screenshot?.monitor : undefined).toBe(
      null,
    )
  })

  it("rejeita formato, escala e região inválidos", () => {
    expect(() =>
      parseResult({
        ok: true,
        screenshot: { ...screenshot, format: "webp" },
      }),
    ).toThrow()

    expect(() =>
      parseResult({
        ok: true,
        screenshot: { ...screenshot, scale: 0 },
      }),
    ).toThrow()

    expect(() =>
      parseResult({
        ok: true,
        screenshot: {
          ...screenshot,
          region: { x: 0, y: 0, width: 0, height: 100 },
        },
      }),
    ).toThrow()
  })

  it("rejeita imagem base64 vazia", () => {
    expect(() =>
      parseResult({ ok: true, imageBase64: "" }),
    ).toThrow()
  })
})
