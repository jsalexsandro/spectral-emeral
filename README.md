# Spectral AI

Base visual e estrutural do painel SaaS do Spectral AI.

## Stack

- Next.js 16 (App Router, Cache Components e Partial Prefetching)
- React 19
- TypeScript
- Tailwind CSS 4 via Turbopack
- shadcn/ui com Base UI
- Geist Sans e Geist Mono

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Estrutura

- `app/` — rotas e layout global
- `app/styleguide/` — referência visual dos tokens e componentes
- `components/ui/` — primitivos do shadcn/ui
- `lib/` — utilitários compartilhados
- `specs/` — guia funcional do projeto em passos

## Design system

O tema **Spectral Emerald** usa branco e off-whites esverdeados como base, com esmeralda como cor de ação. Os tokens ficam em `app/globals.css`, e o tema claro/escuro/sistema é controlado em Configurações → Geral → Aparência.

## Backend (Passo 2)

- DrizzleORM configurado com PostgreSQL
- Schemas Auth.js: User, Account, Session, VerificationToken
- NextAuth.js v5 configurado em `/auth.ts` (Google, GitHub, Apple opcional e Credentials)
- Senhas com hash scrypt (`node:crypto`) na coluna `user.password`
- Rotas: `/api/auth/[...nextauth]`, `/api/auth/check-email`, `/api/auth/register`
- Páginas: `/login`, `/register`, `/app` (protegida) e `/platform` (redirect)
- Proteção central em `proxy.ts` + verificação de sessão no layout de `/app`
- Documentação dos schemas em `specs/schema.md`

## BYOK (Passo 3)

- Seção **BYOK** em Configurações → BYOK (substitui a antiga "Chave de API")
- Provedores: OpenAI, Anthropic, Google Gemini, OpenRouter e Groq (`lib/ai/providers.ts`)
- Chaves salvas por usuário na tabela `AIKey`, criptografadas com AES-256-GCM
- Rotas: `GET /api/byok`, `PUT /api/byok/[provider]`, `DELETE /api/byok/[provider]`
- A API nunca retorna a chave; apenas o status e os 4 últimos caracteres
- Documentação da tabela em `specs/schema.md`

## Catálogo de modelos (Passo 3)

- Catálogo estático e tipado em `lib/ai/models.ts`, validado com Zod na inicialização
- Página pública `/provider/[provider]/models` com metadados de cada modelo
- Rotas: `GET /api/models` (todos os provedores) e `GET /api/models/[provider]`
- Provedores disponíveis: `openai`, `anthropic`, `google`, `openrouter` e `groq`
- Para adicionar ou atualizar um modelo, edite `modelCatalog` em `lib/ai/models.ts` e mantenha o par `(provider, id)` único

## InstantModel (Passo 3)

- Cada usuário escolhe quais modelos aparecem na seleção rápida do chat
- Preferência por modelo salva na tabela `InstantModel`; ausência de registro significa modelo ativo
- No `ModelSelect` do chat, os toggles ficam na seção **Modelos rápidos**
- Rotas: `GET /api/instant-models` e `PUT /api/instant-models`
- Apenas modelos dos provedores com chave BYOK configurada entram na seleção rápida; sem nenhuma chave, o catálogo completo continua disponível como fallback

## Loop agêntico

- O chat usa `ToolLoopAgent` (`lib/ai/agents/spectral-agent.ts`) com até 12 passos por mensagem
- A tool `updatePlan` cria e atualiza o plano exibido na timeline expansível do chat
- `prepareStep` poda chamadas de ferramentas antigas quando o contexto cresce
- Um budget de tokens interrompe execuções longas antes de virarem custo excessivo
- O prompt v4 adiciona a seção `agent-loop` com as regras de planejar, executar, observar e replanejar
- As etapas são recuperadas do histórico via `Message.parts`, sem migração adicional

## Generative HTML

- A IA pode renderizar HTML sanitizado no chat com a tool `renderHtml`
- Política versionada em `lib/ai/ui/html-policy.ts` (`HTML_UI_VERSION = 2`)
- Tags, atributos e classes Tailwind são allowlisted; scripts, estilos inline, iframes e formulários são removidos do HTML
- Widgets interativos usam `script` opcional em iframe `sandbox="allow-scripts"` (sem `allow-same-origin`), com CSP `default-src 'none'`
- Scripts acessam apenas `spectral.action/open/theme/onThemeChange/onReady`; ações são revalidadas no pai
- Botões usam ações tipadas em `data-spectral-action`; links externos usam `http(s)`/`mailto`
- O servidor sanitiza no `execute` e o cliente revalida antes de renderizar
- As interfaces são recuperadas do histórico via `Message.parts` (jsonb), sem migração adicional
- Galeria visual em `/styleguide#generative-html`
- Referência técnica em `specs/ui-generative-html.md`

### Variáveis de ambiente

- `DATABASE_URL` — string de conexão PostgreSQL
- `AUTH_SECRET` — segredo do Auth.js
- `BYOK_ENCRYPTION_KEY` — segredo usado para criptografar as chaves BYOK (usa `AUTH_SECRET` como fallback)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — login com Google
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — login com GitHub
- `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` — login com Apple (opcional)
- `DEVICE_PAIRING_SECRET` — segredo HMAC dos códigos de emparelhamento (usa `AUTH_SECRET` como fallback)
- `SPECTRAL_WS_HOST` / `SPECTRAL_WS_PORT` — bind do backend WebSocket e HTTP interno (padrão `0.0.0.0:4001`)
- `DEVICE_HEARTBEAT_TIMEOUT_MS` — timeout de heartbeat do backend (padrão `45000`)
- `DEVICE_COMMAND_TIMEOUT_MS` — timeout de comandos remotos (padrão `15000`, máximo `60000`)
- `SPECTRAL_INTERNAL_SECRET` — segredo do endpoint interno de comandos (usa `AUTH_SECRET` como fallback)
- `SPECTRAL_BACKEND_URL` — URL do backend usada pelo app Next.js (padrão `http://localhost:4001`)
- `SPECTRAL_API_URL` / `SPECTRAL_WS_URL` — URLs usadas pelo driver (padrão `localhost:3000` e `ws://localhost:4001`)
- O backend e o driver carregam o `.env` da raiz automaticamente; variáveis já definidas no ambiente têm prioridade.

Após alterar o schema, gere e aplique a migração:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Usuário de teste

O seed cria (ou atualiza) um usuário com senha para testar o login por credenciais:

```bash
npm run db:seed
```

Padrões: `admin@admin.com` / `admin123`. Sobrescreva com `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD`.

## Dispositivos (Passo 11)

- Seção **Dispositivos** em Configurações: lista, renomeia, emparelha e revoga computadores
- Emparelhamento por código de 6 caracteres (TTL de 5 min, uso único, hash HMAC-SHA256)
- Identidade Ed25519 por dispositivo; autenticação por desafio/assinatura no WebSocket
- Presença por heartbeat de 15s; online quando `lastSeenAt` tem até 45s
- Revogação lógica (`Device.revokedAt`) com encerramento do socket ativo
- Canal de comando backend → driver com `correlation id`, timeout e um comando em voo por dispositivo
- O chat consulta dispositivos com `device-list` / `device-online-list`, obtém o sistema operacional com `device-get-os` e controla com `device-open-url`, `device-open-app`, `device-list-apps`, `device-type-text` e `device-press-key`
- Leitura de arquivos nos dispositivos (somente leitura, sandbox da pasta do usuário): `device-list-files`, `device-read-file`, `device-glob` e `device-grep`
- Allowlist de apps no driver; URLs apenas `http`/`https`; combinações `alt+F4` e `ctrl+alt+delete` bloqueadas
- `type-text` e `press-key` agem na janela em foco do dispositivo (o driver não escolhe a janela)
- O driver deve ser iniciado com privilégios de administrador (PowerShell como Administrador ou `sudo`); o console exibe se o modo elevado está ativo (`device-get-os` retorna `elevated`)
- Pacotes independentes:
  - `spectral/backend`: servidor WebSocket (`ws`) e HTTP interno na porta `4001`
  - `spectral/driver`: CLI do dispositivo com reconexão, identidade local e executor de comandos
- Rotas: `/api/devices`, `/api/devices/[id]`, `/api/devices/pairing` e `/api/devices/pairing/confirm`
- Referência técnica em `specs/devices-connect.md`; tools de PC em `specs/chat-device.md`; tabelas em `specs/schema.md`

```bash
npm run install:services
npm run dev:backend   # WebSocket em ws://localhost:4001
npm run dev:driver    # emparelha no primeiro uso
npm run pair:driver   # força um novo código
```

## Exemplos de uso, e como a spectral ia devices compra tempo afinal pode automatizar muita coisa

Aqui estão alguns exemplos de como os dispositivos Spectral IA podem ser usados para automatizar tarefas e economizar tempo:

- **Automação de tarefas de arquivo**: envie comandos como renomear, mover ou excluir arquivos usando `device-type-text` e `device-press-key`.
- **Relatórios automáticos**: scripts que leem dados, geram resumos e salvam em `notas.txt` ou outros arquivos.
- **Chamadas de API**: disparar rotas backend via `device-open-url` para iniciar processos, consultar bancos de dados ou receber notificações.
- **Controle remoto de dispositivos**: use códigos de emparelhamento e `device-open-app` para abrir aplicativos específicos em máquinas diferentes.
- **Gatilhos de fluxo de trabalho**: configure o chat para disparar fluxos de trabalho com base em mensagens, reduzindo a necessidade de intervenção manual.

Esses recursos permitem que o Spectral IA reduza o tempo gasto em tarefas repetitivas, liberando o usuário para atividades de maior valor.