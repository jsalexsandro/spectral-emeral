import { describe, expect, it } from "vitest"
import {
  classifyDeviceToolRisk,
  evaluateDeviceToolCall,
  parseDeviceExecutionPolicy,
  type ChatExecutionMode,
  type DeviceExecutionLevel,
  type DeviceToolRisk,
} from "./execution-policy"

function decide(
  level: DeviceExecutionLevel,
  mode: ChatExecutionMode,
  risk: DeviceToolRisk,
) {
  return evaluateDeviceToolCall({
    policy: { level },
    mode,
    risk,
  }).action
}

describe("execution policy", () => {
  it("always allows read tools, regardless of level or mode", () => {
    for (const level of ["read-only", "trusted", "full"] as const) {
      for (const mode of ["ask", "auto", "full"] as const) {
        expect(decide(level, mode, "read")).toBe("allow")
      }
    }
  })

  it("denies everything except read on read-only devices", () => {
    for (const risk of [
      "input",
      "write",
      "exec",
      "destructive",
      "system",
    ] as const) {
      for (const mode of ["ask", "auto", "full"] as const) {
        expect(decide("read-only", mode, risk)).toBe("deny")
      }
    }
  })

  it("asks for approval on trusted devices in ask mode", () => {
    expect(decide("trusted", "ask", "input")).toBe("approval")
    expect(decide("trusted", "ask", "write")).toBe("approval")
    expect(decide("trusted", "ask", "exec")).toBe("approval")
    expect(decide("trusted", "ask", "destructive")).toBe("approval")
    expect(decide("trusted", "ask", "system")).toBe("approval")
  })

  it("runs input, write and exec automatically on trusted devices", () => {
    expect(decide("trusted", "auto", "input")).toBe("allow")
    expect(decide("trusted", "auto", "write")).toBe("allow")
    expect(decide("trusted", "auto", "exec")).toBe("allow")
    expect(decide("trusted", "auto", "destructive")).toBe("approval")
    expect(decide("trusted", "auto", "system")).toBe("approval")
    expect(decide("trusted", "full", "destructive")).toBe("approval")
  })

  it("keeps destructive and system actions gated on full devices in ask mode", () => {
    expect(decide("full", "ask", "destructive")).toBe("approval")
    expect(decide("full", "ask", "system")).toBe("approval")
  })

  it("allows destructive but not system actions on full devices in auto mode", () => {
    expect(decide("full", "auto", "destructive")).toBe("allow")
    expect(decide("full", "auto", "system")).toBe("approval")
  })

  it("only releases system actions on full level and full mode", () => {
    expect(decide("full", "full", "destructive")).toBe("allow")
    expect(decide("full", "full", "system")).toBe("allow")
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
  it("falls back to read-only for missing or invalid values", () => {
    expect(parseDeviceExecutionPolicy(null).level).toBe("read-only")
    expect(parseDeviceExecutionPolicy("nonsense").level).toBe("read-only")
    expect(parseDeviceExecutionPolicy({ level: "nope" }).level).toBe("read-only")
    expect(parseDeviceExecutionPolicy([]).level).toBe("read-only")
  })

  it("accepts legacy strings and object shapes", () => {
    expect(parseDeviceExecutionPolicy("trusted").level).toBe("trusted")
    expect(parseDeviceExecutionPolicy({ level: "full" })).toEqual({
      level: "full",
    })
    expect(
      parseDeviceExecutionPolicy({
        level: "trusted",
        updatedAt: "2026-11-11T00:00:00.000Z",
      }),
    ).toEqual({ level: "trusted", updatedAt: "2026-11-11T00:00:00.000Z" })
  })
})
