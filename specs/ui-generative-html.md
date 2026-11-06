# Spectral AI — Generative HTML

Referência técnica da UI generativa baseada em HTML sanitizado. A regra central
continua a mesma:

> **UI é dado, ação é evento.**

O modelo chama `renderHtml` para mostrar conteúdo. Efeitos continuam em
`runAction`. O HTML nunca executa JavaScript, formulários ou estilos inline.

## Fluxo

```
Modelo -> tool renderHtml (input validado por renderHtmlToolInputSchema)
       -> execute no servidor: sanitizeHtml(html)
       -> output { uiVersion, html, script? } persistido em Message.parts
       -> RenderHtmlPart valida o output e re-sanitiza no cliente
       -> v1: HTML renderizado no DOM principal
       -> v2: WidgetFrame monta iframe sandbox com srcdoc + runtime
       -> ações do widget passam por postMessage validado até o ActionRunner
```

O histórico usa `Message.parts` (jsonb), sem tabela adicional. Tool parts antigas
de `renderUi` mostram um fallback curto; o renderer e o catálogo antigos foram
removidos.

## Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `lib/ai/ui/html-policy.ts` | Versão, schemas, allowlist de tags/atributos/classes, ações e URLs. |
| `lib/ai/ui/html-sanitize.ts` | Sanitização DOMPurify e hooks de validação. |
| `lib/ai/tools/render-html.ts` | Definição da tool `renderHtml` e output versionado. |
| `lib/ai/tools/index.ts` | Registro de `renderHtml` e `runAction` em `getChatTools()`. |
| `lib/ai/ui/widget-protocol.ts` | Protocolo `postMessage`, nonce, limites e schemas das mensagens. |
| `lib/ai/ui/widget-runtime.ts` | Runtime confiável injetado no iframe (`window.spectral`). |
| `lib/ai/ui/widget-srcdoc.ts` | Monta o `srcdoc` com CSP, CSS do app e scripts escapados. |
| `lib/ai/prompts/sections/ui-and-actions.ts` | Contrato de HTML, widgets e ações enviado ao modelo. |
| `lib/ai/agents/spectral-agent.ts` | Limite de chamadas e stop condition. |
| `components/ai-ui/render-html-part.tsx` | Renderer, estados e delegação de cliques (v1). |
| `components/ai-ui/widget-frame.tsx` | Iframe sandbox, bridge de mensagens, tema e altura (v2). |
| `components/chat/chat.tsx` | Roteia tool parts e mostra fallback para `renderUi` legado. |
| `app/styleguide/generative-html-gallery.tsx` | Fixtures visuais e exemplos de XSS. |
| `app/globals.css` | Safelist Tailwind via `@source inline(...)`. |

## Contrato

Entrada (`renderHtmlToolInputSchema`):

```ts
{
  html: string // 1..20.000 caracteres, fragmento HTML
  script?: string // 1..12.000 caracteres, JavaScript do widget (v2)
}
```

A entrada também aceita uma string pura ou um bloco Markdown com fence `html`;
`normalizeHtmlInput` remove o fence antes da validação.

Saída (`renderHtmlOutputSchema`):

```ts
{
  uiVersion: number // atualmente 2
  html: string // HTML já sanitizado
  script?: string // presente apenas em widgets interativos
}
```

Constantes:

- `HTML_UI_VERSION = 2`
- `MAX_HTML_LENGTH = 20_000`
- `MAX_SCRIPT_LENGTH = 12_000`
- `MAX_ACTION_ATTRIBUTE_LENGTH = 2_000`
- `RENDER_HTML_TOOL_NAME = "renderHtml"`
- `LEGACY_RENDER_UI_TOOL_NAME = "renderUi"`

## Tags e atributos

Tags permitidas:

`a`, `blockquote`, `br`, `button`, `code`, `details`, `div`, `em`, `h1`–`h4`,
`hr`, `input`, `label`, `li`, `ol`, `option`, `p`, `pre`, `progress`, `select`,
`span`, `strong`, `summary`, `table`, `tbody`, `td`, `textarea`, `th`, `thead`,
`tr`, `ul`.

Atributos permitidos:

`class`, `title`, `role`, `aria-label`, `aria-labelledby`, `aria-describedby`,
`aria-hidden`, `aria-live`, `aria-current`, `aria-expanded`, `aria-controls`,
`href`, `target`, `rel`, `type`, `disabled`, `colspan`, `rowspan`, `scope`,
`start`, `value`, `checked`, `selected`, `placeholder`, `min`, `max`, `step`,
`rows`, `cols`, `multiple`, `readonly`, `required`, `maxlength`, `minlength`,
`inputmode`, `open`, `data-spectral-action`.

Tags perigosas são removidas explicitamente: `script`, `style`, `iframe`, `form`,
`svg`, `math`, `canvas`, `video`, `audio`, `object`, `embed`, `link`, `meta`,
`base`, `source`, `track`.

## Sanitização

`lib/ai/ui/html-sanitize.ts` configura DOMPurify com:

- `ALLOWED_TAGS` e `ALLOWED_ATTR` da política;
- `ALLOW_ARIA_ATTR: true` e `ALLOW_DATA_ATTR: true`, com um hook que remove
  `data-*` desconhecido e `aria-*` fora da allowlist no HTML estático;
- `FORBID_TAGS` para as tags perigosas;
- `FORBID_ATTR: ["id", "style"]` no HTML estático.

Em modo widget (`sanitizeHtml(html, { widget: true })`), usado quando existe
`script`, a política relaxa apenas o necessário para a interatividade:

- `data-*` com nome seguro (`^data-[a-z0-9-]+$`) é preservado;
- `id`, `for` e `name` são permitidos (ganchos de script, labels e grupos de
  inputs);
- `style` continua proibido;
- `data-spectral-action` continua validado por `appActionSchema`.

Como o widget roda em origem opaca, esses atributos ficam restritos ao iframe e
não alcançam o DOM do app.

O hook `afterSanitizeAttributes` também:

- filtra classes com `sanitizeHtmlClassList`;
- valida `data-spectral-action` com `appActionSchema`;
- remove a ação de elementos que não sejam `button` ou `a`;
- força `type="button"` em botões;
- força `type="text"` em `input` cujo `type` não esteja em
  `HTML_UI_INPUT_TYPES` (`checkbox`, `date`, `number`, `radio`, `range`,
  `search`, `text`, `time`);
- valida `href` com `isAllowedHtmlUri` (somente `http:`, `https:` e `mailto:`);
- adiciona `rel="noopener noreferrer"` em links com `target="_blank"`.

O servidor sanitiza no `execute` da tool. O cliente re-sanitiza no
`RenderHtmlPart` antes de usar `dangerouslySetInnerHTML`.

## Classes Tailwind

O vocabulário fica em `HTML_UI_CLASSES` e é enviado no system prompt. O mesmo
conjunto é declarado em `app/globals.css` com `@source inline(...)` para o
Tailwind gerar as classes usadas dinamicamente.

O teste `lib/ai/ui/html-classes.test.ts` falha se a allowlist e o safelist
ficarem dessincronizados.

Para adicionar uma classe:

1. Adicione em `HTML_UI_CLASSES` (normalmente no grupo adequado de
   `lib/ai/ui/html-policy.ts`).
2. Atualize o `@source inline(...)` em `app/globals.css`.
3. Rode `npm run test` e `npm run typecheck`.

Evite classes de posicionamento/overlay (`fixed`, `sticky`, `absolute`, `z-*`,
`inset-*`, `w-screen`, `h-screen`).

## Botões e ações

Todo botão deve ter `type="button"` e uma ação JSON em
`data-spectral-action`:

```html
<button
  type="button"
  class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
  data-spectral-action='{"type":"openSettings","section":"byok"}'
>
  Abrir BYOK
</button>
```

Ações aceitas por `appActionSchema`:

- `sendMessage` — apenas em botões;
- `openSettings` — `general`, `account`, `byok` ou `devices`;
- `toast`;
- `setTheme`;
- `navigate` — allowlist de rotas;
- `copy`.

O clique é delegado no container do renderer. A ação é revalidada no cliente e
executada com `source: "user"`. `navigate` pede confirmação. O
`ChatActionProvider` continua bloqueando `sendMessage` com `source: "tool"`.

No HTML estático, todo botão que dispara ação deve ter `type="button"` e
`data-spectral-action`. Em widgets v2, botões que só alteram estado local não
precisam de ação; o script pode consultá-los por `data-*` ou `id`.

## Widgets dinâmicos (v2)

Quando o output tem `uiVersion >= 2` e `script`, o `RenderHtmlPart` delega para
`WidgetFrame`:

```
iframe sandbox="allow-scripts"   (sem allow-same-origin)
  srcdoc:
    <meta CSP default-src 'none'; style-src/script-src 'unsafe-inline'>
    <style>{CSS compilado do app}</style>
    {html sanitizado}
    <script>{runtime confiável}</script>
    <script>{script do modelo, com </script> escapado}</script>
```

O `execute` da tool também aceita o formato de documento único: se o modelo
enviar `<script>` dentro de `html`, os blocos clássicos são extraídos para o
campo `script` e o HTML segue sem eles. Scripts com `src` externo, `type`
não-clássico ou módulos são descartados.

Dentro do widget, use `data-*` (por exemplo `data-count`) ou `id` como ganchos
para o JavaScript. Esses atributos são preservados somente no modo widget; no
HTML estático continuam removidos.

O CSS é serializado uma vez por sessão a partir de `document.styleSheets`, então
as classes Tailwind da allowlist continuam funcionando. As variáveis de tema
(`:root`/`.dark`) também são copiadas; o pai alterna o tema do iframe via
`postMessage`, sem recarregar o widget.

### Protocolo

`WIDGET_PROTOCOL_VERSION = 1`. Toda mensagem carrega `protocol` e um `nonce`
gerado por instância. O pai valida `event.source === iframe.contentWindow`
(obrigatório porque a origem do sandbox é opaca) e o `nonce` antes de qualquer
efeito.

Filho → pai:

- `widget:ready`;
- `widget:resize` — `height`, limitado a 32–2.000 px;
- `widget:action` — `requestId`, `action` (`appActionSchema`) e
  `userInitiated`;
- `widget:open` — `url` `http(s)`/`mailto`, aberta no pai com
  `noopener noreferrer`.

Pai → filho:

- `widget:theme` — `light` ou `dark`.

### API do modelo

Dentro do iframe o modelo só tem `window.spectral`:

- `spectral.action(acao)` — dispara uma ação do catálogo;
- `spectral.open(url)` — abre link fora do sandbox;
- `spectral.theme` — `"light"` ou `"dark"` (getter);
- `spectral.onThemeChange(fn)` — reage à troca de tema;
- `spectral.onReady(fn)` — executa quando o runtime está pronto.

### Segurança

- `allow-same-origin` nunca é usado: sem cookies, storage ou DOM do app.
- CSP `default-src 'none'` bloqueia `fetch`, WebSocket, imagens e fontes
  externas.
- Sem `allow-top-navigation`, `allow-popups` ou `allow-forms`.
- Ações mudam a conversa/rota apenas com gesto do usuário
  (`navigator.userActivation`); `sendMessage` e `navigate` são recusadas sem
  gesto.
- Limites por widget: 40 ações por sessão e 12 ações a cada 10 segundos.
- Se o iframe não enviar `widget:ready` em 4 segundos, o renderer mostra erro.

## Limites

- HTML máximo de 20.000 caracteres.
- Script máximo de 12.000 caracteres.
- No máximo 2 chamadas de `renderHtml` por resposta; prefira uma.
- Depois do último `renderHtml`, a resposta deve terminar com uma frase curta.
- Não repetir no texto os mesmos dados exibidos no HTML.
- Não inventar dados nem URLs.

## Compatibilidade

- Outputs v1 (sem `script`) continuam renderizando no DOM principal como antes.
- O output antigo de `renderUi` não é re-renderizado.
- `components/chat/chat.tsx` mostra um fallback curto para tool parts antigas.
- Não há migração de banco: `script` fica em `Message.parts`.

## Testes

- `lib/ai/ui/html-policy.test.ts`
- `lib/ai/ui/html-classes.test.ts`
- `lib/ai/ui/widget-protocol.test.ts`
- `lib/ai/ui/widget-srcdoc.test.ts`
- `lib/ai/tools/render-html.test.ts`
- `lib/ai/tools/tool-schema.test.ts`
- `lib/ai/agents/spectral-agent.test.ts`

Comandos: `npm run test`, `npm run typecheck`, `npm run lint`.

## Limitações

- Sem `<img>`; imagens externas podem ser avaliadas depois com allowlist de
  URLs.
- O estado do widget vive só no iframe: um re-render recria o widget. Estado
  persistente será tratado no Passo 41.
- Um laço síncrono infinito no script ainda pode travar a aba; o timeout cobre
  apenas a inicialização. Isolamento real exigiria um Web Worker.
- O vocabulário de classes é fechado e exige atualização manual.
