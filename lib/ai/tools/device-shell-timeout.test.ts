import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DEVICE_RUN_COMMAND_TOOL_NAME,
  DEVICE_SHELL_TOOL_NAME,
  createDeviceTools,
  deviceShellInputSchema,
} from "./device-tools"

// O foco aqui é o orçamento de tempo que sai da tool para o transporte, não a
// política (que consulta o banco).
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

type CommandBody = {
  userId: string
  command: string
  input: unknown
  timeoutMs?: number
}

function stubCommands() {
  const calls: CommandBody[] = []

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)) as CommandBody)
      return Response.json({ result: { ok: true } })
    }),
  )

  return calls
}

const toolContext = { toolCallId: "call-1", messages: [], context: {} }

beforeEach(() => {
  vi.stubEnv("SPECTRAL_INTERNAL_SECRET", "test-secret")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("device tool timeouts", () => {
  it("repassa o timeout do device-shell até o transporte", async () => {
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_SHELL_TOOL_NAME]

    await tool.execute!(
      deviceShellInputSchema.parse({
        deviceId: "device-1",
        script: "npm run build",
        timeoutMs: 45_000,
      }),
      toolContext,
    )

    expect(calls[0]?.command).toBe("shell")
    expect(calls[0]?.timeoutMs).toBe(45_000)
  })

  it("usa o default de 30s do shell quando a IA não informa timeout", async () => {
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_SHELL_TOOL_NAME]

    await tool.execute!(
      deviceShellInputSchema.parse({
        deviceId: "device-1",
        script: "npm test",
      }),
      toolContext,
    )

    expect(calls[0]?.timeoutMs).toBe(30_000)
  })

  it("repassa o timeout do device-run-command", async () => {
    const calls = stubCommands()
    const tool = createDeviceTools("user-1")[DEVICE_RUN_COMMAND_TOOL_NAME]

    await tool.execute!(
      {
        deviceId: "device-1",
        command: "git",
        args: ["status"],
        timeoutMs: 20_000,
      },
      toolContext,
    )

    expect(calls[0]?.command).toBe("run-command")
    expect(calls[0]?.timeoutMs).toBe(20_000)
  })
})
