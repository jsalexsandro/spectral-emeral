import { describe, expect, it } from "vitest"
import { RENDER_UI_TOOL_NAME } from "@/lib/ai/ui/catalog"
import { MAX_RENDER_UI_CALLS, countRenderUiCalls } from "./spectral-agent"

describe("countRenderUiCalls", () => {
  it("counts renderUi calls across steps", () => {
    const count = countRenderUiCalls([
      { toolCalls: [{ toolName: RENDER_UI_TOOL_NAME }] },
      {
        toolCalls: [
          { toolName: "model-list-enabled" },
          { toolName: RENDER_UI_TOOL_NAME },
        ],
      },
    ])

    expect(count).toBe(2)
  })

  it("ignores other tools", () => {
    expect(
      countRenderUiCalls([{ toolCalls: [{ toolName: "fetchUrl" }] }]),
    ).toBe(0)
  })

  it("keeps the loop guard aligned with the prompt limit", () => {
    expect(MAX_RENDER_UI_CALLS).toBe(2)
  })
})
