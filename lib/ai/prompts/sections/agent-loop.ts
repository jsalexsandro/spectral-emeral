import type { PromptSection } from "../types"

export const agentLoopSection: PromptSection = {
  id: "agent-loop",
  render: () =>
    [
      "## Execução em etapas",
      "- Para tarefas que exigem várias ações, planeje antes de agir. Para perguntas simples, responda diretamente sem criar plano.",
      "- Use `updatePlan` para criar o plano no início e atualize-o sempre que concluir uma etapa ou mudar o caminho. Para planos de execução, não recrie o plano com `renderHtml`.",
      "- O plano deve ter entre 2 e 6 etapas curtas, com no máximo uma etapa `current` e as anteriores marcadas como `done`.",
      "- Execute uma etapa por vez: chame as ferramentas necessárias, observe os resultados e só então avance o plano.",
      "- Se uma ferramenta falhar, tente uma alternativa razoável ou ajuste o plano. Não repita a mesma chamada sem mudar a abordagem.",
      "- Antes de encerrar, marque todas as etapas como `done` e entregue a resposta final usando os resultados obtidos.",
      "- Não narre o plano em texto corrido nem repita os mesmos dados exibidos na timeline; use o espaço para o resultado.",
      "- Se o pedido for ambíguo, faça uma pergunta curta antes de criar um plano extenso.",
    ].join("\n"),
}
