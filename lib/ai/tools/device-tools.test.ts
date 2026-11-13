import { describe, expect, it } from "vitest"
import {
  DEVICE_GET_OS_TOOL_NAME,
  DEVICE_LIST_APPS_TOOL_NAME,
  DEVICE_FIND_APP_TOOL_NAME,
  DEVICE_LIST_FILES_TOOL_NAME,
  DEVICE_LIST_TOOL_NAME,
  DEVICE_ONLINE_LIST_TOOL_NAME,
  DEVICE_OPEN_APP_TOOL_NAME,
  DEVICE_OPEN_PATH_TOOL_NAME,
  DEVICE_OPEN_URL_TOOL_NAME,
  DEVICE_PRESS_KEY_TOOL_NAME,
  DEVICE_READ_FILE_TOOL_NAME,
  DEVICE_REGISTER_APP_TOOL_NAME,
  DEVICE_REMOVE_APP_TOOL_NAME,
  DEVICE_TYPE_TEXT_TOOL_NAME,
  DEVICE_GLOB_TOOL_NAME,
  DEVICE_GREP_TOOL_NAME,
  DEVICE_CHECK_ADMIN_TOOL_NAME,
  DEVICE_WRITE_FILE_TOOL_NAME,
  DEVICE_EDIT_FILE_TOOL_NAME,
  DEVICE_MKDIR_TOOL_NAME,
  DEVICE_STAT_TOOL_NAME,
  DEVICE_COPY_TOOL_NAME,
  DEVICE_MOVE_TOOL_NAME,
  DEVICE_DELETE_TOOL_NAME,
  DEVICE_APPLY_PATCH_TOOL_NAME,
  DEVICE_RUN_COMMAND_TOOL_NAME,
  DEVICE_ENV_TOOL_NAME,
  DEVICE_SHELL_TOOL_NAME,
  DEVICE_JOB_START_TOOL_NAME,
  DEVICE_JOB_STATUS_TOOL_NAME,
  DEVICE_JOB_OUTPUT_TOOL_NAME,
  DEVICE_JOB_CANCEL_TOOL_NAME,
  DEVICE_JOB_LIST_TOOL_NAME,
  DEVICE_LIST_WINDOWS_TOOL_NAME,
  DEVICE_FOCUS_WINDOW_TOOL_NAME,
  DEVICE_WINDOW_ACTION_TOOL_NAME,
  DEVICE_INSPECT_UI_TOOL_NAME,
  DEVICE_UI_ACTION_TOOL_NAME,
  DEVICE_SCREENSHOT_TOOL_NAME,
  DEVICE_READ_CLIPBOARD_TOOL_NAME,
  DEVICE_WRITE_CLIPBOARD_TOOL_NAME,
  DEVICE_MOVE_MOUSE_TOOL_NAME,
  DEVICE_CLICK_TOOL_NAME,
  DEVICE_SCROLL_TOOL_NAME,
  DEVICE_DRAG_TOOL_NAME,
  createDeviceTools,
  deviceGetOsInputSchema,
  deviceOpenAppInputSchema,
  deviceOpenPathInputSchema,
  deviceReadClipboardInputSchema,
  deviceRegisterAppInputSchema,
  deviceRemoveAppInputSchema,
  deviceWriteClipboardInputSchema,
  deviceMoveMouseInputSchema,
  deviceClickInputSchema,
  deviceScrollInputSchema,
  deviceDragInputSchema,
  deviceScreenshotInputSchema,
  deviceListAppsInputSchema,
  deviceFindAppInputSchema,
  deviceOpenUrlInputSchema,
  devicePressKeyInputSchema,
  deviceListFilesInputSchema,
  deviceReadFileInputSchema,
  deviceGlobInputSchema,
  deviceGrepInputSchema,
  deviceCheckAdminInputSchema,
  deviceListWindowsInputSchema,
  deviceFocusWindowInputSchema,
  deviceWindowActionInputSchema,
  deviceInspectUiInputSchema,
  deviceUiActionInputSchema,
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
        DEVICE_OPEN_PATH_TOOL_NAME,
        DEVICE_REGISTER_APP_TOOL_NAME,
        DEVICE_REMOVE_APP_TOOL_NAME,
        DEVICE_LIST_APPS_TOOL_NAME,
        DEVICE_FIND_APP_TOOL_NAME,
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
        DEVICE_MKDIR_TOOL_NAME,
        DEVICE_STAT_TOOL_NAME,
        DEVICE_COPY_TOOL_NAME,
        DEVICE_MOVE_TOOL_NAME,
        DEVICE_DELETE_TOOL_NAME,
        DEVICE_APPLY_PATCH_TOOL_NAME,
        DEVICE_RUN_COMMAND_TOOL_NAME,
        DEVICE_ENV_TOOL_NAME,
        DEVICE_SHELL_TOOL_NAME,
        DEVICE_JOB_START_TOOL_NAME,
        DEVICE_JOB_STATUS_TOOL_NAME,
        DEVICE_JOB_OUTPUT_TOOL_NAME,
        DEVICE_JOB_CANCEL_TOOL_NAME,
        DEVICE_JOB_LIST_TOOL_NAME,
        DEVICE_LIST_WINDOWS_TOOL_NAME,
        DEVICE_FOCUS_WINDOW_TOOL_NAME,
        DEVICE_WINDOW_ACTION_TOOL_NAME,
        DEVICE_INSPECT_UI_TOOL_NAME,
        DEVICE_UI_ACTION_TOOL_NAME,
        DEVICE_SCREENSHOT_TOOL_NAME,
        DEVICE_READ_CLIPBOARD_TOOL_NAME,
        DEVICE_WRITE_CLIPBOARD_TOOL_NAME,
        DEVICE_MOVE_MOUSE_TOOL_NAME,
        DEVICE_CLICK_TOOL_NAME,
        DEVICE_SCROLL_TOOL_NAME,
        DEVICE_DRAG_TOOL_NAME,
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

    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "chrome",
        path: "C:\\Programas\\Chrome\\chrome.exe",
      }).success,
    ).toBe(false)

    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        path: "C:\\Programas\\Zed\\Zed.exe",
      }).success,
    ).toBe(true)

    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        path: "Zed.exe",
      }).success,
    ).toBe(false)
  })

  it("valida argumentos e diretório de trabalho em open-app", () => {
    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "zed-7eb333",
        args: ["."],
        cwd: "C:\\Users\\eujos\\projeto",
      }).success,
    ).toBe(true)

    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "zed-7eb333",
        args: [".", "arquivo.txt"],
      }).success,
    ).toBe(true)

    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "zed-7eb333",
        args: ["a".repeat(513)],
      }).success,
    ).toBe(false)

    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "zed-7eb333",
        args: ["sem\nquebra"],
      }).success,
    ).toBe(false)

    expect(
      deviceOpenAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "zed-7eb333",
        cwd: "pasta-relativa",
      }).success,
    ).toBe(false)
  })

  it("valida device-open-path", () => {
    expect(
      deviceOpenPathInputSchema.safeParse({
        deviceId: "device-1",
        path: "C:\\Users\\eujos\\relatorio.pdf",
      }).success,
    ).toBe(true)

    expect(
      deviceOpenPathInputSchema.safeParse({
        deviceId: "device-1",
        path: "C:\\Users\\eujos\\projeto",
      }).success,
    ).toBe(true)

    expect(
      deviceOpenPathInputSchema.safeParse({
        deviceId: "device-1",
        path: "C:\\Programas\\Zed\\Zed.exe",
      }).success,
    ).toBe(false)

    expect(
      deviceOpenPathInputSchema.safeParse({
        deviceId: "device-1",
        path: "C:\\Users\\eujos\\script.py",
      }).success,
    ).toBe(false)

    expect(
      deviceOpenPathInputSchema.safeParse({
        deviceId: "device-1",
        path: "C:\\Users\\eujos\\planilha.xlsm",
      }).success,
    ).toBe(false)

    expect(
      deviceOpenPathInputSchema.safeParse({
        deviceId: "device-1",
        path: "relatorio.pdf",
      }).success,
    ).toBe(false)
  })

  it("valida device-register-app e device-remove-app", () => {
    expect(
      deviceRegisterAppInputSchema.safeParse({
        deviceId: "device-1",
        name: "Zed",
        path: "C:\\Programas\\Zed\\Zed.exe",
        args: ["."],
        cwd: "C:\\Users\\eujos\\projeto",
      }).success,
    ).toBe(true)

    expect(
      deviceRegisterAppInputSchema.safeParse({
        deviceId: "device-1",
        name: "Zed",
        path: "Zed.exe",
      }).success,
    ).toBe(false)

    expect(
      deviceRemoveAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "zed-7eb333",
      }).success,
    ).toBe(true)

    expect(
      deviceRemoveAppInputSchema.safeParse({
        deviceId: "device-1",
        appId: "Zed App",
      }).success,
    ).toBe(false)
  })

  it("valida busca e listagem de apps", () => {
    expect(
      deviceFindAppInputSchema.safeParse({
        deviceId: "device-1",
        query: "Zed",
      }).success,
    ).toBe(true)

    expect(
      deviceFindAppInputSchema.safeParse({
        deviceId: "device-1",
        query: "",
      }).success,
    ).toBe(false)

    expect(
      deviceListAppsInputSchema.safeParse({
        deviceId: "device-1",
        query: "code",
        refresh: true,
        limit: 20,
      }).success,
    ).toBe(true)

    expect(
      deviceListAppsInputSchema.safeParse({
        deviceId: "device-1",
        limit: 0,
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

  it("valida device-window-action", () => {
    for (const action of ["minimize", "maximize", "restore", "close"] as const) {
      expect(
        deviceWindowActionInputSchema.safeParse({
          deviceId: "device-1",
          windowId: "123:0",
          action,
        }).success,
      ).toBe(true)
    }

    expect(
      deviceWindowActionInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "123:0",
        action: "explode",
      }).success,
    ).toBe(false)

    expect(
      deviceWindowActionInputSchema.safeParse({
        deviceId: "device-1",
        action: "close",
      }).success,
    ).toBe(false)
  })

  it("valida device-inspect-ui", () => {
    const parsed = deviceInspectUiInputSchema.safeParse({
      deviceId: "device-1",
      windowId: "66500",
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success ? parsed.data : null).toEqual({
      deviceId: "device-1",
      windowId: "66500",
      maxResults: 40,
      depth: 10,
      includeOffscreen: false,
      waitMs: 0,
    })

    expect(
      deviceInspectUiInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "66500",
        find: "Fechar",
        role: "Button",
        maxResults: 10,
        depth: 8,
        includeOffscreen: true,
        waitMs: 2000,
      }).success,
    ).toBe(true)

    expect(
      deviceInspectUiInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "66500",
        role: "ControlType.Button",
      }).success,
    ).toBe(false)

    expect(
      deviceInspectUiInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "66500",
        depth: 13,
      }).success,
    ).toBe(false)

    expect(
      deviceInspectUiInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "66500",
        waitMs: 10_001,
      }).success,
    ).toBe(false)
  })

  it("valida device-ui-action", () => {
    const parsed = deviceUiActionInputSchema.safeParse({
      deviceId: "device-1",
      windowId: "66500",
      runtimeId: "42.123.456",
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success ? parsed.data : null).toEqual({
      deviceId: "device-1",
      windowId: "66500",
      runtimeId: "42.123.456",
      action: "invoke",
      waitMs: 1500,
    })

    for (const action of [
      "invoke",
      "select",
      "toggle",
      "expand",
      "collapse",
      "focus",
    ] as const) {
      expect(
        deviceUiActionInputSchema.safeParse({
          deviceId: "device-1",
          windowId: "66500",
          runtimeId: "42.123.456",
          action,
        }).success,
      ).toBe(true)
    }

    expect(
      deviceUiActionInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "66500",
        runtimeId: "42.123.456",
        action: "setValue",
        value: "texto",
        waitMs: 0,
      }).success,
    ).toBe(true)

    expect(
      deviceUiActionInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "66500",
        runtimeId: "../42",
        action: "invoke",
      }).success,
    ).toBe(false)

    expect(
      deviceUiActionInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "66500",
        runtimeId: "42.123",
        action: "explode",
      }).success,
    ).toBe(false)

    expect(
      deviceUiActionInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "66500",
        runtimeId: "42.123",
        action: "setValue",
        value: "x".repeat(4097),
      }).success,
    ).toBe(false)
  })

  it("valida device-screenshot", () => {
    const parsed = deviceScreenshotInputSchema.safeParse({
      deviceId: "device-1",
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success ? parsed.data : null).toEqual({
      deviceId: "device-1",
      maxWidth: 1280,
      quality: 70,
      format: "jpeg",
    })

    expect(
      deviceScreenshotInputSchema.safeParse({
        deviceId: "device-1",
        monitor: 2,
        maxWidth: 1920,
        quality: 85,
        format: "png",
      }).success,
    ).toBe(true)

    expect(
      deviceScreenshotInputSchema.safeParse({
        deviceId: "device-1",
        region: { x: 0, y: 0, width: 800, height: 600 },
      }).success,
    ).toBe(true)

    expect(
      deviceScreenshotInputSchema.safeParse({
        deviceId: "device-1",
        monitor: 1,
        region: { x: 0, y: 0, width: 800, height: 600 },
      }).success,
    ).toBe(false)

    expect(
      deviceScreenshotInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "123:0",
      }).success,
    ).toBe(true)

    expect(
      deviceScreenshotInputSchema.safeParse({
        deviceId: "device-1",
        windowId: "123:0",
        region: { x: 0, y: 0, width: 800, height: 600 },
      }).success,
    ).toBe(false)

    expect(
      deviceScreenshotInputSchema.safeParse({
        deviceId: "device-1",
        screenshotId: "shot_reference_1",
        region: { x: 100, y: 200, width: 300, height: 400 },
      }).success,
    ).toBe(true)

    expect(
      deviceScreenshotInputSchema.safeParse({
        deviceId: "device-1",
        screenshotId: "shot_reference_1",
      }).success,
    ).toBe(false)

    expect(
      deviceScreenshotInputSchema.safeParse({
        deviceId: "device-1",
        maxWidth: 100,
      }).success,
    ).toBe(false)

    expect(
      deviceScreenshotInputSchema.safeParse({
        deviceId: "device-1",
        format: "webp",
      }).success,
    ).toBe(false)
  })

  it("valida as tools de clipboard", () => {
    expect(
      deviceReadClipboardInputSchema.safeParse({ deviceId: "device-1" }).success,
    ).toBe(true)

    expect(
      deviceWriteClipboardInputSchema.safeParse({
        deviceId: "device-1",
        text: "texto com\nquebra de linha",
      }).success,
    ).toBe(true)

    expect(
      deviceWriteClipboardInputSchema.safeParse({
        deviceId: "device-1",
        text: "",
      }).success,
    ).toBe(false)

    expect(
      deviceWriteClipboardInputSchema.safeParse({
        deviceId: "device-1",
        text: "a".repeat(100_001),
      }).success,
    ).toBe(false)

    expect(
      deviceWriteClipboardInputSchema.safeParse({
        deviceId: "device-1",
        text: "senha\u0000oculta",
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

  it("valida device-move-mouse", () => {
    expect(
      deviceMoveMouseInputSchema.safeParse({
        deviceId: "device-1",
        x: 120,
        y: -40,
      }).success,
    ).toBe(true)

    expect(
      deviceMoveMouseInputSchema.safeParse({
        deviceId: "device-1",
        x: 100_001,
        y: 0,
      }).success,
    ).toBe(false)

    expect(
      deviceMoveMouseInputSchema.safeParse({
        deviceId: "device-1",
        x: 10,
      }).success,
    ).toBe(false)
  })

  it("valida device-click", () => {
    const parsed = deviceClickInputSchema.safeParse({
      deviceId: "device-1",
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success ? parsed.data : null).toEqual({
      deviceId: "device-1",
      button: "left",
      count: 1,
    })

    expect(
      deviceClickInputSchema.safeParse({
        deviceId: "device-1",
        x: 10,
        y: 20,
        button: "right",
        count: 3,
      }).success,
    ).toBe(true)

    expect(
      deviceClickInputSchema.safeParse({
        deviceId: "device-1",
        x: 10,
      }).success,
    ).toBe(false)

    expect(
      deviceClickInputSchema.safeParse({
        deviceId: "device-1",
        button: "back",
      }).success,
    ).toBe(false)

    expect(
      deviceClickInputSchema.safeParse({
        deviceId: "device-1",
        count: 4,
      }).success,
    ).toBe(false)
  })

  it("valida device-scroll", () => {
    const parsed = deviceScrollInputSchema.safeParse({
      deviceId: "device-1",
      direction: "down",
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success ? parsed.data : null).toEqual({
      deviceId: "device-1",
      direction: "down",
      amount: 3,
    })

    expect(
      deviceScrollInputSchema.safeParse({
        deviceId: "device-1",
        x: 1,
        y: 2,
        direction: "right",
        amount: 50,
      }).success,
    ).toBe(true)

    expect(
      deviceScrollInputSchema.safeParse({
        deviceId: "device-1",
        direction: "down",
        amount: 51,
      }).success,
    ).toBe(false)

    expect(
      deviceScrollInputSchema.safeParse({
        deviceId: "device-1",
        direction: "diagonal",
      }).success,
    ).toBe(false)
  })

  it("valida device-drag", () => {
    const parsed = deviceDragInputSchema.safeParse({
      deviceId: "device-1",
      from: { x: 0, y: 0 },
      to: { x: 100, y: 50 },
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success ? parsed.data : null).toEqual({
      deviceId: "device-1",
      from: { x: 0, y: 0 },
      to: { x: 100, y: 50 },
      button: "left",
      durationMs: 500,
    })

    expect(
      deviceDragInputSchema.safeParse({
        deviceId: "device-1",
        from: { x: 0, y: 0 },
        to: { x: 10, y: 10 },
        durationMs: 100,
      }).success,
    ).toBe(true)

    expect(
      deviceDragInputSchema.safeParse({
        deviceId: "device-1",
        from: { x: 0, y: 0 },
        to: { x: 10, y: 10 },
        durationMs: 50,
      }).success,
    ).toBe(false)

    expect(
      deviceDragInputSchema.safeParse({
        deviceId: "device-1",
        from: { x: 0, y: 0 },
      }).success,
    ).toBe(false)
  })
})
