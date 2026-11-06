import { describe, expect, it } from "vitest"
import { getThemeTool } from "@/lib/ai/tools/get-theme"
import { GET_THEME_TOOL_NAME } from "@/lib/ai/tools/get-theme"

describe("get-theme tool", () => {
  it("retorna theme e resolvedTheme do contexto", async () => {
    const result = await getThemeTool.execute!(
      {},
      {
        toolCallId: "test-1",
        messages: [],
        context: { theme: "dark", resolvedTheme: "dark" },
      },
    )

    expect(result).toEqual({ theme: "dark", resolvedTheme: "dark" })
  })

  it("retorna null quando o contexto não tem tema", async () => {
    const result = await getThemeTool.execute!(
      {},
      {
        toolCallId: "test-2",
        messages: [],
        context: {},
      },
    )

    expect(result).toEqual({ theme: null, resolvedTheme: null })
  })

  it("tem o nome esperado", () => {
    expect(GET_THEME_TOOL_NAME).toBe("get-theme")
  })
})
