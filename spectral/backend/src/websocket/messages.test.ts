import { describe, expect, it } from "vitest"
import { commandResultMessageSchema } from "./messages.js"

const element = {
  runtimeId: "42.393250.4.0.0.656",
  name: "Fechar",
  role: "Button",
  bounds: { x: 10, y: 20, width: 30, height: 30 },
  center: { x: 25, y: 35 },
  enabled: true,
  focused: false,
  selected: null,
  expanded: null,
  offscreen: false,
  actionable: true,
  actions: ["invoke", "focus"],
  automationId: "close-tab",
  path: [{ name: "Guia", role: "TabItem" }],
}

function parseResult(result: unknown) {
  return commandResultMessageSchema.safeParse({
    type: "device:command:result",
    id: "command-1",
    result,
  })
}

describe("commandResultMessageSchema", () => {
  it("preserva o resultado de inspect-ui", () => {
    const parsed = parseResult({
      ok: true,
      ui: {
        windowId: "393250",
        windowTitle: "Chrome",
        elements: [element],
        scanned: 12,
        truncated: false,
      },
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || !parsed.data.result.ok) {
      throw new Error("Esperava um resultado ok.")
    }

    expect(parsed.data.result.ui?.elements[0]?.runtimeId).toBe(
      "42.393250.4.0.0.656",
    )
    expect(parsed.data.result.ui?.elements[0]?.actions).toEqual([
      "invoke",
      "focus",
    ])
  })

  it("preserva o resultado de ui-action", () => {
    const parsed = parseResult({
      ok: true,
      uiAction: {
        windowId: "393250",
        action: "select",
        element: { ...element, role: "TabItem", selected: true },
      },
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || !parsed.data.result.ok) {
      throw new Error("Esperava um resultado ok.")
    }

    expect(parsed.data.result.uiAction?.action).toBe("select")
    expect(parsed.data.result.uiAction?.element.selected).toBe(true)
  })

  it("rejeita runtimeId malformado", () => {
    const parsed = parseResult({
      ok: true,
      ui: {
        windowId: "393250",
        windowTitle: "Chrome",
        elements: [{ ...element, runtimeId: "42; rm -rf /" }],
        scanned: 1,
        truncated: false,
      },
    })

    expect(parsed.success).toBe(false)
  })
})
