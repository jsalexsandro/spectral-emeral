# Spectral AI — Modelo de interação

Referência do contrato entre o modelo, o chat e a aplicação. A regra central é:

> **UI é dado, ação é evento.**

- `renderHtml` mostra conteúdo sanitizado no chat.
- `runAction` executa efeitos na aplicação.
- `fetchUrl` busca dados externos.
- `updatePlan` mostra progresso.
- `sendMessage` é uma ação de botão e nunca é exposta à IA.

## Por que separar

O modelo anterior misturava apresentação e efeitos em `externUi` e permitia que a
IA alterasse a UI da aplicação sem um contrato claro. O modelo novo separa:

| Necessidade | Tool/ação | Onde executa |
| --- | --- | --- |
| Mostrar tabela, métricas, fontes ou layout | `renderHtml` | Renderer sanitizado no chat |
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

## Catálogo de ações (`ACTION_CATALOG_VERSION = 2`)

| Ação | Campos | Regras |
| --- | --- | --- |
| `toast` | `title`, `description?`, `variant?`, `duration?` | Título até 120; descrição até 500; duração 1–10s. |
| `setTheme` | `theme` | `light`, `dark` ou `system`. |
| `openSettings` | `section?` | `general`, `account`, `byok` ou `devices`. |
| `navigate` | `path` | Allowlist: `/app`, `/providers/select-model`, `/provider/{provider}/models`. |
| `copy` | `text` | Até 4.000 caracteres. |
| `sendMessage` | `text` | Até 500 caracteres; somente botões. |

`aiActionSchema` exclui `sendMessage`. `appActionSchema` inclui. O
`runActionOutputSchema` usa `aiActionSchema`, então um output forjado com
`sendMessage` é rejeitado.

## Botões de HTML

Botões renderizados por `renderHtml` usam `data-spectral-action` com um JSON
validado por `appActionSchema`. Ao clicar:

- o renderer valida a ação novamente no cliente;
- `sendMessage` chama `sendText` do chat;
- as demais ações vão para `AppActionsProvider`;
- `navigate` pede confirmação antes de navegar.

O `ChatActionProvider` também bloqueia `sendMessage` quando
`source === "tool"`, como defesa em profundidade.

## Widgets interativos (v2)

`renderHtml` aceita um `script` opcional. O HTML continua sanitizado e o script
roda em um iframe `sandbox="allow-scripts"` (sem `allow-same-origin`), com CSP
`default-src 'none'`.

O script não acessa o DOM do app. Ele só pode:

- `spectral.action(acao)` — a ação é enviada por `postMessage`, validada com
  `appActionSchema` e executada pelo `ActionRunner`;
- `spectral.open(url)` — abre `http(s)`/`mailto` no pai;
- `spectral.theme` / `spectral.onThemeChange(fn)` — lê o tema efetivo;
- `spectral.onReady(fn)` — espera o runtime.

Regras:

- ações que mudam a conversa ou a rota (`sendMessage`, `navigate`) só são
  aceitas com gesto do usuário (`navigator.userActivation`);
- há limite de 40 ações por widget e 12 por janela de 10s;
- `widget:ready` é obrigatório; sem ele em 4s o renderer mostra erro;
- `data-*` e `id` funcionam como ganchos locais dentro do iframe; scripts
  embutidos no HTML são movidos para o sandbox;
- outputs v1 continuam estáticos no DOM principal.

## `sendMessage`

`sendMessage` não é uma tool. Ele existe apenas como ação de botão para que o
usuário continue a conversa sem digitar. O modelo nunca deve gerar esse tipo
dentro de `runAction`; o schema e o provider impedem isso.

Exemplo:

```html
<button
  type="button"
  class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
  data-spectral-action='{"type":"openSettings","section":"byok"}'
>
  Abrir configurações
</button>
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

- Tool parts antigas de `renderUi` mostram um fallback curto no chat.
- O renderer antigo e o catálogo de componentes foram removidos.
- Ações já executadas não são reexecutadas ao abrir o histórico.
- Não há migração de banco nem mudança em `Message.parts`.

## Testes

- `lib/ai/actions/catalog.test.ts`: allowlist, `sendMessage`, defaults e output.
- `lib/ai/ui/html-policy.test.ts`: sanitização, ações, URLs e classes.
- `lib/ai/ui/html-classes.test.ts`: sincronização entre a allowlist e o safelist do Tailwind.
- `lib/ai/tools/render-html.test.ts`: sanitização e erro para HTML vazio.
- `lib/ai/tools/tool-schema.test.ts`: JSON Schema sem `$ref`, `renderHtml`
  registrado e execução de `runAction`.

Comandos: `npm run test`, `npm run typecheck`, `npm run lint`.

## Limitações e próximos passos

- O HTML usa um vocabulário fixo de classes Tailwind; novas classes exigem
  atualização da política e do safelist.
- Ações sensíveis iniciadas pela IA podem exigir confirmação explícita.
- O estado do widget vive no iframe e é perdido a cada re-render; persistência
  será avaliada no Passo 41, sem reintroduzir `chatState`.
- Um laço síncrono infinito no script ainda pode travar a aba; isolamento por
  Web Worker fica para uma fase futura.
