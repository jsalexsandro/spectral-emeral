import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getScreenshot, saveScreenshot } from "@/lib/devices/screenshot-store"
import type { DeviceScreenshotToolOutput } from "@/lib/devices/screenshot-tool"
import {
  DEVICE_SCREENSHOT_TOOL_NAME,
  createDeviceTools,
} from "./device-tools"

const screenshot = {
  id: "6f1c2f7a-4a8a-4f8e-9d1b-2f7c9e6a1b3c",
  width: 1280,
  height: 720,
  scale: 2,
  monitor: null,
  region: { x: 0, y: 0, width: 2560, height: 1440 },
  format: "jpeg" as const,
  byteLength: 3,
  capturedAt: "2026-11-09T12:00:00.000Z",
}

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "spectral-screenshot-tool-"))
  vi.stubEnv("SPECTRAL_SCREENSHOT_DIR", directory)
  vi.stubEnv("SPECTRAL_INTERNAL_SECRET", "test-secret")
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        result: {
          ok: true,
          screenshot,
          imageBase64: Buffer.from("abc").toString("base64"),
        },
      }),
    ),
  )
})

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  await rm(directory, { recursive: true, force: true })
})

describe("device-screenshot tool", () => {
  it("guarda a imagem e expõe apenas metadados no resultado", async () => {
    const tool = createDeviceTools("user-1")[DEVICE_SCREENSHOT_TOOL_NAME]

    const result = await tool.execute!(
      {
        deviceId: "device-1",
        maxWidth: 1280,
        quality: 70,
        format: "jpeg",
      },
      { toolCallId: "call-1", messages: [], context: {} },
    )

    expect(result).toEqual({ ok: true, deviceId: "device-1", screenshot })
    expect("imageBase64" in result).toBe(false)

    const stored = await getScreenshot(screenshot.id)
    expect(stored?.deviceId).toBe("device-1")
    expect(stored?.width).toBe(screenshot.width)
    expect(stored?.height).toBe(screenshot.height)
    expect(stored?.region).toEqual(screenshot.region)
    expect(stored?.bytes.toString()).toBe("abc")
  })

  it("anexa a imagem ao modelo via toModelOutput", async () => {
    const tool = createDeviceTools("user-1")[DEVICE_SCREENSHOT_TOOL_NAME]
    const input = {
      deviceId: "device-1",
      maxWidth: 1280,
      quality: 70,
      format: "jpeg" as const,
    }
    const output = (await tool.execute!(input, {
      toolCallId: "call-1",
      messages: [],
      context: {},
    })) as DeviceScreenshotToolOutput

    const modelOutput = await tool.toModelOutput!({
      toolCallId: "call-1",
      input,
      output,
    })

    expect(modelOutput.type).toBe("content")

    if (modelOutput.type !== "content") {
      return
    }

    const file = modelOutput.value.find((part) => part.type === "file")
    const text = modelOutput.value.find((part) => part.type === "text")

    expect(text && "text" in text ? text.text : "").toContain(
      `screenshotId="${screenshot.id}"`,
    )
    expect(file?.mediaType).toBe("image/jpeg")
    expect(file && "data" in file ? file.data : null).toEqual({
      type: "data",
      data: Buffer.from("abc").toString("base64"),
    })
  })

  it("converte region normalizado da captura de referência e preserva o detalhe", async () => {
    await saveScreenshot({
      id: "shot_reference_1",
      deviceId: "device-1",
      format: "jpeg",
      base64: Buffer.from("ref").toString("base64"),
      width: 1280,
      height: 720,
      region: { x: 0, y: 0, width: 2560, height: 1440 },
    })

    const bodies: Array<{ command: string; input: unknown }> = []

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)) as {
          command: string
          input: unknown
        })
        return Response.json({
          result: {
            ok: true,
            screenshot,
            imageBase64: Buffer.from("abc").toString("base64"),
          },
        })
      }),
    )

    const tool = createDeviceTools("user-1")[DEVICE_SCREENSHOT_TOOL_NAME]

    await tool.execute!(
      {
        deviceId: "device-1",
        screenshotId: "shot_reference_1",
        region: { x: 250, y: 250, width: 250, height: 250 },
        maxWidth: 320,
        quality: 70,
        format: "jpeg",
      },
      { toolCallId: "call-1", messages: [], context: {} },
    )

    expect(bodies[0]).toMatchObject({
      command: "screenshot",
      input: {
        region: { x: 640, y: 360, width: 640, height: 360 },
        maxWidth: 640,
        quality: 70,
        format: "jpeg",
      },
    })
  })

  it("degrada para texto quando a imagem expirou", async () => {
    const tool = createDeviceTools("user-1")[DEVICE_SCREENSHOT_TOOL_NAME]
    const input = {
      deviceId: "device-1",
      maxWidth: 1280,
      quality: 70,
      format: "jpeg" as const,
    }
    const output = (await tool.execute!(input, {
      toolCallId: "call-1",
      messages: [],
      context: {},
    })) as DeviceScreenshotToolOutput

    await rm(directory, { recursive: true, force: true })

    const modelOutput = await tool.toModelOutput!({
      toolCallId: "call-1",
      input,
      output,
    })

    expect(modelOutput.type).toBe("text")
    expect(modelOutput.type === "text" ? modelOutput.value : "").toContain(
      "não está mais disponível",
    )
  })
})
