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

  it("normalizes list-windows with defaults and limits", () => {
    expect(parseDeviceCommand("list-windows", {})).toEqual({
      command: "list-windows",
      input: { includeMinimized: false, limit: 20 },
    })

    expect(
      parseDeviceCommand("list-windows", {
        includeMinimized: true,
        limit: 5,
      }),
    ).toEqual({
      command: "list-windows",
      input: { includeMinimized: true, limit: 5 },
    })

    expect(() =>
      parseDeviceCommand("list-windows", { limit: 31 }),
    ).toThrow(DeviceCommandValidationError)
  })

  it("requires a valid window id for focus-window", () => {
    expect(
      parseDeviceCommand("focus-window", { windowId: " 123456 " }),
    ).toEqual({
      command: "focus-window",
      input: { windowId: "123456" },
    })

    expect(() => parseDeviceCommand("focus-window", {})).toThrow(
      DeviceCommandValidationError,
    )
    expect(() =>
      parseDeviceCommand("focus-window", { windowId: "abc; rm -rf /" }),
    ).toThrow(DeviceCommandValidationError)
  })

  it("normalizes window action commands", () => {
    const commands = [
      "minimize-window",
      "maximize-window",
      "restore-window",
      "close-window",
    ] as const

    for (const command of commands) {
      expect(
        parseDeviceCommand(command, { windowId: " 123:0 " }),
      ).toEqual({
        command,
        input: { windowId: "123:0" },
      })

      expect(() => parseDeviceCommand(command, {})).toThrow(
        DeviceCommandValidationError,
      )
      expect(() =>
        parseDeviceCommand(command, { windowId: "abc; rm -rf /" }),
      ).toThrow(DeviceCommandValidationError)
    }
  })

  it("normalizes screenshot with defaults", () => {
    expect(parseDeviceCommand("screenshot", {})).toEqual({
      command: "screenshot",
      input: { maxWidth: 1280, quality: 70, format: "jpeg" },
    })

    expect(
      parseDeviceCommand("screenshot", {
        monitor: 1,
        maxWidth: 1920,
        quality: 85,
        format: "PNG",
      }),
    ).toEqual({
      command: "screenshot",
      input: {
        monitor: 1,
        maxWidth: 1920,
        quality: 85,
        format: "png",
      },
    })

    expect(
      parseDeviceCommand("screenshot", {
        region: { x: 10.9, y: -5.2, width: 800.7, height: 600.1 },
      }),
    ).toEqual({
      command: "screenshot",
      input: {
        region: { x: 10, y: -5, width: 800, height: 600 },
        maxWidth: 1280,
        quality: 70,
        format: "jpeg",
      },
    })

    expect(
      parseDeviceCommand("screenshot", {
        windowId: "123:0",
        maxWidth: 1600,
      }),
    ).toEqual({
      command: "screenshot",
      input: {
        windowId: "123:0",
        maxWidth: 1600,
        quality: 70,
        format: "jpeg",
      },
    })
  })

  it("rejects invalid screenshot inputs", () => {
    expect(() =>
      parseDeviceCommand("screenshot", { maxWidth: 100 }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("screenshot", { quality: 100 }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("screenshot", { monitor: -1 }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("screenshot", { format: "webp" }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("screenshot", {
        region: { x: 0, y: 0, width: 0, height: 100 },
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("screenshot", {
        region: { x: 0, y: 0, width: 100 },
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("screenshot", {
        windowId: "123:0",
        region: { x: 0, y: 0, width: 100, height: 100 },
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("screenshot", {
        windowId: "123:0",
        monitor: 0,
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("screenshot", {
        monitor: 0,
        region: { x: 0, y: 0, width: 100, height: 100 },
      }),
    ).toThrow(DeviceCommandValidationError)
  })

  it("accepts an optional window id on type-text and press-key", () => {
    expect(
      parseDeviceCommand("type-text", { text: "olá", windowId: "123:0" }),
    ).toEqual({
      command: "type-text",
      input: { text: "olá", windowId: "123:0" },
    })

    expect(
      parseDeviceCommand("press-key", {
        key: "c",
        modifiers: ["ctrl"],
        windowId: "0x3a00007",
      }),
    ).toEqual({
      command: "press-key",
      input: {
        key: "c",
        modifiers: ["ctrl"],
        windowId: "0x3a00007",
      },
    })

    expect(() =>
      parseDeviceCommand("type-text", { text: "olá", windowId: "a b" }),
    ).toThrow(DeviceCommandValidationError)
  })

  it("normalizes clipboard commands", () => {
    expect(parseDeviceCommand("read-clipboard", {})).toEqual({
      command: "read-clipboard",
      input: {},
    })

    expect(
      parseDeviceCommand("write-clipboard", {
        text: "linha 1\nlinha 2\tcom tab",
      }),
    ).toEqual({
      command: "write-clipboard",
      input: { text: "linha 1\nlinha 2\tcom tab" },
    })
  })

  it("rejects invalid clipboard text", () => {
    expect(() => parseDeviceCommand("write-clipboard", {})).toThrow(
      DeviceCommandValidationError,
    )
    expect(() =>
      parseDeviceCommand("write-clipboard", { text: "" }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("write-clipboard", {
        text: "a".repeat(100_001),
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("write-clipboard", { text: "senha\u0000oculta" }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("write-clipboard", { text: "a\u0007b" }),
    ).toThrow(DeviceCommandValidationError)
  })

  it("normalizes mouse commands", () => {
    expect(parseDeviceCommand("move-mouse", { x: 120, y: -40 })).toEqual({
      command: "move-mouse",
      input: { x: 120, y: -40 },
    })

    expect(parseDeviceCommand("click", {})).toEqual({
      command: "click",
      input: { button: "left", count: 1 },
    })

    expect(
      parseDeviceCommand("click", {
        x: 10,
        y: 20,
        button: "right",
        count: 2,
      }),
    ).toEqual({
      command: "click",
      input: { x: 10, y: 20, button: "right", count: 2 },
    })

    expect(
      parseDeviceCommand("scroll", { direction: "down", amount: 5 }),
    ).toEqual({
      command: "scroll",
      input: { direction: "down", amount: 5 },
    })

    expect(
      parseDeviceCommand("drag", {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 50 },
        durationMs: 900,
      }),
    ).toEqual({
      command: "drag",
      input: {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 50 },
        button: "left",
        durationMs: 900,
      },
    })
  })

  it("normalizes inspect-ui with defaults and filters", () => {
    expect(
      parseDeviceCommand("inspect-ui", { windowId: " 66500 " }),
    ).toEqual({
      command: "inspect-ui",
      input: {
        windowId: "66500",
        maxResults: 40,
        depth: 10,
        includeOffscreen: false,
        waitMs: 0,
      },
    })

    expect(
      parseDeviceCommand("inspect-ui", {
        windowId: "66500",
        find: "  Fechar ",
        role: " ControlType.Button ",
        maxResults: 5,
        depth: 8,
        includeOffscreen: true,
        waitMs: 2000,
      }),
    ).toEqual({
      command: "inspect-ui",
      input: {
        windowId: "66500",
        find: "Fechar",
        role: "Button",
        maxResults: 5,
        depth: 8,
        includeOffscreen: true,
        waitMs: 2000,
      },
    })

    expect(() => parseDeviceCommand("inspect-ui", {})).toThrow(
      DeviceCommandValidationError,
    )
    expect(() =>
      parseDeviceCommand("inspect-ui", {
        windowId: "66500",
        role: "ControlType.But;ton",
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("inspect-ui", { windowId: "66500", depth: 13 }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("inspect-ui", { windowId: "66500", waitMs: 10_001 }),
    ).toThrow(DeviceCommandValidationError)
  })

  it("normalizes ui-action", () => {
    expect(
      parseDeviceCommand("ui-action", {
        windowId: "66500",
        runtimeId: " 42.123.456 ",
      }),
    ).toEqual({
      command: "ui-action",
      input: {
        windowId: "66500",
        runtimeId: "42.123.456",
        action: "invoke",
        waitMs: 1500,
      },
    })

    expect(
      parseDeviceCommand("ui-action", {
        windowId: "66500",
        runtimeId: "42.123.456",
        action: "select",
        waitMs: 0,
      }),
    ).toEqual({
      command: "ui-action",
      input: {
        windowId: "66500",
        runtimeId: "42.123.456",
        action: "select",
        waitMs: 0,
      },
    })

    expect(
      parseDeviceCommand("ui-action", {
        windowId: "66500",
        runtimeId: "42.123.456",
        action: "setValue",
        value: "clima em João Pessoa",
      }),
    ).toEqual({
      command: "ui-action",
      input: {
        windowId: "66500",
        runtimeId: "42.123.456",
        action: "setValue",
        waitMs: 1500,
        value: "clima em João Pessoa",
      },
    })

    expect(
      parseDeviceCommand("ui-action", {
        windowId: "66500",
        runtimeId: "42.123.456",
        action: "setValue",
        value: "",
      }),
    ).toEqual({
      command: "ui-action",
      input: {
        windowId: "66500",
        runtimeId: "42.123.456",
        action: "setValue",
        waitMs: 1500,
        value: "",
      },
    })

    expect(() =>
      parseDeviceCommand("ui-action", {
        windowId: "66500",
        runtimeId: "42; rm -rf /",
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("ui-action", {
        windowId: "66500",
        runtimeId: "42.123",
        action: "explode",
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("ui-action", {
        windowId: "66500",
        runtimeId: "42.123",
        action: "setValue",
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("ui-action", {
        windowId: "66500",
        runtimeId: "42.123",
        action: "invoke",
        value: "texto",
      }),
    ).toThrow(DeviceCommandValidationError)
  })

  it("rejects invalid mouse input", () => {
    expect(() => parseDeviceCommand("move-mouse", { x: 1 })).toThrow(
      DeviceCommandValidationError,
    )
    expect(() =>
      parseDeviceCommand("drag", {
        from: { x: 0, y: 0 },
        to: { x: 100_001, y: 50 },
      }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("scroll", { direction: "diagonal" }),
    ).toThrow(DeviceCommandValidationError)
    expect(() =>
      parseDeviceCommand("click", { x: 1, count: 4 }),
    ).toThrow(DeviceCommandValidationError)

    try {
      parseDeviceCommand("move-mouse", { x: 100_001, y: 0 })
      throw new Error("esperava erro de validação")
    } catch (error) {
      expect(error).toBeInstanceOf(DeviceCommandValidationError)
      expect((error as DeviceCommandValidationError).code).toBe(
        "invalid_coordinates",
      )
    }
  })
})
