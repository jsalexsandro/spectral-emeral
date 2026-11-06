import { describe, expect, it } from "vitest"
import { getThemeTool } from "@/lib/ai/tools/get-theme"
import { GET_THEME_TOOL_NAME } from "@/lib/ai/tools/get-theme"

describe("get-theme tool", () => {
  it("retorna currentTheme do resolvedTheme quando disponível", async () => {
    const result = await getThemeTool.execute!(
      {},
      {
        toolCallId: "test-1",
        messages: [],
        context: { theme: "system", resolvedTheme: "light" },
      },
    )

    expect(result).toEqual({
      currentTheme: "light",
      preference: "system",
      resolvedTheme: "light",
    })
  })

  it("retorna currentTheme da preference quando resolvedTheme é null e preference não é system", async () => {
    const result = await getThemeTool.execute!(
      {},
      {
        toolCallId: "test-2",
        messages: [],
        context: { theme: "dark", resolvedTheme: null },
      },
    )

    expect(result).toEqual({
      currentTheme: "dark",
      preference: "dark",
      resolvedTheme: null,
    })
  })

  it("retorna null quando não há tema efetivo disponível", async () => {
    const result = await getThemeTool.execute!(
      {},
      {
        toolCallId: "test-3",
        messages: [],
        context: {},
      },
    )

    expect(result).toEqual({
      currentTheme: null,
      preference: null,
      resolvedTheme: null,
    })
  })

  it("tem o nome esperado", () => {
    expect(GET_THEME_TOOL_NAME).toBe("get-theme")
  })
})
