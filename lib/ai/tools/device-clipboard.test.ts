import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DEVICE_READ_CLIPBOARD_TOOL_NAME,
  DEVICE_WRITE_CLIPBOARD_TOOL_NAME,
  createDeviceTools,
} from "./device-tools"

// Estes testes verificam a montagem do comando, não a política (que exige DB).
vi.mock("@/lib/devices/tool-approval", () => ({
  assertDeviceCommandAllowed: async () => ({
    ok: true,
    risk: "write",
    policy: { level: "full" },
  }),
  readDeviceToolCommand: () => undefined,
}))

vi.mock("@/lib/devices/audit", () => ({
  recordDeviceAudit: async () => {},
}))

beforeEach(() => {
  vi.stubEnv("SPECTRAL_INTERNAL_SECRET", "test-secret")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function stubCommandResult(result: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ result })),
  )
}

describe("device clipboard tools", () => {
  it("devolve texto, tamanho e truncamento da leitura", async () => {
    const clipboard = {
      text: "linha 1\nlinha 2",
      length: 120_000,
      truncated: true,
    }
    stubCommandResult({ ok: true, clipboard })

    const tool = createDeviceTools("user-1")[DEVICE_READ_CLIPBOARD_TOOL_NAME]
    const result = await tool.execute!(
      { deviceId: "device-1" },
      { toolCallId: "call-1", messages: [], context: {} },
    )

    expect(result).toEqual({ ok: true, deviceId: "device-1", clipboard })
  })

  it("confirma a escrita sem expor o texto de volta", async () => {
    stubCommandResult({ ok: true })

    const tool = createDeviceTools("user-1")[DEVICE_WRITE_CLIPBOARD_TOOL_NAME]
    const result = await tool.execute!(
      { deviceId: "device-1", text: "teste spectral" },
      { toolCallId: "call-1", messages: [], context: {} },
    )

    expect(result).toEqual({ ok: true, deviceId: "device-1" })
    expect("clipboard" in result).toBe(false)
  })

  it("propaga o erro do driver", async () => {
    stubCommandResult({
      ok: false,
      code: "clipboard_unavailable",
      error: "Não foi possível ler o clipboard.",
    })

    const tool = createDeviceTools("user-1")[DEVICE_READ_CLIPBOARD_TOOL_NAME]
    const result = await tool.execute!(
      { deviceId: "device-1" },
      { toolCallId: "call-1", messages: [], context: {} },
    )

    expect(result).toEqual({
      ok: false,
      code: "clipboard_unavailable",
      error: "Não foi possível ler o clipboard.",
    })
  })
})
