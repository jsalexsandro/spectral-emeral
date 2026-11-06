import { describe, expect, it } from "vitest"
import { HTML_UI_VERSION } from "@/lib/ai/ui/html-policy"
import { renderHtmlTool } from "./render-html"

const context = {
  toolCallId: "test",
  messages: [],
  context: {},
}

describe("renderHtml tool", () => {
  it("sanitizes html before returning", async () => {
    const result = await renderHtmlTool.execute!(
      {
        html: '<div class="p-4 fixed"><script>alert(1)</script>Oi</div>',
      },
      context,
    )

    expect(result).toEqual({
      uiVersion: HTML_UI_VERSION,
      html: '<div class="p-4">Oi</div>',
    })
  })

  it("rejects html that becomes empty after sanitization", async () => {
    await expect(
      renderHtmlTool.execute!({ html: "<script>alert(1)</script>" }, context),
    ).rejects.toThrow("HTML não contém conteúdo permitido")
  })
})
