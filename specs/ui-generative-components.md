# Spectral AI — Generative UI (Passo 8)

Referência técnica da camada de componentes dinâmicos que a IA pode renderizar
dentro da conversa. A UI é **dado**: `renderUi` apenas mostra conteúdo. Efeitos
na aplicação usam `runAction` e estão documentados em
[`specs/ai-interaction-model.md`](./ai-interaction-model.md).

## Visão geral

O modelo chama a tool `renderUi` com um componente permitido e um objeto de
`props`. O backend valida a chamada com Zod, devolve um payload versionado e o
frontend renderiza o componente dentro da mensagem do assistente.

```
Modelo -> tool renderUi -> output { uiVersion, component, props }
      -> Message.parts (jsonb) -> RenderUiPart -> registry -> componente React
```

## Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `lib/ai/ui/catalog.ts` | Fonte única dos schemas, nomes, descrições, versão do catálogo e `RENDER_UI_TOOL_NAME`. |
| `lib/ai/tools/render-ui.ts` | Definição da tool `renderUi` e do output versionado. |
| `lib/ai/tools/index.ts` | Registro de `renderUi` e `runAction` em `getChatTools()`. |
| `lib/ai/actions/catalog.ts` | Schemas e tipos das ações usadas pelos botões de `panel`. |
| `lib/ai/prompts/sections/ui-and-actions.ts` | Instruções do system prompt sobre UI e ações. |
| `components/ai-ui/*` | Implementações visuais dos componentes permitidos. |
| `components/ai-ui/panel.tsx` | `panel` e primitivos `text`, `button`, `div`; `ChatUi` é alias depreciado. |
| `components/ai-ui/action-context.tsx` | Contexto que executa as ações dos botões. |
| `components/ai-ui/registry.tsx` | Registro `UiComponentName -> componente` e renderer type-safe. |
| `components/ai-ui/render-ui-part.tsx` | Identificação da tool part, validação, normalização e estados loading/waiting/success/error. |
| `components/chat/chat.tsx` | Roteia tool parts: `renderUi` usa o renderer; `runAction` executa via handler. |
| `app/styleguide/generative-ui-gallery.tsx` | Fixtures visuais dos componentes e estados. |

## Componentes permitidos (`UI_CATALOG_VERSION = 2`)

| Nome | Uso |
| --- | --- |
| `callout` | Destaque curto: conclusão, aviso, alerta ou confirmação (`info`, `success`, `warning`, `danger`). |
| `infoCard` | Cartão com título, subtítulo, descrição e pares rótulo/valor. |
| `statGrid` | Grade de 2 a 6 métricas com rótulo, valor e dica opcional. |
| `dataTable` | Tabela com até 6 colunas e 30 linhas. |
| `timeline` | Etapas ordenadas com status `done`, `current` ou `pending`. |
| `sourceList` | Fontes reais com título, URL `http(s)` e trecho opcional. |
| `panel` | Layout customizado com primitivos `text`, `button` e `div`, e ações tipadas em botões. |

Os limites de tamanho de cada campo estão nos schemas Zod de
`lib/ai/ui/catalog.ts` e são aplicados tanto na chamada da tool quanto na
renderização do histórico.

## `panel` e primitivos

O `panel` substitui o antigo `chatUi` no catálogo novo.

- `text`: `value`, `variant` (`h1`, `h2`, `p`, `span`, `muted`, `caption`) e
  `weight` (`normal`, `medium`, `semibold`, `bold`).
- `button`: `label`, `variant` (`default`, `outline`, `secondary`, `ghost`) e
  `action` opcional.
- `div`: `className` e `children`.

Regras:

- No máximo 2 níveis de `div` (`div > div`). `div > div > div` é rejeitado.
- Um `div` de nível 2 só pode conter `text` ou `button`.
- Um `div` de nível 1 pode conter `text`, `button` ou `div` de nível 2.
- O layout usa `className` com classes utilitárias (`flex`, `gap`, `items-*`).
- Sem recursão: os schemas são explícitos por nível.
- Sem `component` dentro de `panel`.

As ações de botão são validadas por `appActionSchema` e podem ser:
`sendMessage`, `openSettings`, `toast`, `setTheme`, `navigate` e `copy`.
`sendMessage` é exclusivo de botões e nunca é aceito pela tool `runAction`.

## Contrato da tool

Entrada (`renderUiInputSchema`):

```ts
{
  component:
    | "callout"
    | "infoCard"
    | "statGrid"
    | "dataTable"
    | "timeline"
    | "sourceList"
    | "panel"
  props: { ... }
}
```

Saída (`renderUiOutputSchema`):

```ts
{
  uiVersion: number
  component: string
  props: object
}
```

`uiVersion` é gravado no output para permitir compatibilidade futura. O
renderer aceita versões iguais ou anteriores a `UI_CATALOG_VERSION`; versões
mais novas exibem fallback de erro. Payloads inválidos nunca são renderizados.

## Compatibilidade de histórico

`renderUiHistorySchema` aceita o componente legado `chatUi` além de `panel`.
`normalizeRenderUiOutput` converte:

- `chatUi` → `panel`;
- ações string (`"confirmar"`) → `{ type: "sendMessage", text: label }`;
- ações estruturadas são preservadas.

Isso garante que conversas antigas continuem renderizando sem migração de
banco. A tool nova não aceita mais `chatUi`.

## Identificação das chamadas

A identificação é feita pelo nome da tool:

```ts
getToolName(part) === RENDER_UI_TOOL_NAME
```

`RENDER_UI_TOOL_NAME` fica em `lib/ai/ui/catalog.ts` e é usado tanto no registro
da tool quanto no roteamento do chat, evitando strings duplicadas.

## Estados do renderer

| Estado da tool part | UI |
| --- | --- |
| `input-streaming` / sem input | `loading` — skeleton com “Gerando visualização...”. |
| `input-available`, `approval-requested`, `approval-responded` | `waiting` — valida o input e mostra preview reduzido com indicador. |
| `output-available` | `success` — valida o output, checa `uiVersion` e renderiza. |
| `output-error` / `output-denied` | `error` — card de erro com a mensagem da tool. |
| input/output inválido, componente desconhecido ou versão futura | `error` — fallback seguro. |

## Persistência e histórico

Não há tabela nova nem migração. As tool parts completas (`input`, `output`,
`uiVersion`) já são gravadas em `Message.parts` (jsonb) em
`lib/ai/chat-service.ts` / `app/api/chat/route.ts`. Ao abrir um chat existente,
`GET /api/chats/[id]` devolve as partes e o renderer revalida tudo em runtime.

Consequências:

- A interface é reconstruída mesmo após recarregar a página.
- Mudanças futuras de schema não quebram o histórico: payload inválido vira
  fallback de erro ou é normalizado quando há compatibilidade.
- Nenhum HTML arbitrário é armazenado ou renderizado.

## Prompt

A seção `ui-and-actions` (`lib/ai/prompts/sections/ui-and-actions.ts`) anuncia
o catálogo e as regras:

- no máximo dois blocos por resposta;
- não repetir em texto os mesmos dados exibidos no componente;
- `sourceList` apenas com URLs reais já consultadas;
- nunca inventar dados para preencher um componente;
- preferir Markdown quando ele resolver melhor;
- usar `panel` para layouts customizados e ações em botões;
- nunca pedir chaves de API no chat; abrir `openSettings` com `section: "byok"`.

Qualquer mudança nesse texto exige incremento de `SYSTEM_PROMPT_VERSION` em
`lib/ai/prompts/registry.ts` e registro no changelog. Versão atual: `7`.

## Como adicionar um componente

1. Adicionar o schema de props e a descrição em `lib/ai/ui/catalog.ts`.
2. Incluir o nome em `uiComponentNames` e no `renderUiInputSchema`.
3. Criar o componente em `components/ai-ui/`.
4. Registrar em `components/ai-ui/registry.tsx` (mapa e switch).
5. Atualizar `uiCatalogSummary`/prompt se a regra de uso mudar.
6. Incrementar `UI_CATALOG_VERSION` se o contrato mudar.
7. Se o texto do prompt mudar, incrementar `SYSTEM_PROMPT_VERSION`.
8. Adicionar uma fixture em `app/styleguide/generative-ui-gallery.tsx`.
9. Validar com `npm run lint`, `npm run typecheck` e `npm run test`.

## Segurança e limites

- Toda entrada e saída é validada com Zod no servidor e revalidada no cliente.
- URLs de `sourceList` aceitam apenas `http`/`https`.
- O registry é uma allowlist: componentes fora dele não são renderizados.
- O renderer não executa HTML, scripts ou conteúdo remoto.
- Ações de botão são validadas pelo catálogo de ações; navegação usa allowlist.
- O modelo não acessa dados além do que foi enviado na conversa ou obtido via
  `fetchUrl`.

## Teste manual

1. Configure uma chave BYOK e envie um pedido que gere tabela, métricas ou fontes.
2. Confirme que o bloco aparece dentro da resposta sem duplicar o texto.
3. Peça um `panel` com botões; confirme que a ação é executada.
4. Recarregue a página e abra o chat pelo histórico; a UI deve reaparecer.
5. Abra `/styleguide#generative-ui` para validar visual e estados.

## Futuro

- Ações determinísticas a partir do clique, sem depender de uma nova resposta do modelo.
- Confirmação explícita para ações sensíveis (ex.: `navigate` iniciado pela IA).
- Estado interativo tipado e versionado, sem reintroduzir o antigo `chatState`.
