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
        html: '<div class="p-4 fixed" onclick="alert(1)">Oi</div>',
      },
      context,
    )

    expect(result).toEqual({
      uiVersion: HTML_UI_VERSION,
      html: '<div class="p-4">Oi</div>',
    })
  })

  it("returns a trimmed script for interactive widgets", async () => {
    const result = await renderHtmlTool.execute!(
      {
        html: "<div>Oi</div>",
        script: "  spectral.onReady(function () {});  ",
      },
      context,
    )

    expect(result).toEqual({
      uiVersion: HTML_UI_VERSION,
      html: "<div>Oi</div>",
      script: "spectral.onReady(function () {});",
    })
  })

  it("keeps widget hooks only when a script is present", async () => {
    const markup =
      '<div id="counter" data-count="0"><button data-increment>+1</button></div>'

    const widget = await renderHtmlTool.execute!(
      { html: markup, script: "void 0;" },
      context,
    )

    expect(widget).toEqual({
      uiVersion: HTML_UI_VERSION,
      html: '<div id="counter" data-count="0"><button data-increment="" type="button">+1</button></div>',
      script: "void 0;",
    })

    const staticResult = await renderHtmlTool.execute!(
      { html: markup },
      context,
    )

    expect(staticResult).toEqual({
      uiVersion: HTML_UI_VERSION,
      html: '<div><button type="button">+1</button></div>',
    })
  })

  it("moves inline scripts from html into the sandbox script", async () => {
    const result = await renderHtmlTool.execute!(
      {
        html: '<div data-count="0">0</div><script>document.title = "ok";</script>',
      },
      context,
    )

    expect(result).toEqual({
      uiVersion: HTML_UI_VERSION,
      html: '<div data-count="0">0</div>',
      script: 'document.title = "ok";',
    })
  })

  it("drops external and non-classic scripts without executing them", async () => {
    const result = await renderHtmlTool.execute!(
      {
        html: [
          '<div data-x="1">Oi</div>',
          '<script src="https://example.com/a.js"></script>',
          '<script type="application/json">{"a":1}</script>',
        ].join(""),
      },
      context,
    )

    expect(result).toEqual({
      uiVersion: HTML_UI_VERSION,
      html: "<div>Oi</div>",
    })
  })

  it("normalizes fenced script blocks", async () => {
    const result = await renderHtmlTool.execute!(
      {
        html: "<div>Oi</div>",
        script: "```js\nconsole.log(1)\n```",
      },
      context,
    )

    expect(result).toEqual({
      uiVersion: HTML_UI_VERSION,
      html: "<div>Oi</div>",
      script: "console.log(1)",
    })
  })

  it("omits a blank script", async () => {
    const result = await renderHtmlTool.execute!(
      {
        html: "<div>Oi</div>",
        script: "   ",
      },
      context,
    )

    expect(result).toEqual({
      uiVersion: HTML_UI_VERSION,
      html: "<div>Oi</div>",
    })
  })

  it("rejects html that becomes empty after sanitization", async () => {
    await expect(
      renderHtmlTool.execute!({ html: "<script>alert(1)</script>" }, context),
    ).rejects.toThrow("HTML não contém conteúdo permitido")
  })
})
