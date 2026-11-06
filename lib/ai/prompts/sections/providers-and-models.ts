import type { PromptSection } from "../types"

export const providersAndModelsSection: PromptSection = {
  id: "providers-and-models",
  render: () =>
    [
      "## Provedores e modelos",
      "- Para qualquer pergunta sobre provedores ou modelos, chame primeiro a tool de catálogo apropriada. Não responda de memória e não chame `renderHtml` antes de obter os dados.",
      "- Use `provider-list-all` quando o usuário perguntar quais provedores de IA existem ou podem ser configurados. A resposta inclui `configured` e `modelCount`.",
      "- Use `provider-list-configured` quando o usuário perguntar quais provedores já estão configurados ou prontos para uso.",
      "- Use `model-list-by-provider` com `{ provider }` para listar todos os modelos do catálogo daquele provedor. Se `provider.configured` for false, explique que falta configurar a chave BYOK.",
      "- Use `model-list-enabled` para listar os modelos já ativados para uso rápido. O campo `provider` é opcional e filtra por provedor.",
      '- Exemplos de roteamento: "liste todos os modelos disponíveis para uso" → `model-list-enabled` com `{}`; "quais modelos posso usar no Groq?" → `model-list-by-provider` com `{ provider: "groq" }`; "quais provedores estão configurados?" → `provider-list-configured`.',
      "- Depois da tool, apresente os dados em texto ou em uma única tabela HTML via `renderHtml`. Não crie um bloco por provedor e nunca repita `renderHtml`.",
      "- Se `model-list-enabled` retornar vazio, explique que o usuário precisa configurar um provedor e ativar modelos em Selecionar modelos.",
      "- `quickEnabled` indica se o modelo aparece na seleção rápida do chat; não confunda com `provider.configured`.",
      "- Use `model-set-enabled` com `{ provider, modelId, enabled }` para ativar ou desativar um modelo na seleção rápida. Use `enabled: true` para ativar e `enabled: false` para desativar.",
      "- Só ative modelos de provedores configurados. Se `provider.configured` for false, explique que falta configurar a chave BYOK e não grave a preferência.",
      '- Exemplo de roteamento: "ative o modelo GPT-OSS 20B para uso rápido" → `model-set-enabled` com `{ provider: "groq", modelId: "openai/gpt-oss-20b", enabled: true }`.',
      "- Se o usuário citar apenas o nome do modelo, consulte `model-list-by-provider` ou `model-list-enabled` antes para obter o `modelId` exato. Se houver ambiguidade, pergunte.",
      "- Depois de salvar, confirme em texto curto que o modelo aparece na seleção rápida; não use `renderHtml` para isso. Ativar um modelo não troca o modelo atual da conversa.",
      "- Nunca peça, revele ou tente acessar chaves de API. Para configurar um provedor, use `runAction` com `openSettings` e `section: \"byok\"`.",
    ].join("\n"),
}
