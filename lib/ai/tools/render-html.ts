import { tool } from "ai"
import { sanitizeHtml } from "@/lib/ai/ui/html-sanitize"
import {
  HTML_UI_VERSION,
  renderHtmlToolInputSchema,
} from "@/lib/ai/ui/html-policy"

const description = [
  "Renderiza HTML sanitizado dentro da conversa.",
  "Use quando uma tabela, métrica, destaque, layout ou conjunto de botões comunicar melhor do que texto corrido.",
  "Envie apenas um fragmento HTML, sem <html>, <head> ou <body>.",
  "Use somente tags semânticas e classes Tailwind permitidas pelo system prompt.",
  "Nunca use <script>, <style>, <iframe>, formulários, estilos inline ou atributos on*.",
  "Botões devem usar data-spectral-action com uma ação JSON válida, por exemplo:",
  '<button type="button" data-spectral-action=\'{"type":"openSettings","section":"byok"}\'>Abrir BYOK</button>',
  "Links externos usam apenas http(s) ou mailto e target=\"_blank\" com rel=\"noopener noreferrer\".",
  "Chame no máximo duas vezes por resposta e prefira uma única chamada.",
  "Não repita no texto os mesmos dados exibidos no HTML e nunca invente dados.",
].join("\n")

export const renderHtmlTool = tool({
  description,
  inputSchema: renderHtmlToolInputSchema,
  execute: async ({ html }) => {
    const sanitized = sanitizeHtml(html)

    if (!sanitized) {
      throw new Error(
        "O HTML não contém conteúdo permitido. Gere novamente usando apenas as tags, classes e ações permitidas.",
      )
    }

    return {
      uiVersion: HTML_UI_VERSION,
      html: sanitized,
    }
  },
})
