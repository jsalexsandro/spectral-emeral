import { WIDGET_PROTOCOL_VERSION } from "./widget-protocol"
import { WIDGET_RUNTIME_SCRIPT } from "./widget-runtime"

export type WidgetTheme = "light" | "dark"

export type BuildWidgetSrcDocInput = {
  html: string
  script?: string
  nonce: string
  theme: WidgetTheme
  css?: string
  fontFamily?: string
}

export const WIDGET_SRCDOC_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ")

/**
 * Fecha a tag de script sem alterar a semântica do JavaScript. Sem isso um
 * `</script>` dentro de uma string do modelo encerraria o bloco e permitiria
 * injetar HTML arbitrário.
 */
export function escapeInlineScript(source: string): string {
  return source.replace(/<\/(script)/gi, "<\\/$1")
}

function escapeStyle(source: string): string {
  return source.replace(/<\/style/gi, "")
}

export function buildWidgetSrcDoc({
  html,
  script,
  nonce,
  theme,
  css = "",
  fontFamily,
}: BuildWidgetSrcDocInput): string {
  const config = JSON.stringify({
    protocol: WIDGET_PROTOCOL_VERSION,
    nonce,
    theme,
  })

  const baseStyle = [
    "html,body{margin:0;padding:0;background:transparent}",
    "body{color:var(--foreground,inherit);overflow:hidden}",
    fontFamily ? `body{font-family:${fontFamily}}` : "",
    "a{cursor:pointer}",
    "*{box-sizing:border-box}",
  ]
    .filter(Boolean)
    .join("\n")

  const runtimeScript = escapeInlineScript(WIDGET_RUNTIME_SCRIPT)
  const modelScript = script ? escapeInlineScript(script) : ""

  return [
    "<!DOCTYPE html>",
    `<html lang="pt-BR" class="${theme === "dark" ? "dark" : ""}">`,
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<meta http-equiv="Content-Security-Policy" content="${WIDGET_SRCDOC_CSP}" />`,
    `<style>${escapeStyle(css)}\n${baseStyle}</style>`,
    "</head>",
    "<body>",
    html,
    `<script>window.__SPECTRAL_WIDGET__=${config};</script>`,
    `<script>${runtimeScript}</script>`,
    modelScript ? `<script>${modelScript}</script>` : "",
    "</body>",
    "</html>",
  ].join("")
}
