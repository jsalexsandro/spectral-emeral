import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { saveScreenshot } from "@/lib/devices/screenshot-store"
import {
  DEVICE_CLICK_TOOL_NAME,
  DEVICE_DRAG_TOOL_NAME,
  DEVICE_MOVE_MOUSE_TOOL_NAME,
  DEVICE_SCROLL_TOOL_NAME,
  createDeviceTools,
  deviceClickInputSchema,
} from "./device-tools"

// Estes testes verificam a montagem do comando, não a política (que exige DB).
vi.mock("@/lib/devices/tool-approval", () => ({
  assertDeviceCommandAllowed: async () => ({
    ok: true,
    risk: "input",
    policy: { level: "full" },
  }),
  readDeviceToolCommand: () => undefined,
}))

vi.mock("@/lib/devices/audit", () => ({
  recordDeviceAudit: async () => {},
}))

const screenshotId = "shot_mouse_1"
let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "spectral-mouse-tool-"))
  vi.stubEnv("SPECTRAL_SCREENSHOT_DIR", directory)
  vi.stubEnv("SPECTRAL_INTERNAL_SECRET", "test-secret")
})

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  await rm(directory, { recursive: true, force: true })
})

async function saveMouseScreenshot(deviceId = "device-1") {
  await saveScreenshot({
    id: screenshotId,
    deviceId,
    format: "jpeg",
    base64: Buffer.from("abc").toString("base64"),
    width: 1280,
    height: 720,
    region: { x: 100, y: 50, width: 2560, height: 1440 },
  })
}

type CommandBody = {
  userId: string
  command: string
  input: unknown
}

function stubCommands(result: unknown = { ok: true }) {
  const calls: CommandBody[] = []

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)) as CommandBody)
      return Response.json({ result })
    }),
  )

  return calls
}

const toolContext = { toolCallId: "call-1", messages: [], context: {} }

function commandOf(call: CommandBody | undefined) {
  return call ? { command: call.command, input: call.input } : undefined
}

describe("device mouse tools", () => {
  it("envia move-mouse com as coordenadas nativas", async () => {
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_MOVE_MOUSE_TOOL_NAME]

    const result = await tool.execute!(
      { deviceId: "device-1", x: 120, y: -40 },
      toolContext,
    )

    expect(result).toEqual({ ok: true, deviceId: "device-1" })
    expect(commandOf(calls[0])).toEqual({
      command: "move-mouse",
      input: { x: 120, y: -40 },
    })
  })

  it("envia clique com botão e contagem", async () => {
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_CLICK_TOOL_NAME]

    await tool.execute!(
      {
        deviceId: "device-1",
        x: 10,
        y: 20,
        button: "right",
        count: 2,
      },
      toolContext,
    )

    expect(commandOf(calls[0])).toEqual({
      command: "click",
      input: { x: 10, y: 20, button: "right", count: 2 },
    })
  })

  it("permite clicar na posição atual do cursor", async () => {
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_CLICK_TOOL_NAME]

    await tool.execute!(
      { deviceId: "device-1", button: "left", count: 1 },
      toolContext,
    )

    expect(commandOf(calls[0])).toEqual({
      command: "click",
      input: { button: "left", count: 1 },
    })
  })

  it("envia scroll com direção e quantidade", async () => {
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_SCROLL_TOOL_NAME]

    await tool.execute!(
      { deviceId: "device-1", direction: "down", amount: 5 },
      toolContext,
    )

    expect(commandOf(calls[0])).toEqual({
      command: "scroll",
      input: { direction: "down", amount: 5 },
    })
  })

  it("envia drag com os dois pontos e a duração", async () => {
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_DRAG_TOOL_NAME]

    await tool.execute!(
      {
        deviceId: "device-1",
        from: { x: 0, y: 0 },
        to: { x: 100, y: 50 },
        button: "left",
        durationMs: 500,
      },
      toolContext,
    )

    expect(commandOf(calls[0])).toEqual({
      command: "drag",
      input: {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 50 },
        button: "left",
        durationMs: 500,
      },
    })
  })

  it("converte coordenadas normalizadas para pixels nativos com screenshotId", async () => {
    await saveMouseScreenshot()
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_MOVE_MOUSE_TOOL_NAME]

    await tool.execute!(
      { deviceId: "device-1", x: 500, y: 500, screenshotId },
      toolContext,
    )

    expect(commandOf(calls[0])).toEqual({
      command: "move-mouse",
      input: { x: 1380, y: 770 },
    })
  })

  it("converte o clique e mantém botão e contagem", async () => {
    await saveMouseScreenshot()
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_CLICK_TOOL_NAME]

    await tool.execute!(
      {
        deviceId: "device-1",
        x: 10,
        y: 20,
        button: "right",
        count: 2,
        screenshotId,
      },
      toolContext,
    )

    expect(commandOf(calls[0])).toEqual({
      command: "click",
      input: { x: 126, y: 79, button: "right", count: 2 },
    })
  })

  it("converte os dois pontos do arrasto", async () => {
    await saveMouseScreenshot()
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_DRAG_TOOL_NAME]

    await tool.execute!(
      {
        deviceId: "device-1",
        from: { x: 0, y: 0 },
        to: { x: 100, y: 50 },
        button: "left",
        durationMs: 500,
        screenshotId,
      },
      toolContext,
    )

    expect(commandOf(calls[0])).toEqual({
      command: "drag",
      input: {
        from: { x: 100, y: 50 },
        to: { x: 356, y: 122 },
        button: "left",
        durationMs: 500,
      },
    })
  })

  it("limita a borda direita e inferior da captura", async () => {
    await saveMouseScreenshot()
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_MOVE_MOUSE_TOOL_NAME]

    await tool.execute!(
      { deviceId: "device-1", x: 1000, y: 1000, screenshotId },
      toolContext,
    )

    expect(commandOf(calls[0])).toEqual({
      command: "move-mouse",
      input: { x: 2659, y: 1489 },
    })
  })

  it("rejeita captura inexistente, de outro dispositivo ou ponto fora da imagem", async () => {
    const tool = createDeviceTools("user-1")[DEVICE_MOVE_MOUSE_TOOL_NAME]
    const missing = await tool.execute!(
      { deviceId: "device-1", x: 1, y: 2, screenshotId: "shot_missing_1" },
      toolContext,
    )

    expect(missing).toMatchObject({ ok: false, code: "screenshot_not_found" })

    await saveMouseScreenshot("device-2")
    const mismatch = await tool.execute!(
      { deviceId: "device-1", x: 1, y: 2, screenshotId },
      toolContext,
    )

    expect(mismatch).toMatchObject({
      ok: false,
      code: "screenshot_device_mismatch",
    })

    await saveMouseScreenshot()
    const outside = await tool.execute!(
      { deviceId: "device-1", x: 1280, y: 2, screenshotId },
      toolContext,
    )

    expect(outside).toMatchObject({ ok: false, code: "invalid_coordinates" })
  })

  it("exige x e y quando screenshotId é informado", () => {
    const result = deviceClickInputSchema.safeParse({
      deviceId: "device-1",
      screenshotId,
    })

    expect(result.success).toBe(false)
  })

  it("propaga o erro do driver", async () => {
    stubCommands({
      ok: false,
      code: "permission_denied",
      error: "O macOS exige permissão de Acessibilidade para controlar o mouse.",
    })

    const tool = createDeviceTools("user-1")[DEVICE_MOVE_MOUSE_TOOL_NAME]
    const result = await tool.execute!(
      { deviceId: "device-1", x: 1, y: 2 },
      toolContext,
    )

    expect(result).toEqual({
      ok: false,
      code: "permission_denied",
      error: "O macOS exige permissão de Acessibilidade para controlar o mouse.",
    })
  })
})
