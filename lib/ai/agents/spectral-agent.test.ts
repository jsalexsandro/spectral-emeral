import { describe, expect, it } from "vitest"
import { RENDER_HTML_TOOL_NAME } from "@/lib/ai/ui/html-policy"
import { MAX_RENDER_HTML_CALLS, countRenderHtmlCalls } from "./spectral-agent"

describe("countRenderHtmlCalls", () => {
  it("counts renderHtml calls across steps", () => {
    const count = countRenderHtmlCalls([
      { toolCalls: [{ toolName: RENDER_HTML_TOOL_NAME }] },
      {
        toolCalls: [
          { toolName: "model-list-enabled" },
          { toolName: RENDER_HTML_TOOL_NAME },
        ],
      },
    ])

    expect(count).toBe(2)
  })

  it("ignores other tools", () => {
    expect(
      countRenderHtmlCalls([{ toolCalls: [{ toolName: "fetchUrl" }] }]),
    ).toBe(0)
  })

  it("keeps the loop guard aligned with the prompt limit", () => {
    expect(MAX_RENDER_HTML_CALLS).toBe(2)
  })
})
