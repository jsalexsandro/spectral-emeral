import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DEVICE_GET_SYSTEM_STATUS_TOOL_NAME,
  DEVICE_KILL_PROCESS_TOOL_NAME,
  DEVICE_LIST_PROCESSES_TOOL_NAME,
  DEVICE_LOCK_SCREEN_TOOL_NAME,
  DEVICE_MEDIA_CONTROL_TOOL_NAME,
  DEVICE_POWER_TOOL_NAME,
  DEVICE_SET_BRIGHTNESS_TOOL_NAME,
  DEVICE_SET_VOLUME_TOOL_NAME,
  createDeviceTools,
} from "./device-tools"

// O foco aqui é o resultado que chega ao modelo depois do transporte. A
// política real consulta o banco e é coberta em execution-policy.test.ts.
vi.mock("@/lib/devices/tool-approval", () => ({
  assertDeviceCommandAllowed: async () => ({
    ok: true,
    risk: "exec",
    policy: { confirmDestructive: false },
  }),
  describeAuditPolicy: () => "full",
  readDeviceToolCommand: () => undefined,
}))

vi.mock("@/lib/devices/audit", () => ({
  recordDeviceAudit: async () => {},
}))

function stubResult(result: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ result: { ok: true, ...result } })),
  )
}

const toolContext = { toolCallId: "call-1", messages: [], context: {} }

beforeEach(() => {
  vi.stubEnv("SPECTRAL_INTERNAL_SECRET", "test-secret")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("device command results — campos preservados", () => {
  it("repassa systemStatus de get-system-status", async () => {
    const systemStatus = {
      volume: null,
      muted: null,
      brightness: 29,
      battery: { percent: 34, charging: true, acConnected: false },
    }
    stubResult({ systemStatus })

    const tool = createDeviceTools("user-1")[DEVICE_GET_SYSTEM_STATUS_TOOL_NAME]
    const output = await tool.execute!(
      { deviceId: "device-1" },
      toolContext,
    )

    expect(output).toMatchObject({ ok: true, deviceId: "device-1", systemStatus })
  })

  it("repassa processes de list-processes", async () => {
    const processes = [
      {
        pid: 1234,
        name: "code.exe",
        commandLine: "code.exe .",
        memoryBytes: 1024,
        protected: false,
      },
    ]
    stubResult({ processes })

    const tool = createDeviceTools("user-1")[DEVICE_LIST_PROCESSES_TOOL_NAME]
    const output = await tool.execute!(
      { deviceId: "device-1", limit: 40 },
      toolContext,
    )

    expect(output).toMatchObject({ ok: true, processes })
  })

  it("repassa killed de kill-process", async () => {
    stubResult({ killed: true })

    const tool = createDeviceTools("user-1")[DEVICE_KILL_PROCESS_TOOL_NAME]
    const output = await tool.execute!(
      { deviceId: "device-1", pid: 1234, force: false, tree: false },
      toolContext,
    )

    expect(output).toMatchObject({ ok: true, killed: true })
  })

  it("repassa volume, brightness, locked, power e mediaControl", async () => {
    const tools = createDeviceTools("user-1")

    stubResult({ volume: { level: 40, muted: false } })
    expect(
      await tools[DEVICE_SET_VOLUME_TOOL_NAME].execute!(
        { deviceId: "device-1", level: 40 },
        toolContext,
      ),
    ).toMatchObject({ ok: true, volume: { level: 40, muted: false } })

    stubResult({ brightness: { level: 50 } })
    expect(
      await tools[DEVICE_SET_BRIGHTNESS_TOOL_NAME].execute!(
        { deviceId: "device-1", level: 50 },
        toolContext,
      ),
    ).toMatchObject({ ok: true, brightness: { level: 50 } })

    stubResult({ locked: true })
    expect(
      await tools[DEVICE_LOCK_SCREEN_TOOL_NAME].execute!(
        { deviceId: "device-1" },
        toolContext,
      ),
    ).toMatchObject({ ok: true, locked: true })

    stubResult({ power: { action: "shutdown", delaySec: 60 } })
    expect(
      await tools[DEVICE_POWER_TOOL_NAME].execute!(
        { deviceId: "device-1", action: "shutdown", delaySec: 60 },
        toolContext,
      ),
    ).toMatchObject({ ok: true, power: { action: "shutdown", delaySec: 60 } })

    stubResult({ mediaControl: { action: "play-pause" } })
    expect(
      await tools[DEVICE_MEDIA_CONTROL_TOOL_NAME].execute!(
        { deviceId: "device-1", action: "play-pause" },
        toolContext,
      ),
    ).toMatchObject({ ok: true, mediaControl: { action: "play-pause" } })
  })
})
