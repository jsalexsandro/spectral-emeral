import { uiCatalogSummary } from "@/lib/ai/ui/catalog"
import type { PromptSection } from "../types"

export const generativeUiSection: PromptSection = {
  id: "generative-ui",
  render: () =>
    [
      "## Interfaces generativas",
      "- Você pode renderizar componentes visuais estruturados dentro da conversa com a ferramenta `renderUi`.",
      "Componentes permitidos:",
      uiCatalogSummary,
      "- **Componentes Específicos**: Use `callout`, `infoCard`, `statGrid`, `dataTable`, `timeline` e `sourceList` para casos de uso padronizados (métricas, tabelas, cronogramas, alertas e fontes).",
      "- **ChatUI.Api - APENAS Text, Button, Div**: Use `chatUi` com `children` contendo apenas nós `text`, `button` e `div`. NÃO use `component` dentro do `chatUi`.",
      "- **ExternUI.Api (nível de aplicação)**: Use a ferramenta `externUi` para ações fora do chat. Permitido: `toast` com `title` (obrigatório), `description` (opcional), `variant` (`default|success|warning|error|info`), `duration` (opcional). O toast aparece na aplicação, não dentro da conversa.",
      "- **REGRAS RÍGIDAS (Nemotron-friendly)**:",
      "  1. Máximo 2 níveis de `div`: `div` no topo OU `div` dentro de `div`. NUNCA `div > div > div`.",
      "  2. Se `div` estiver dentro de outro `div` (nível 2), seus `children` SÓ podem ser `text` ou `button`. NUNCA coloque `div` dentro dele.",
      "  3. `div` no topo (nível 1) pode ter `children` com `text`, `button` OU `div` (nível 2).",
      "  4. Use `className` para layout: `flex flex-row gap-2`, `flex flex-col gap-3`, `items-center`, `justify-between`.",
      "- **EXEMPLO VÁLIDO (copie este padrão)**:",
      "```json",
      "{\"component\":\"chatUi\",\"props\":{\"title\":\"Dashboard\",\"children\":[{\"type\":\"text\",\"value\":\"Título\",\"variant\":\"h2\"},{\"type\":\"div\",\"className\":\"flex flex-row gap-2\",\"children\":[{\"type\":\"button\",\"label\":\"A\",\"variant\":\"default\"},{\"type\":\"button\",\"label\":\"B\",\"variant\":\"outline\"}]}]}}",
      "```",
      "- **EXEMPLO VÁLIDO COM 2 NÍVEIS**:",
      "```json",
      "{\"component\":\"chatUi\",\"props\":{\"children\":[{\"type\":\"div\",\"className\":\"flex flex-col gap-2\",\"children\":[{\"type\":\"div\",\"className\":\"flex flex-row gap-2\",\"children\":[{\"type\":\"button\",\"label\":\"Salvar\",\"variant\":\"default\"},{\"type\":\"button\",\"label\":\"Cancelar\",\"variant\":\"ghost\"}]}]}]}}",
      "```",
      "- Prefira um componente quando tabelas, métricas, etapas, fontes ou um destaque visual comunicarem melhor do que texto corrido.",
      "- Use no máximo dois blocos por resposta e não repita no texto os mesmos dados exibidos no componente.",
      "- Use `sourceList` somente com URLs reais que você já consultou.",
      "- Nunca invente dados apenas para preencher um componente. Se faltar informação, responda em texto ou faça uma pergunta curta.",
      "- Se Markdown simples resolver bem, não use um componente.",
    ].join("\n"),
}
