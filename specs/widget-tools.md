# Widget Tool Registry (futuro)

Status: **planejado**. Hoje os widgets só executam ações do catálogo
(`appActionSchema`). Este documento define como expor tools novas a widgets no
futuro sem abrir execução arbitrária. No roadmap, corresponde ao
[Passo 42](./eco-system.md#passo-42-futuro-registry-de-tools-para-widgets).

Referências relacionadas:

- [`specs/ui-generative-html.md`](./ui-generative-html.md) — widgets v2 e bridge
- [`specs/ai-interaction-model.md`](./ai-interaction-model.md) — catálogo de ações
- [`specs/chat-device.md`](./chat-device.md) — tools de dispositivo

## Objetivo

Permitir que um widget chame tools internas — inclusive tools que ainda serão
criadas — com:

- opt-in explícito por tool;
- default-deny;
- gesto do usuário;
- confirmação no host para tools sensíveis;
- validação de input/output no servidor;
- rate limit e auditoria.

O widget nunca recebe a autoridade do modelo nem executa código no host. Ele
apenas envia uma intenção; o host decide.

## Estado atual

- `spectral.action(acao)` aceita apenas `appActionSchema`.
- `toast`, `setTheme`, `openSettings`, `navigate`, `copy`, `sendMessage` e
  `openDeviceApp` já funcionam.
- Tools de servidor (`device-run-command`, `device-write-file`,
  `device-edit-file`, `device-press-key`) **não** são acessíveis ao script.
- Cada nova ação exige alteração no catálogo, no `ActionRunner` e, se precisar
  de servidor, em uma rota dedicada.

O `openDeviceApp` é o primeiro caso de uma tool tipada com execução no host.
Ele pode ser migrado para o registry sem quebrar os widgets existentes.

## Contrato proposto

### Definição da tool

```ts
type WidgetToolExposure = {
  enabled: boolean
  requiresGesture: boolean
  requiresConfirmation: boolean
  rateLimit: { max: number; windowMs: number }
}

type WidgetToolDefinition = {
  name: string
  inputSchema: z.ZodType
  outputSchema: z.ZodType
  exposure: WidgetToolExposure
}
```

Regras:

- `exposure.enabled` é `false` por padrão;
- `requiresGesture` é `true` por padrão;
- tools de escrita, teclado, shell e arquivos exigem `requiresConfirmation`;
- o servidor mantém a lista real de tools habilitadas; o cliente não decide
  sozinho o que pode executar.

### API do widget

```js
const result = await spectral.tool("device.listApps", { deviceId })
```

Formato do retorno:

```ts
type WidgetToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; code?: string }
```

Para manter compatibilidade, `spectral.action(acao)` continua existindo. O
`spectral.tool` é a evolução para tools que não são apenas efeitos de UI.

### Fluxo

1. O widget chama `spectral.tool(name, input)`.
2. O runtime valida o formato, o limite de tamanho e envia `widget:tool` com
   `requestId` e `userInitiated`.
3. O `WidgetFrame` valida `event.source`, nonce, gesto e rate limit.
4. O host consulta o registry e recusa tools desconhecidas ou desabilitadas.
5. Se `requiresConfirmation`, o host mostra um modal **fora do iframe** com o
   nome da tool e os argumentos.
6. O host chama `POST /api/widget-tools` com `{ name, input }`.
7. O servidor valida sessão, registry, schema de entrada, ownership e rate
   limit, executa a tool e audita a chamada.
8. O output é validado, limitado em tamanho e devolvido ao widget como
   `widget:tool-result`.

O iframe nunca fala com o servidor diretamente e nunca recebe cookies, chaves ou
stack traces.

## Tiers de permissão

| Tier | Exemplos | Regra |
| --- | --- | --- |
| Seguro / leitura | listar devices, listar apps, get OS | Gesto, sem confirmação |
| Sensível | abrir app, abrir URL, digitar texto, pressionar tecla | Gesto + confirmação no host |
| Crítico | `run-command`, `write-file`, `edit-file` | Confirmação forte, argumentos visíveis e auditoria; pode continuar fora do widget |
| Nunca | segredos, chaves, auth, dados internos | Bloqueado |

A confirmação deve mostrar o que será executado. Para `run-command`, mostrar o
comando, o `cwd` e o timeout. Para `write-file`, mostrar caminho e tamanho, sem
despejar o conteúdo inteiro no modal.

## Tools novas

Com o registry:

- a tool nova é registrada no servidor;
- se declarar `exposure.enabled = true`, **novos widgets** já podem chamá-la;
- por padrão ela nasce desabilitada para widgets;
- o modelo só precisa conhecer a tool (system prompt/tool list) para gerar o
  widget usando o nome correto.

Widgets antigos não passam a usar tools novas sozinhos, porque o script deles é
estático. Para isso existiria um `spectral.tools.list()` + renderização
dinâmica, mas isso aumenta a superfície e fica como fase opcional.

## Endpoint

Recomendação: um endpoint único com despacho pelo registry.

```txt
POST /api/widget-tools
{ "name": "device.openApp", "input": { "deviceId": "...", "appId": "chrome" } }
```

Por que não uma rota por tool:

- tools novas não exigem deploy de rota nova;
- o servidor mantém uma allowlist central;
- o rate limit e a auditoria ficam em um lugar só;
- o cliente não consegue inventar endpoints.

O servidor nunca deve aceitar um nome de tool que não esteja no registry
habilitado para widgets.

## Estrutura sugerida

```txt
lib/widget-tools/
  registry.ts        # metadados compartilhados (nome, schemas, exposure)
  handlers.server.ts # execução real das tools (server-only)
  errors.ts          # códigos e mensagens estáveis
app/api/widget-tools/route.ts
lib/ai/ui/widget-protocol.ts   # mensagens widget:tool e widget:tool-result
lib/ai/ui/widget-runtime.ts    # spectral.tool + pending requests
```

## Plano de migração

1. Adicionar retorno de resultado à bridge (`widget:action-result` /
   `widget:tool-result`) para permitir `await spectral.tool(...)` e feedback
   inline no widget.
2. Criar o registry compartilhado com `exposure` default-deny.
3. Adicionar `POST /api/widget-tools` com auth, schema, rate limit e auditoria.
4. Migrar `openDeviceApp` para uma definição `device.openApp`, mantendo a ação
   antiga por compatibilidade.
5. Expor as primeiras tools de leitura (`device.onlineList`, `device.listApps`,
   `device.getOs`) com gesto e sem confirmação.
6. Adicionar modal de confirmação no host para tools sensíveis.
7. Atualizar o prompt para ensinar `spectral.tool(name, input)` e listar apenas
   as tools widget-safe.
8. Cobrir com testes: tool desconhecida, tool desabilitada, gesto ausente,
   confirmação recusada, input inválido, output grande e rate limit.
9. Documentar o catálogo de tools widget-safe neste arquivo.

## Não-objetivos

- Executar qualquer tool sem allowlist no servidor.
- Dar ao iframe acesso a cookies, storage, rede ou DOM do app.
- Expor `run-command`, `write-file` ou `edit-file` sem confirmação explícita.
- Retornar segredos, chaves, tokens ou stack traces ao widget.
- Disparar tools em background, em loop ou na carga do widget.

## Questões abertas

- Quais tools entram primeiro no registry?
- A confirmação será um modal global, um painel no chat ou um estado inline no
  widget?
- A auditoria fica em log, tabela própria ou ambos?
- Haverá escopos por usuário/dispositivo além do ownership atual?
- Tools longas precisam de streaming de progresso ou basta request/response?
- Vale a pena expor `spectral.tools.list()` para widgets dinâmicos?
