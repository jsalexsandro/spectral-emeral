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
       -> output { uiVersion, html } persistido em Message.parts
       -> RenderHtmlPart valida o output e re-sanitiza no cliente
       -> HTML renderizado no chat
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
| `lib/ai/prompts/sections/ui-and-actions.ts` | Contrato de HTML e ações enviado ao modelo. |
| `lib/ai/agents/spectral-agent.ts` | Limite de chamadas e stop condition. |
| `components/ai-ui/render-html-part.tsx` | Renderer, estados e delegação de cliques. |
| `components/chat/chat.tsx` | Roteia tool parts e mostra fallback para `renderUi` legado. |
| `app/styleguide/generative-html-gallery.tsx` | Fixtures visuais e exemplos de XSS. |
| `app/globals.css` | Safelist Tailwind via `@source inline(...)`. |

## Contrato

Entrada (`renderHtmlToolInputSchema`):

```ts
{
  html: string // 1..20.000 caracteres, fragmento HTML
}
```

A entrada também aceita uma string pura ou um bloco Markdown com fence `html`;
`normalizeHtmlInput` remove o fence antes da validação.

Saída (`renderHtmlOutputSchema`):

```ts
{
  uiVersion: number // atualmente 1
  html: string // HTML já sanitizado
}
```

Constantes:

- `HTML_UI_VERSION = 1`
- `MAX_HTML_LENGTH = 20_000`
- `MAX_ACTION_ATTRIBUTE_LENGTH = 2_000`
- `RENDER_HTML_TOOL_NAME = "renderHtml"`
- `LEGACY_RENDER_UI_TOOL_NAME = "renderUi"`

## Tags e atributos

Tags permitidas:

`a`, `blockquote`, `br`, `button`, `code`, `div`, `em`, `h1`–`h4`, `hr`, `li`,
`ol`, `p`, `pre`, `span`, `strong`, `table`, `tbody`, `td`, `th`, `thead`, `tr`,
`ul`.

Atributos permitidos:

`class`, `title`, `role`, `aria-label`, `aria-labelledby`, `aria-describedby`,
`aria-hidden`, `aria-live`, `aria-current`, `aria-expanded`, `aria-controls`,
`href`, `target`, `rel`, `type`, `disabled`, `colspan`, `rowspan`, `scope`,
`start`, `data-spectral-action`.

Tags perigosas são removidas explicitamente: `script`, `style`, `iframe`, `form`,
`input`, `textarea`, `select`, `svg`, `math`, `canvas`, `video`, `audio`,
`object`, `embed`, `link`, `meta`, `base`, `source`, `track`.

## Sanitização

`lib/ai/ui/html-sanitize.ts` configura DOMPurify com:

- `ALLOWED_TAGS` e `ALLOWED_ATTR` da política;
- `ALLOW_ARIA_ATTR: true` e `ALLOW_DATA_ATTR: true`, com um hook que remove
  `data-*` desconhecido e `aria-*` fora da allowlist;
- `FORBID_TAGS` para as tags perigosas;
- `FORBID_ATTR: ["id", "style"]`.

O hook `afterSanitizeAttributes` também:

- filtra classes com `sanitizeHtmlClassList`;
- valida `data-spectral-action` com `appActionSchema`;
- remove a ação de elementos que não sejam `button` ou `a`;
- força `type="button"` em botões;
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

## Limites

- HTML máximo de 20.000 caracteres.
- No máximo 2 chamadas de `renderHtml` por resposta; prefira uma.
- Depois do último `renderHtml`, a resposta deve terminar com uma frase curta.
- Não repetir no texto os mesmos dados exibidos no HTML.
- Não inventar dados nem URLs.

## Compatibilidade

- O output antigo de `renderUi` não é re-renderizado.
- `components/chat/chat.tsx` mostra um fallback curto para tool parts antigas.
- Não há migração de banco.

## Testes

- `lib/ai/ui/html-policy.test.ts`
- `lib/ai/ui/html-classes.test.ts`
- `lib/ai/tools/render-html.test.ts`
- `lib/ai/tools/tool-schema.test.ts`
- `lib/ai/agents/spectral-agent.test.ts`

Comandos: `npm run test`, `npm run typecheck`, `npm run lint`.

## Limitações

- Sem `<img>` na v1; imagens externas podem ser avaliadas depois com allowlist
  de URLs.
- Sem estado interativo no HTML; botões só disparam ações do catálogo.
- O vocabulário de classes é fechado e exige atualização manual.
