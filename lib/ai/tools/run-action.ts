import { tool } from "ai"
import { aiActionSchema } from "@/lib/ai/actions/catalog"

const description = [
  "Executa uma ação na aplicação Spectral. Use apenas para efeitos na interface, nunca para responder ou mostrar conteúdo.",
  "Ações permitidas:",
  "  - `toast`: notificação curta com title, description opcional, variant (default, success, warning, error, info) e duration opcional.",
  "  - `setTheme`: altera o tema para light, dark ou system.",
  "  - `openSettings`: abre as configurações na seção general, account ou byok. Nunca peça chaves de API no chat; abra a seção byok e instrua o usuário a colar a chave no formulário.",
  "  - `navigate`: navega para /app, /providers/select-model ou /provider/{provider}/models. Use apenas quando a tarefa estiver concluída.",
  "  - `copy`: copia um texto curto para a área de transferência.",
  "Não use `runAction` para exibir dados; use `renderUi`. Não use para marcar progresso; use `updatePlan`.",
].join("\n")

export const runActionTool = tool({
  description,
  inputSchema: aiActionSchema,
  execute: async (action) => ({
    ok: true as const,
    action,
  }),
})
