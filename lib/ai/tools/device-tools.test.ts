import { describe, expect, it } from "vitest"
import {
  DEVICE_GET_OS_TOOL_NAME,
  DEVICE_LIST_APPS_TOOL_NAME,
  DEVICE_LIST_FILES_TOOL_NAME,
  DEVICE_LIST_TOOL_NAME,
  DEVICE_ONLINE_LIST_TOOL_NAME,
  DEVICE_OPEN_APP_TOOL_NAME,
  DEVICE_OPEN_URL_TOOL_NAME,
  DEVICE_PRESS_KEY_TOOL_NAME,
  DEVICE_READ_FILE_TOOL_NAME,
  DEVICE_TYPE_TEXT_TOOL_NAME,
  DEVICE_GLOB_TOOL_NAME,
  DEVICE_GREP_TOOL_NAME,
  DEVICE_CHECK_ADMIN_TOOL_NAME,
  DEVICE_WRITE_FILE_TOOL_NAME,
  DEVICE_EDIT_FILE_TOOL_NAME,
  DEVICE_RUN_COMMAND_TOOL_NAME,
  DEVICE_LIST_WINDOWS_TOOL_NAME,
  DEVICE_FOCUS_WINDOW_TOOL_NAME,
  createDeviceTools,
  deviceGetOsInputSchema,
  deviceOpenAppInputSchema,
  deviceOpenUrlInputSchema,
  devicePressKeyInputSchema,
  deviceListFilesInputSchema,
  deviceReadFileInputSchema,
  deviceGlobInputSchema,
  deviceGrepInputSchema,
  deviceCheckAdminInputSchema,
  deviceListWindowsInputSchema,
  deviceFocusWindowInputSchema,
  selectOnlineDevices,
  toDeviceToolSummary,
} from "./device-tools"

const now = Date.parse("2026-11-03T12:00:00.000Z")

function device(lastSeenAt: Date | null, id = "device-1") {
  return {
    id,
    name: "casa-pc",
    hostname: "casa-pc",
    platform: "win32",
    architecture: "x64",
    lastSeenAt,
  }
}

describe("device tools", () => {
  it("marks a device online when the last heartbeat is inside the window", () => {
    const summary = toDeviceToolSummary(
      device(new Date(now - 15_000)),
      now,
    )

    expect(summary.status).toBe("online")
    expect(summary.lastSeenAt).toBe(new Date(now - 15_000).toISOString())
  })

  it("marks a device offline when the last heartbeat is stale", () => {
    const summary = toDeviceToolSummary(
      device(new Date(now - 45_001)),
      now,
    )

    expect(summary.status).toBe("offline")
  })

  it("marks a device that never connected as offline", () => {
    const summary = toDeviceToolSummary(device(null), now)

    expect(summary.status).toBe("offline")
    expect(summary.lastSeenAt).toBeNull()
  })

  it("keeps only online devices", () => {
    const list = [
      toDeviceToolSummary(device(new Date(now - 1_000), "online"), now),
      toDeviceToolSummary(device(new Date(now - 60_000), "offline"), now),
      toDeviceToolSummary(device(null, "never"), now),
    ]

    expect(selectOnlineDevices(list).map((item) => item.id)).toEqual(["online"])
  })

  it("exposes listing and control tools", () => {
    const tools = createDeviceTools("user-1")

    expect(Object.keys(tools).sort()).toEqual(
      [
        DEVICE_LIST_TOOL_NAME,
        DEVICE_ONLINE_LIST_TOOL_NAME,
        DEVICE_OPEN_URL_TOOL_NAME,
        DEVICE_OPEN_APP_TOOL_NAME,
        DEVICE_LIST_APPS_TOOL_NAME,
        DEVICE_GET_OS_TOOL_NAME,
        DEVICE_TYPE_TEXT_TOOL_NAME,
        DEVICE_PRESS_KEY_TOOL_NAME,
        DEVICE_LIST_FILES_TOOL_NAME,
        DEVICE_READ_FILE_TOOL_NAME,
        DEVICE_GLOB_TOOL_NAME,
        DEVICE_GREP_TOOL_NAME,
        DEVICE_CHECK_ADMIN_TOOL_NAME,
        DEVICE_WRITE_FILE_TOOL_NAME,
        DEVICE_EDIT_FILE_TOOL_NAME,
        DEVICE_RUN_COMMAND_TOOL_NAME,
        DEVICE_LIST_WINDOWS_TOOL_NAME,
        DEVICE_FOCUS_WINDOW_TOOL_NAME,
      ].sort(),
    )

    for (const chatTool of Object.values(tools)) {
      expect(typeof chatTool.execute).toBe("function")
    }
  })

  it("rejects unsafe URLs and app ids", () => {
    expect(
      deviceOpenUrlInputSchema.safeParse({
        deviceId: "device-1",
        url: "https://example.com",
      }).success,
    ).toBe(true)

    expect(
      deviceOpenUrlInputSchema.safeParse({
        deviceId: "device-1",
        url: "file:///etc/passwd",
      }).success,
    ).toBe(false)

    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "chrome",
      }).success,
    ).toBe(true)

    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "Chrome; rm -rf /",
      }).success,
    ).toBe(false)
  })

  it("rejects blocked key combinations", () => {
    expect(
      devicePressKeyInputSchema.safeParse({
        deviceId: "device-1",
        key: "f4",
        modifiers: ["alt"],
      }).success,
    ).toBe(false)

    expect(
      devicePressKeyInputSchema.safeParse({
        deviceId: "device-1",
        key: "delete",
        modifiers: ["ctrl", "alt"],
      }).success,
    ).toBe(false)

    expect(
      devicePressKeyInputSchema.safeParse({
        deviceId: "device-1",
        key: "c",
        modifiers: ["ctrl"],
      }).success,
    ).toBe(true)
  })

  it("requires a device id to read the OS", () => {
    expect(
      deviceGetOsInputSchema.safeParse({ deviceId: "device-1" }).success,
    ).toBe(true)
    expect(deviceGetOsInputSchema.safeParse({}).success).toBe(false)
  })

  it("valida device-list-files com defaults", () => {
    expect(
      deviceListFilesInputSchema.safeParse({
        deviceId: "device-1",
      }).success,
    ).toBe(true)

    expect(
      deviceListFilesInputSchema.safeParse({
        deviceId: "device-1",
        path: "a".repeat(1025),
      }).success,
    ).toBe(false)
  })

  it("valida device-read-file", () => {
    expect(
      deviceReadFileInputSchema.safeParse({
        deviceId: "device-1",
        path: "notas.txt",
      }).success,
    ).toBe(true)

    expect(
      deviceReadFileInputSchema.safeParse({
        deviceId: "device-1",
        path: "notas.txt",
        limit: 2001,
      }).success,
    ).toBe(false)
  })

  it("valida device-glob e device-grep", () => {
    expect(
      deviceGlobInputSchema.safeParse({
        deviceId: "device-1",
        pattern: "*.md",
      }).success,
    ).toBe(true)

    expect(
      deviceGlobInputSchema.safeParse({
        deviceId: "device-1",
        pattern: "a".repeat(257),
      }).success,
    ).toBe(false)

    expect(
      deviceGrepInputSchema.safeParse({
        deviceId: "device-1",
        pattern: "TODO",
      }).success,
    ).toBe(true)

    expect(
      deviceGrepInputSchema.safeParse({
        deviceId: "device-1",
        pattern: "TODO",
        maxResults: 201,
      }).success,
    ).toBe(false)
  })

  it("valida device-check-admin", () => {
    expect(
      deviceCheckAdminInputSchema.safeParse({
        deviceId: "device-1",
      }).success,
    ).toBe(true)

    expect(deviceCheckAdminInputSchema.safeParse({}).success).toBe(false)
  })

  it("valida device-list-windows e device-focus-window", () => {
    expect(
      deviceListWindowsInputSchema.safeParse({
        deviceId: "device-1",
      }).success,
    ).toBe(true)

    expect(
      deviceListWindowsInputSchema.safeParse({
        deviceId: "device-1",
        includeMinimized: true,
        limit: 30,
      }).success,
    ).toBe(true)

    expect(
      deviceListWindowsInputSchema.safeParse({
        deviceId: "device-1",
        limit: 31,
      }).success,
    ).toBe(false)

    expect(
      deviceFocusWindowInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "0x3a00007",
      }).success,
    ).toBe(true)

    expect(
      deviceFocusWindowInputSchema.safeParse({
        deviceId: "device-1",
      }).success,
    ).toBe(false)
  })

  it("aceita windowId em type-text e press-key", () => {
    expect(
      devicePressKeyInputSchema.safeParse({
        deviceId: "device-1",
        key: "c",
        modifiers: ["ctrl"],
        windowId: "123:0",
      }).success,
    ).toBe(true)

    expect(
      devicePressKeyInputSchema.safeParse({
        deviceId: "device-1",
        key: "c",
        windowId: "a b",
      }).success,
    ).toBe(false)
  })
})
