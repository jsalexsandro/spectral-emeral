import { describe, expect, it } from "vitest"
import {
  classifyDeviceToolRisk,
  evaluateDeviceToolCall,
  parseDeviceExecutionPolicy,
  type ChatExecutionMode,
  type DeviceToolRisk,
} from "./execution-policy"

function decide(
  confirmDestructive: boolean,
  mode: ChatExecutionMode,
  risk: DeviceToolRisk,
) {
  return evaluateDeviceToolCall({
    policy: { confirmDestructive },
    mode,
    risk,
  }).action
}

const MUTATIONS = ["input", "write", "exec"] as const
const IRREVERSIBLE = ["destructive", "system"] as const

describe("execution policy", () => {
  it("always allows read tools, regardless of mode or device setting", () => {
    for (const confirmDestructive of [true, false]) {
      for (const mode of ["plan", "build"] as const) {
        expect(decide(confirmDestructive, mode, "read")).toBe("allow")
      }
    }
  })

  it("denies every mutation in plan mode", () => {
    for (const confirmDestructive of [true, false]) {
      for (const risk of [...MUTATIONS, ...IRREVERSIBLE]) {
        expect(decide(confirmDestructive, "plan", risk)).toBe("deny")
      }
    }
  })

  it("runs mutations directly in build mode", () => {
    for (const confirmDestructive of [true, false]) {
      for (const risk of MUTATIONS) {
        expect(decide(confirmDestructive, "build", risk)).toBe("allow")
      }
    }
  })

  it("asks approval for destructive and system actions when confirming", () => {
    for (const risk of IRREVERSIBLE) {
      expect(decide(true, "build", risk)).toBe("approval")
    }
  })

  it("releases destructive and system actions under full power", () => {
    for (const risk of IRREVERSIBLE) {
      expect(decide(false, "build", risk)).toBe("allow")
    }
  })
})

describe("device tool risk classification", () => {
  it("returns null for tools that are not device tools", () => {
    expect(classifyDeviceToolRisk("render-html", {})).toBeNull()
  })

  it("classifies known tools", () => {
    expect(classifyDeviceToolRisk("device-list", {})).toBe("read")
    expect(classifyDeviceToolRisk("device-click", {})).toBe("input")
    expect(classifyDeviceToolRisk("device-write-file", {})).toBe("write")
    expect(
      classifyDeviceToolRisk("device-window-action", { action: "close" }),
    ).toBe("destructive")
    expect(
      classifyDeviceToolRisk("device-window-action", { action: "minimize" }),
    ).toBe("input")
    expect(classifyDeviceToolRisk("device-minimize-window", {})).toBe("input")
    expect(classifyDeviceToolRisk("device-close-window", {})).toBe(
      "destructive",
    )
  })

  it("promotes dangerous shell scripts", () => {
    expect(classifyDeviceToolRisk("device-shell", { script: "npm test" })).toBe(
      "exec",
    )
    expect(
      classifyDeviceToolRisk("device-shell", { script: "shutdown /s /t 0" }),
    ).toBe("system")
    expect(
      classifyDeviceToolRisk("device-shell", {
        script: "Remove-Item -Recurse -Force C:\\temp",
      }),
    ).toBe("destructive")
  })

  it("promotes dangerous run-command invocations", () => {
    expect(
      classifyDeviceToolRisk("device-run-command", { command: "taskkill" }),
    ).toBe("destructive")
    expect(
      classifyDeviceToolRisk("device-run-command", { command: "whoami" }),
    ).toBe("exec")
  })
})

describe("parseDeviceExecutionPolicy", () => {
  it("defaults to confirming destructive actions", () => {
    expect(parseDeviceExecutionPolicy(null).confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy(undefined).confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy("nonsense").confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy([]).confirmDestructive).toBe(true)
  })

  it("accepts the current boolean shape", () => {
    expect(parseDeviceExecutionPolicy({ confirmDestructive: false })).toEqual({
      confirmDestructive: false,
    })
    expect(
      parseDeviceExecutionPolicy({
        confirmDestructive: true,
        updatedAt: "2026-11-11T00:00:00.000Z",
      }),
    ).toEqual({
      confirmDestructive: true,
      updatedAt: "2026-11-11T00:00:00.000Z",
    })
  })

  it("maps the legacy level format without loosening anything", () => {
    expect(parseDeviceExecutionPolicy("full").confirmDestructive).toBe(false)
    expect(parseDeviceExecutionPolicy({ level: "full" })).toEqual({
      confirmDestructive: false,
    })
    expect(parseDeviceExecutionPolicy("trusted").confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy("read-only").confirmDestructive).toBe(true)
    expect(parseDeviceExecutionPolicy({ level: "nope" }).confirmDestructive).toBe(
      true,
    )
  })
})
