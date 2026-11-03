import { describe, expect, it } from "vitest"
import {
  DeviceCommandValidationError,
  isAllowedDeviceUrl,
  isBlockedKeyCombination,
  parseDeviceCommand,
} from "./commands"

describe("device command contract", () => {
  it("accepts http and https URLs without credentials", () => {
    expect(isAllowedDeviceUrl("https://example.com/path?q=1")).toBe(true)
    expect(isAllowedDeviceUrl("http://localhost:3000")).toBe(true)
  })

  it("rejects unsupported protocols, credentials and oversized URLs", () => {
    expect(isAllowedDeviceUrl("file:///etc/passwd")).toBe(false)
    expect(isAllowedDeviceUrl("javascript:alert(1)")).toBe(false)
    expect(isAllowedDeviceUrl("https://user:pass@example.com")).toBe(false)
    expect(isAllowedDeviceUrl("https://example.com/" + "a".repeat(2048))).toBe(
      false,
    )
  })

  it("blocks dangerous key combinations", () => {
    expect(isBlockedKeyCombination("f4", ["alt"])).toBe(true)
    expect(isBlockedKeyCombination("f4", ["ctrl", "alt"])).toBe(true)
    expect(isBlockedKeyCombination("delete", ["ctrl", "alt"])).toBe(true)
    expect(isBlockedKeyCombination("delete", ["ctrl"])).toBe(false)
    expect(isBlockedKeyCombination("f4", ["ctrl"])).toBe(false)
  })

  it("normalizes open-url and open-app commands", () => {
    expect(
      parseDeviceCommand("open-url", { url: " https://example.com " }),
    ).toEqual({
      command: "open-url",
      input: { url: "https://example.com" },
    })

    expect(parseDeviceCommand("open-app", { appId: " Chrome " })).toEqual({
      command: "open-app",
      input: { appId: "chrome" },
    })
  })

  it("deduplicates modifiers in canonical order", () => {
    expect(
      parseDeviceCommand("press-key", {
        key: "C",
        modifiers: ["shift", "ctrl", "shift"],
      }),
    ).toEqual({
      command: "press-key",
      input: { key: "c", modifiers: ["ctrl", "shift"] },
    })
  })

  it("rejects unknown commands, keys and modifiers", () => {
    expect(() => parseDeviceCommand("run-shell", {})).toThrow(
      DeviceCommandValidationError,
    )
    expect(() => parseDeviceCommand("press-key", { key: "f13" })).toThrow(
      DeviceCommandValidationError,
    )
    expect(() =>
      parseDeviceCommand("press-key", { key: "c", modifiers: ["hyper"] }),
    ).toThrow(DeviceCommandValidationError)
  })

  it("rejects blocked combinations and invalid text", () => {
    expect(() =>
      parseDeviceCommand("press-key", { key: "f4", modifiers: ["alt"] }),
    ).toThrow(DeviceCommandValidationError)

    expect(() => parseDeviceCommand("type-text", { text: "" })).toThrow(
      DeviceCommandValidationError,
    )
    expect(() =>
      parseDeviceCommand("type-text", { text: "abc\u0007def" }),
    ).toThrow(DeviceCommandValidationError)
    expect(parseDeviceCommand("type-text", { text: "linha 1\nlinha 2" })).toEqual(
      {
        command: "type-text",
        input: { text: "linha 1\nlinha 2" },
      },
    )
  })

  it("returns an empty input for list-apps and get-os", () => {
    expect(parseDeviceCommand("list-apps", undefined)).toEqual({
      command: "list-apps",
      input: {},
    })

    expect(parseDeviceCommand("get-os", undefined)).toEqual({
      command: "get-os",
      input: {},
    })
  })

  it("normalizes list-files with defaults", () => {
    expect(parseDeviceCommand("list-files", {})).toEqual({
      command: "list-files",
      input: { depth: 1, showHidden: false, maxEntries: 200 },
    })

    expect(
      parseDeviceCommand("list-files", {
        path: "Documentos",
        depth: 3,
        showHidden: true,
        maxEntries: 50,
      }),
    ).toEqual({
      command: "list-files",
      input: { path: "Documentos", depth: 3, showHidden: true, maxEntries: 50 },
    })
  })

  it("requires path for read-file", () => {
    expect(() => parseDeviceCommand("read-file", {})).toThrow(
      DeviceCommandValidationError,
    )

    expect(
      parseDeviceCommand("read-file", { path: "~/notas.txt", offset: 5, limit: 10 }),
    ).toEqual({
      command: "read-file",
      input: { path: "~/notas.txt", offset: 5, limit: 10 },
    })
  })

  it("requires pattern for glob and grep", () => {
    expect(() => parseDeviceCommand("glob", {})).toThrow(
      DeviceCommandValidationError,
    )
    expect(() => parseDeviceCommand("grep", {})).toThrow(
      DeviceCommandValidationError,
    )

    expect(parseDeviceCommand("glob", { pattern: "*.md" })).toEqual({
      command: "glob",
      input: { pattern: "*.md", showHidden: false, maxResults: 100 },
    })

    expect(parseDeviceCommand("grep", { pattern: "TODO" })).toEqual({
      command: "grep",
      input: { pattern: "TODO", caseSensitive: false, maxResults: 100 },
    })
  })

  it("rejects invalid file inputs", () => {
    expect(() =>
      parseDeviceCommand("list-files", {
        path: "a".repeat(1025),
      }),
    ).toThrow(DeviceCommandValidationError)

    expect(() =>
      parseDeviceCommand("read-file", { path: "a\u0000b" }),
    ).toThrow(DeviceCommandValidationError)

    expect(() =>
      parseDeviceCommand("glob", { pattern: "a".repeat(257) }),
    ).toThrow(DeviceCommandValidationError)

    expect(() =>
      parseDeviceCommand("read-file", { path: "x.txt", offset: 0 }),
    ).toThrow(DeviceCommandValidationError)

    expect(() =>
      parseDeviceCommand("read-file", { path: "x.txt", limit: 2001 }),
    ).toThrow(DeviceCommandValidationError)
  })

  it("normalizes check-admin", () => {
    expect(parseDeviceCommand("check-admin", {})).toEqual({
      command: "check-admin",
      input: {},
    })
  })
})
