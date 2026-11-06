import { describe, expect, it } from "vitest"
import { WIDGET_PROTOCOL_VERSION } from "./widget-protocol"
import {
  buildWidgetSrcDoc,
  escapeInlineScript,
  WIDGET_SRCDOC_CSP,
} from "./widget-srcdoc"

const baseInput = {
  html: "<div>Oi</div>",
  nonce: "widget-1",
  theme: "light" as const,
}

describe("widget srcdoc", () => {
  it("locks the document down with a restrictive CSP", () => {
    const srcDoc = buildWidgetSrcDoc(baseInput)

    expect(srcDoc).toContain(
      '<meta http-equiv="Content-Security-Policy"',
    )
    expect(srcDoc).toContain(WIDGET_SRCDOC_CSP)
    expect(WIDGET_SRCDOC_CSP).toContain("default-src 'none'")
    expect(WIDGET_SRCDOC_CSP).toContain("connect-src 'none'")
    expect(WIDGET_SRCDOC_CSP).toContain("form-action 'none'")
    expect(WIDGET_SRCDOC_CSP).toContain("base-uri 'none'")
    expect(WIDGET_SRCDOC_CSP).not.toContain("unsafe-eval")
  })

  it("injects the app css, base styles and font family", () => {
    const srcDoc = buildWidgetSrcDoc({
      ...baseInput,
      css: ".text-sm{font-size:0.875rem}",
      fontFamily: "Geist, sans-serif",
    })

    expect(srcDoc).toContain(".text-sm{font-size:0.875rem}")
    expect(srcDoc).toContain("body{font-family:Geist, sans-serif}")
    expect(srcDoc).toContain("box-sizing:border-box")
  })

  it("strips a closing style tag from injected css", () => {
    const srcDoc = buildWidgetSrcDoc({
      ...baseInput,
      css: "body{color:red}</style><script>alert(1)</script>",
    })

    expect(srcDoc).not.toContain("</style><script>")
  })

  it("places config, runtime and model script in order", () => {
    const srcDoc = buildWidgetSrcDoc({
      ...baseInput,
      script: "spectral.onReady(function () {});",
    })

    const configIndex = srcDoc.indexOf("window.__SPECTRAL_WIDGET__=")
    const runtimeIndex = srcDoc.indexOf('Object.defineProperty(window, "spectral"')
    const modelIndex = srcDoc.indexOf("spectral.onReady")

    expect(configIndex).toBeGreaterThan(-1)
    expect(runtimeIndex).toBeGreaterThan(configIndex)
    expect(modelIndex).toBeGreaterThan(runtimeIndex)
  })

  it("passes the nonce, protocol and theme to the runtime", () => {
    const srcDoc = buildWidgetSrcDoc({ ...baseInput, theme: "dark" })

    expect(srcDoc).toContain(`"protocol":${WIDGET_PROTOCOL_VERSION}`)
    expect(srcDoc).toContain('"nonce":"widget-1"')
    expect(srcDoc).toContain('"theme":"dark"')
    expect(srcDoc).toContain('<html lang="pt-BR" class="dark">')
  })

  it("omits the dark class in light mode", () => {
    const srcDoc = buildWidgetSrcDoc(baseInput)

    expect(srcDoc).toContain('<html lang="pt-BR" class="">')
  })

  it("omits the model script when none is provided", () => {
    const srcDoc = buildWidgetSrcDoc(baseInput)
    const scriptTags = srcDoc.match(/<script>/g) ?? []

    expect(scriptTags).toHaveLength(2)
  })

  it("escapes closing script tags in model code", () => {
    const srcDoc = buildWidgetSrcDoc({
      ...baseInput,
      script: 'var payload = "</script><img src=x onerror=alert(1)>";',
    })

    expect(srcDoc).not.toContain("</script><img")
    expect(srcDoc).toContain("<\\/script><img")
    expect(srcDoc.match(/<\/script>/g) ?? []).toHaveLength(3)
  })

  it("escapes closing script tags case-insensitively", () => {
    expect(escapeInlineScript("</SCRIPT >")).toBe("<\\/SCRIPT >")
    expect(escapeInlineScript("a</script>b")).toBe("a<\\/script>b")
  })
})
