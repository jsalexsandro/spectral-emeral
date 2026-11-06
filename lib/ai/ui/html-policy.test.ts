import { describe, expect, it } from "vitest"
import {
  MAX_HTML_LENGTH,
  MAX_SCRIPT_LENGTH,
  isAllowedHtmlUri,
  parseHtmlAction,
  renderHtmlToolInputSchema,
  sanitizeHtmlClassList,
} from "./html-policy"
import { sanitizeHtml } from "./html-sanitize"

describe("html sanitization", () => {
  it("keeps allowed markup and removes unknown classes", () => {
    expect(
      sanitizeHtml(
        '<div class="p-4 fixed rounded-xl"><h2 class="text-lg font-semibold">Oi</h2></div>',
      ),
    ).toBe(
      '<div class="p-4 rounded-xl"><h2 class="text-lg font-semibold">Oi</h2></div>',
    )
  })

  it("removes scripts, styles and event handlers", () => {
    const result = sanitizeHtml(
      '<div onclick="alert(1)">Oi<script>alert(1)</script><style>body{display:none}</style></div>',
    )

    expect(result).toBe("<div>Oi</div>")
    expect(result).not.toContain("script")
    expect(result).not.toContain("onclick")
    expect(result).not.toContain("style")
  })

  it("removes iframes, forms and svg but keeps safe inputs", () => {
    expect(
      sanitizeHtml(
        '<iframe src="https://example.com"></iframe><form><input value="x" type="hidden"></form><svg onload="alert(1)"></svg>',
      ),
    ).toBe('<input value="x" type="text">')
  })

  it("forces a safe input type", () => {
    expect(sanitizeHtml('<input type="file" name="f">')).toBe(
      '<input type="text">',
    )
    expect(sanitizeHtml('<input type="range" min="0" max="10">')).toBe(
      '<input type="range" min="0" max="10">',
    )
  })

  it("rejects javascript and data URLs", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>")
    expect(sanitizeHtml('<a href="data:text/html,oi">x</a>')).toBe("<a>x</a>")
  })

  it("keeps safe external links and adds rel for blank targets", () => {
    const result = sanitizeHtml(
      '<a href="https://example.com" target="_blank">Exemplo</a>',
    )

    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('target="_blank"')
    expect(result).toContain('rel="noopener noreferrer"')
  })

  it("forces button type and preserves valid actions", () => {
    const result = sanitizeHtml(
      `<button data-spectral-action='{"type":"openSettings","section":"byok"}'>Abrir</button>`,
    )

    expect(result).toContain('type="button"')
    expect(result).toContain("data-spectral-action")
    expect(result).toContain("openSettings")
  })

  it("removes invalid or misplaced actions", () => {
    expect(
      sanitizeHtml(
        `<button data-spectral-action='not-json'>A</button><div data-spectral-action='{"type":"toast","title":"Oi"}'>B</div>`,
      ),
    ).toBe("<button type=\"button\">A</button><div>B</div>")
  })

  it("removes unknown data and aria attributes", () => {
    expect(
      sanitizeHtml(
        '<div data-evil="1" aria-evil="1" aria-label="Resumo">Oi</div>',
      ),
    ).toBe('<div aria-label="Resumo">Oi</div>')
  })

  it("removes inline styles and ids", () => {
    expect(
      sanitizeHtml('<div id="app" style="position:fixed">Oi</div>'),
    ).toBe("<div>Oi</div>")
  })

  it("keeps data attributes and ids only in widget mode", () => {
    const markup =
      '<div id="counter" data-count="0"><button data-increment>+1</button></div>'

    expect(sanitizeHtml(markup, { widget: true })).toBe(
      '<div id="counter" data-count="0"><button data-increment="" type="button">+1</button></div>',
    )
    expect(sanitizeHtml(markup)).toBe(
      '<div><button type="button">+1</button></div>',
    )
  })

  it("still validates actions inside widget mode", () => {
    expect(
      sanitizeHtml(
        `<div data-state="open" data-spectral-action='{"type":"toast","title":"Oi"}'>A</div>`,
        { widget: true },
      ),
    ).toBe('<div data-state="open">A</div>')
  })

  it("allows ids, labels and names in widget mode", () => {
    const markup =
      '<label for="q">Busca</label><input id="q" name="q" type="search">'

    expect(sanitizeHtml(markup, { widget: true })).toBe(markup)
    expect(sanitizeHtml(markup)).toBe(
      '<label>Busca</label><input type="search">',
    )
  })
})

describe("html policy helpers", () => {
  it("normalizes fenced html input", () => {
    const parsed = renderHtmlToolInputSchema.safeParse({
      html: "```html\n<div class=\"p-4\">Oi</div>\n```",
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.html).toBe('<div class="p-4">Oi</div>')
  })

  it("rejects empty and oversized html", () => {
    expect(renderHtmlToolInputSchema.safeParse({ html: "   " }).success).toBe(
      false,
    )
    expect(
      renderHtmlToolInputSchema.safeParse({
        html: "a".repeat(MAX_HTML_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it("accepts an optional script and enforces its limit", () => {
    expect(
      renderHtmlToolInputSchema.safeParse({
        html: "<div>Oi</div>",
        script: "console.log(1)",
      }).success,
    ).toBe(true)

    const blank = renderHtmlToolInputSchema.safeParse({
      html: "<div>Oi</div>",
      script: "   ",
    })

    expect(blank.success).toBe(true)
    expect(blank.success && blank.data.script).toBeUndefined()

    expect(
      renderHtmlToolInputSchema.safeParse({
        html: "<div>Oi</div>",
        script: "a".repeat(MAX_SCRIPT_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it("validates action payloads", () => {
    expect(
      parseHtmlAction('{"type":"setTheme","theme":"dark"}')?.type,
    ).toBe("setTheme")
    expect(parseHtmlAction('{"type":"sendMessage","text":"Oi"}')?.type).toBe(
      "sendMessage",
    )
    expect(parseHtmlAction('{"type":"navigate","path":"/admin"}')).toBeNull()
    expect(parseHtmlAction("not-json")).toBeNull()
    expect(parseHtmlAction(null)).toBeNull()
  })

  it("allows only http, https and mailto URLs", () => {
    expect(isAllowedHtmlUri("https://example.com")).toBe(true)
    expect(isAllowedHtmlUri("http://example.com")).toBe(true)
    expect(isAllowedHtmlUri("mailto:oi@example.com")).toBe(true)
    expect(isAllowedHtmlUri("javascript:alert(1)")).toBe(false)
    expect(isAllowedHtmlUri("/app")).toBe(false)
  })

  it("filters class tokens", () => {
    expect(sanitizeHtmlClassList("p-4 fixed text-sm")).toBe("p-4 text-sm")
    expect(sanitizeHtmlClassList("fixed absolute z-50")).toBe("")
  })
})
