import { tool } from "ai"
import { sanitizeHtml } from "@/lib/ai/ui/html-sanitize"
import {
  HTML_UI_VERSION,
  MAX_SCRIPT_LENGTH,
  normalizeScriptInput,
  renderHtmlToolInputSchema,
} from "@/lib/ai/ui/html-policy"

const scriptBlockPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi

function scriptType(attributes: string): string | null {
  const match = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)

  return match ? match[1].toLowerCase() : null
}

function hasSource(attributes: string): boolean {
  return /\bsrc\s*=/i.test(attributes)
}

/**
 * Aceita também o formato "documento único" que alguns modelos geram: o
 * `<script>` embutido no HTML é movido para o campo `script` e passa a rodar no
 * sandbox, em vez de ser descartado pela sanitização.
 */
function splitInlineScripts(html: string): { html: string; scripts: string[] } {
  const scripts: string[] = []

  const stripped = html.replace(
    scriptBlockPattern,
    (_match, attributes: string, body: string) => {
      const type = scriptType(attributes)
      const isClassicScript =
        type === null || type === "text/javascript" || type === "application/javascript"

      if (!hasSource(attributes) && isClassicScript && body.trim()) {
        scripts.push(body.trim())
      }

      return ""
    },
  )

  return { html: stripped, scripts }
}

const description = [
  "Renderiza HTML sanitizado dentro da conversa.",
  "Use quando uma tabela, métrica, destaque, layout ou conjunto de botões comunicar melhor do que texto corrido.",
  "Envie apenas um fragmento HTML, sem <html>, <head> ou <body>.",
  "Use somente tags semânticas e classes Tailwind permitidas pelo system prompt.",
  "Nunca use <script>, <style>, <iframe>, formulários, estilos inline ou atributos on* dentro de `html`.",
  "Para widgets interativos, envie JavaScript opcional em `script`: ele roda isolado em um iframe sandbox, sem acesso ao app, rede ou storage.",
  "Se você enviar `<script>` dentro de `html`, ele é movido automaticamente para o sandbox; ainda assim, prefira o campo `script`.",
  "Dentro do script use apenas a API `spectral`: spectral.action(acao), spectral.theme, spectral.onThemeChange(fn) e spectral.onReady(fn).",
  "Dispare ações apenas em resposta a clique, input ou teclado do usuário. Nunca em loop, em timer ou na carga.",
  "Botões devem usar data-spectral-action com uma ação JSON válida, por exemplo:",
  '<button type="button" data-spectral-action=\'{"type":"openSettings","section":"byok"}\'>Abrir BYOK</button>',
  "Links externos usam apenas http(s) ou mailto; o runtime abre links fora do sandbox com noopener noreferrer.",
  "Chame no máximo duas vezes por resposta e prefira uma única chamada.",
  "Não repita no texto os mesmos dados exibidos no HTML e nunca invente dados.",
].join("\n")

export const renderHtmlTool = tool({
  description,
  inputSchema: renderHtmlToolInputSchema,
  execute: async ({ html, script }) => {
    const split = splitInlineScripts(html)
    const providedScript = normalizeScriptInput(script ?? "") as
      | string
      | undefined
    const combinedScript = [split.scripts.join("\n\n"), providedScript]
      .filter(Boolean)
      .join("\n\n")

    if (combinedScript.length > MAX_SCRIPT_LENGTH) {
      throw new Error(
        `O script do widget excede ${MAX_SCRIPT_LENGTH} caracteres. Reduza o JavaScript e tente novamente.`,
      )
    }

    const sanitized = sanitizeHtml(split.html, {
      widget: Boolean(combinedScript),
    })

    if (!sanitized) {
      throw new Error(
        "O HTML não contém conteúdo permitido. Gere novamente usando apenas as tags, classes e ações permitidas.",
      )
    }

    return {
      uiVersion: HTML_UI_VERSION,
      html: sanitized,
      ...(combinedScript ? { script: combinedScript } : {}),
    }
  },
})
