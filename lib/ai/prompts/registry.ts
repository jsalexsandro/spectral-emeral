export const SYSTEM_PROMPT_VERSION = 7

export type SystemPromptChange = {
  version: number
  date: string
  summary: string
}

export const systemPromptChangelog: readonly SystemPromptChange[] = [
  {
    version: 1,
    date: "2026-10-30",
    summary:
      "Prompt base inicial com identidade, estilo, capacidades, segurança e contexto do usuário.",
  },
  {
    version: 2,
    date: "2026-10-30",
    summary:
      "Anuncia a tool nativa fetchUrl e orienta uso responsável, citação da fonte e limites de rede.",
  },
  {
    version: 3,
    date: "2026-10-30",
    summary:
      "Anuncia a tool renderUi, o catálogo de componentes generativos e as regras de uso, citação e não duplicação de dados.",
  },
  {
    version: 4,
    date: "2026-10-30",
    summary:
      "Adiciona execução em etapas com a tool updatePlan, planejamento antes de tarefas multi-passo e replanejamento após falhas.",
  },
  {
    version: 5,
    date: "2026-10-30",
    summary:
      "Diferencia componentes específicos de componentes primitivos e orienta sua combinação para layouts customizados.",
  },
  {
    version: 6,
    date: "2026-11-01",
    summary:
      "Remove a tool chatState e o nó stateText, simplificando os primitivos para apenas text, button e div.",
  },
  {
    version: 7,
    date: "2026-11-01",
    summary:
      "Separa UI de ações: renderUi para conteúdo, runAction para efeitos, panel no lugar de chatUi e ações tipadas em botões.",
  },
]
