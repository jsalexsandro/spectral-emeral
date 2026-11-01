import { tool } from "ai"
import { externUiInputSchema } from "@/lib/ai/ui/extern-catalog"

const description = [
  "Executa ações na interface da aplicação (fora do chat).",
  "Use apenas quando necessário para dar feedback imediato ao usuário.",
  "Componentes externos permitidos:",
  "  - `toast`: Exibe uma notificação toast na aplicação.",
].join("\n")

export const externUiTool = tool({
  description,
  inputSchema: externUiInputSchema,
  execute: async (input) => ({
    ok: true,
    component: input.component,
    props: input.props,
  }),
})
