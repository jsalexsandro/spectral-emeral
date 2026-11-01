# Spectral AI — Modelo de interação

Referência do contrato entre o modelo, o chat e a aplicação. A regra central é:

> **UI é dado, ação é evento.**

- `renderUi` mostra conteúdo no chat.
- `runAction` executa efeitos na aplicação.
- `fetchUrl` busca dados externos.
- `updatePlan` mostra progresso.
- `sendMessage` é uma ação de botão e nunca é exposta à IA.

## Por que separar

O modelo anterior misturava apresentação e efeitos em `externUi` e permitia que a
IA alterasse a UI da aplicação sem um contrato claro. O modelo novo separa:

| Necessidade | Tool/ação | Onde executa |
| --- | --- | --- |
| Mostrar tabela, métricas, fontes ou layout | `renderUi` | Renderer no chat |
| Exibir notificação | `runAction` → `toast` | Cliente |
| Alterar tema | `runAction` → `setTheme` | Cliente |
| Abrir configurações | `runAction` → `openSettings` | Cliente |
| Navegar para uma rota permitida | `runAction` → `navigate` | Cliente |
| Copiar texto | `runAction` → `copy` | Cliente |
| Continuar a conversa a partir de um botão | `sendMessage` | Cliente, via chat |
| Buscar dados | `fetchUrl` | Servidor |
| Mostrar progresso | `updatePlan` | Chat |

## Fluxo de `runAction`

```
Modelo -> tool runAction (input validado por aiActionSchema)
       -> execute no servidor: { ok: true, action }
       -> output persistido em Message.parts
       -> AppActionHandler detecta output-available
       -> AppActionsProvider executa o efeito no cliente
```

O servidor **não executa** o efeito. Ele valida e devolve um comando. Isso evita
dependência de browser no route handler e evita upserts de mensagem durante o
streaming (o chat usa `onConflictDoNothing`).

O `AppActionHandler`:

- ignora mensagens que já existiam ao abrir o chat (`initialMessageIds`);
- deduplica por `toolCallId`;
- revalida o output com `runActionOutputSchema`;
- executa com `source: "tool"`.

## Catálogo de ações (`ACTION_CATALOG_VERSION = 1`)

| Ação | Campos | Regras |
| --- | --- | --- |
| `toast` | `title`, `description?`, `variant?`, `duration?` | Título até 120; descrição até 500; duração 1–10s. |
| `setTheme` | `theme` | `light`, `dark` ou `system`. |
| `openSettings` | `section?` | `general`, `account` ou `byok`. |
| `navigate` | `path` | Allowlist: `/app`, `/providers/select-model`, `/provider/{provider}/models`. |
| `copy` | `text` | Até 4.000 caracteres. |
| `sendMessage` | `text` | Até 500 caracteres; somente botões. |

`aiActionSchema` exclui `sendMessage`. `appActionSchema` inclui. O
`runActionOutputSchema` usa `aiActionSchema`, então um output forjado com
`sendMessage` é rejeitado.

## Botões de `panel`

Botões renderizados por `renderUi` usam `appActionSchema`. Ao clicar:

- `sendMessage` chama `sendText` do chat;
- as demais ações vão para `AppActionsProvider`.

O `ChatActionProvider` também bloqueia `sendMessage` quando
`source === "tool"`, como defesa em profundidade.

## `sendMessage`

`sendMessage` não é uma tool. Ele existe apenas como ação de botão para que o
usuário continue a conversa sem digitar. O modelo nunca deve gerar esse tipo
dentro de `runAction`; o schema e o provider impedem isso.

Exemplo:

```json
{
  "component": "panel",
  "props": {
    "children": [
      {
        "type": "button",
        "label": "Abrir configurações",
        "action": { "type": "openSettings", "section": "byok" }
      }
    ]
  }
}
```

## Provedores no cliente

`app/app/app-actions-provider.tsx` implementa:

- `toast` com Sonner;
- `setTheme` com o `ThemeProvider` existente;
- `openSettings` controlando o `ConfigComponent`;
- `navigate` com `next/navigation` e allowlist;
- `copy` com `navigator.clipboard`;
- `sendMessage` recusado (deve passar pelo chat).

O `ConfigComponent` agora é controlado por `section` e `onSectionChange` e é
renderizado uma única vez no provider. A sidebar usa
`useAppActions().openSettings`.

`app/app/chat-action-provider.tsx` estende o runner com `sendMessage` e é
montado ao redor do chat.

## Segurança

- A IA nunca recebe chaves de API; `openSettings({ section: "byok" })` apenas
  abre o formulário.
- `navigate` usa allowlist, não URL arbitrária.
- `runAction` é validado no servidor e revalidado no cliente.
- `sendMessage` não existe no schema da IA.
- `externUi` foi removido; tool parts antigas são ignoradas.
- Ações continuam limitadas pelo que o catálogo permite.

## Compatibilidade e histórico

- `renderUi` mantém `renderUiHistorySchema` com `chatUi` legado.
- O output antigo é normalizado para `panel`.
- Ações string em botões antigos viram `sendMessage` com o label.
- Ações já executadas não são reexecutadas ao abrir o histórico.
- Não há migração de banco nem mudança em `Message.parts`.

## Testes

- `lib/ai/actions/catalog.test.ts`: allowlist, `sendMessage`, defaults e output.
- `lib/ai/ui/catalog.test.ts`: `panel`, limites de `div`, histórico e normalização.
- `lib/ai/tools/tool-schema.test.ts`: JSON Schema sem `$ref` e execução de
  `runAction`.

Comandos: `npm run test`, `npm run typecheck`, `npm run lint`.

## Limitações e próximos passos

- A execução de uma tool a partir do clique ainda depende do modelo; a Fase 2
  pode tornar isso determinístico.
- Ações sensíveis iniciadas pela IA podem exigir confirmação explícita.
- Estado interativo no chat será avaliado em um contrato novo, sem reintroduzir
  `chatState`.
