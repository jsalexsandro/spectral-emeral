import { describe, expect, it } from "vitest"
import {
  buildWidgetThemeMessage,
  clampWidgetHeight,
  requiresUserGesture,
  widgetMessageSchema,
  widgetThemeMessageSchema,
  WIDGET_ACTION_WINDOW_MS,
  WIDGET_IFRAME_SANDBOX,
  WIDGET_MAX_ACTIONS_PER_SESSION,
  WIDGET_MAX_ACTIONS_PER_WINDOW,
  WIDGET_MAX_HEIGHT,
  WIDGET_MIN_HEIGHT,
  WIDGET_PROTOCOL_VERSION,
} from "./widget-protocol"

const nonce = "widget-1"
const envelope = { protocol: WIDGET_PROTOCOL_VERSION, nonce }

describe("widget message schema", () => {
  it("accepts ready, resize, action and open messages", () => {
    const messages = [
      { ...envelope, type: "widget:ready" },
      { ...envelope, type: "widget:resize", height: 240 },
      {
        ...envelope,
        type: "widget:action",
        requestId: "req-1",
        action: { type: "toast", title: "Oi" },
        userInitiated: true,
      },
      {
        ...envelope,
        type: "widget:open",
        url: "https://example.com",
        userInitiated: true,
      },
    ]

    for (const message of messages) {
      expect(widgetMessageSchema.safeParse(message).success).toBe(true)
    }
  })

  it("rejects unknown messages and wrong protocol versions", () => {
    expect(
      widgetMessageSchema.safeParse({ ...envelope, type: "widget:other" })
        .success,
    ).toBe(false)
    expect(
      widgetMessageSchema.safeParse({
        ...envelope,
        protocol: WIDGET_PROTOCOL_VERSION + 1,
        type: "widget:ready",
      }).success,
    ).toBe(false)
  })

  it("rejects messages without a nonce", () => {
    expect(
      widgetMessageSchema.safeParse({
        protocol: WIDGET_PROTOCOL_VERSION,
        type: "widget:ready",
      }).success,
    ).toBe(false)
    expect(
      widgetMessageSchema.safeParse({
        ...envelope,
        nonce: "",
        type: "widget:ready",
      }).success,
    ).toBe(false)
  })

  it("accepts openDeviceApp as a widget action", () => {
    expect(
      widgetMessageSchema.safeParse({
        ...envelope,
        type: "widget:action",
        requestId: "req-1",
        action: {
          type: "openDeviceApp",
          deviceId: "device-1",
          appId: "chrome",
        },
        userInitiated: true,
      }).success,
    ).toBe(true)
  })

  it("rejects invalid actions", () => {
    expect(
      widgetMessageSchema.safeParse({
        ...envelope,
        type: "widget:action",
        requestId: "req-1",
        action: { type: "navigate", path: "/admin" },
        userInitiated: true,
      }).success,
    ).toBe(false)
    expect(
      widgetMessageSchema.safeParse({
        ...envelope,
        type: "widget:action",
        requestId: "req-1",
        action: { type: "unknown" },
        userInitiated: true,
      }).success,
    ).toBe(false)
  })

  it("rejects disallowed URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,oi",
      "/app",
      "file:///etc/passwd",
    ]) {
      expect(
        widgetMessageSchema.safeParse({
          ...envelope,
          type: "widget:open",
          url,
          userInitiated: true,
        }).success,
      ).toBe(false)
    }

    expect(
      widgetMessageSchema.safeParse({
        ...envelope,
        type: "widget:open",
        url: "mailto:oi@example.com",
        userInitiated: false,
      }).success,
    ).toBe(true)
  })

  it("validates parent to widget theme messages", () => {
    expect(
      widgetThemeMessageSchema.safeParse(buildWidgetThemeMessage(nonce, "dark"))
        .success,
    ).toBe(true)
    expect(
      widgetThemeMessageSchema.safeParse({
        ...envelope,
        type: "widget:theme",
        theme: "system",
      }).success,
    ).toBe(false)
  })
})

describe("widget protocol helpers", () => {
  it("never enables same-origin in the sandbox", () => {
    expect(WIDGET_IFRAME_SANDBOX).toBe("allow-scripts")
    expect(WIDGET_IFRAME_SANDBOX).not.toContain("allow-same-origin")
  })

  it("clamps reported heights", () => {
    expect(clampWidgetHeight(240.4)).toBe(240)
    expect(clampWidgetHeight(0)).toBe(WIDGET_MIN_HEIGHT)
    expect(clampWidgetHeight(-100)).toBe(WIDGET_MIN_HEIGHT)
    expect(clampWidgetHeight(99_999)).toBe(WIDGET_MAX_HEIGHT)
    expect(clampWidgetHeight(Number.NaN)).toBe(WIDGET_MIN_HEIGHT)
    expect(clampWidgetHeight(Number.POSITIVE_INFINITY)).toBe(WIDGET_MIN_HEIGHT)
  })

  it("requires a user gesture for conversation, route and device changes", () => {
    expect(requiresUserGesture("sendMessage")).toBe(true)
    expect(requiresUserGesture("navigate")).toBe(true)
    expect(requiresUserGesture("openDeviceApp")).toBe(true)
    expect(requiresUserGesture("toast")).toBe(false)
    expect(requiresUserGesture("setTheme")).toBe(false)
    expect(requiresUserGesture("openSettings")).toBe(false)
    expect(requiresUserGesture("copy")).toBe(false)
  })

  it("builds a theme message bound to the instance nonce", () => {
    expect(buildWidgetThemeMessage("abc", "light")).toEqual({
      type: "widget:theme",
      protocol: WIDGET_PROTOCOL_VERSION,
      nonce: "abc",
      theme: "light",
    })
  })

  it("keeps conservative action limits", () => {
    expect(WIDGET_MAX_ACTIONS_PER_SESSION).toBe(40)
    expect(WIDGET_MAX_ACTIONS_PER_WINDOW).toBe(12)
    expect(WIDGET_MAX_ACTIONS_PER_WINDOW).toBeLessThan(
      WIDGET_MAX_ACTIONS_PER_SESSION,
    )
    expect(WIDGET_ACTION_WINDOW_MS).toBe(10_000)
  })
})
