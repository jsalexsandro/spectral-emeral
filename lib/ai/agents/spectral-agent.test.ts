import { describe, expect, it } from "vitest"
import { RENDER_HTML_TOOL_NAME } from "@/lib/ai/ui/html-policy"
import {
  MAX_AGENT_OUTPUT_TOKENS,
  MAX_AGENT_STEPS,
  MAX_RENDER_HTML_CALLS,
  countRenderHtmlCalls,
  shouldWrapUpAgent,
  totalOutputTokens,
  type StepWithUsage,
} from "./spectral-agent"

function step({
  inputTokens = 1_000,
  outputTokens = 100,
  toolCalls = [],
}: {
  inputTokens?: number
  outputTokens?: number
  toolCalls?: Array<{ toolName: string }>
} = {}): StepWithUsage {
  return {
    toolCalls,
    usage: { inputTokens, outputTokens },
  }
}

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

describe("totalOutputTokens", () => {
  it("sums only output tokens", () => {
    expect(
      totalOutputTokens([
        step({ inputTokens: 50_000, outputTokens: 200 }),
        step({ inputTokens: 60_000, outputTokens: 300 }),
      ]),
    ).toBe(500)
  })
})

describe("shouldWrapUpAgent", () => {
  it("does nothing on the first step", () => {
    expect(shouldWrapUpAgent([])).toBe(false)
  })

  it("keeps running while there is budget", () => {
    expect(
      shouldWrapUpAgent([
        step({ outputTokens: 1_000 }),
        step({ outputTokens: 1_000 }),
        step({ outputTokens: 1_000 }),
      ]),
    ).toBe(false)
  })

  it("wraps up when the accumulated output budget is exhausted", () => {
    expect(shouldWrapUpAgent([step({ outputTokens: MAX_AGENT_OUTPUT_TOKENS })])).toBe(
      true,
    )
  })

  it("wraps up when the last context is too large", () => {
    expect(shouldWrapUpAgent([step({ inputTokens: 100_000 })])).toBe(true)
  })

  it("wraps up after the renderHtml limit instead of cutting the reply", () => {
    expect(
      shouldWrapUpAgent([
        step({ toolCalls: [{ toolName: RENDER_HTML_TOOL_NAME }] }),
        step({ toolCalls: [{ toolName: RENDER_HTML_TOOL_NAME }] }),
      ]),
    ).toBe(true)
  })

  it("wraps up one step before the hard step limit", () => {
    const almost = Array.from({ length: MAX_AGENT_STEPS - 2 }, () => step())
    const atLimit = Array.from({ length: MAX_AGENT_STEPS - 1 }, () => step())

    expect(shouldWrapUpAgent(almost)).toBe(false)
    expect(shouldWrapUpAgent(atLimit)).toBe(true)
  })

  it("keeps the hard stop above the wrap-up step", () => {
    expect(MAX_AGENT_STEPS + 1).toBeGreaterThan(MAX_AGENT_STEPS - 1)
  })
})
