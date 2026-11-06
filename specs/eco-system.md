###
name: Spectral AI

"""
Esté o guia de implementação básica do site.
"""
###

# Passo 1:
1. Criar o projeto usando next-js e limpar a main
2. Definir o designer system para o front-end do projeto

## Status do Passo 1
- [x] Projeto Next.js criado
- [x] Base limpa: layout, fontes, metadata, assets padrão e README
- [x] Design system definido
- [x] shadcn/ui configurado (Base UI + CSS variables)
- [x] Página `/styleguide` criada para validação visual

Design system documentado em `designer.md`.


# Passo 2 (autenticação do projeto)
 "/app" principal pagina do projeto (exige) auth
- [x] Criar a pagina de login (front)
- [x] Criar estrutura básica do backend 
- [x] instalar drizzle, next-auth e zod (validação)

  1. [x] Configurações iniciais do DrizzleORM
  2. [x] Criar pasta db, ./index.ts pra conection
  3. [x] db/schema/index.ts 
  4. [x] definir o schema basico (definir junto com o programador), salvar a reference em schema.md
  5. [x] sobre os schemas, User e Account (login social)
  6. [x] criar o auth.ts no root (jwt-model)
  7. [x] Criar as rotas basicas/necessarias das api com o next-js
  
- [x] Uma rota básica que valida um email na plataforma.  (Aquele email existe?)
- [x] Caso email exista deve aparecer na tela, email invaliado criar conta
- [x] Na tela de login no campo de email usar essa rota para verificar se o email é valido, se for input de password aparece aquardando a senha
- [x] Implementar autenticação por email e password na tela login 
- [x] "/app" e outras rotas requer auth'
- [x] Quando o user estiver logado "/login" manda para "/app"

- [x] Coluna `password` no schema `user` (hash scrypt via `node:crypto`)
- [x] Provider `Credentials` no `auth.ts` validando com Zod
- [x] Rota `POST /api/auth/register` para criar conta com senha
- [x] Rota protegida `/app` (layout + `proxy.ts` matcher)`

- [x] Pagina de sign up "/register"
- [x] Frontend da pagina com os campos necessarios
- [x] Validar os dados da paginas
- [x] Registar o usuario no db

"""
Ao chegar aqui significa que basíco fundamental foi devidamente feito
O necessario para o inicio da aplicação.
"""


### Passo 3 (a construção o /app)
- [x] /app requer auth, deve impedir qualquer um que não esteja autencicado mandando o para /login
- [x] A criação do frontend basico, é um site baseado em chat de ia, então o frontend é nitidamente parecido com outros
- [x] [sidebar-component] [main-component]
- [x] no sidebar:
  - [x] Header com o nome Spectral e ao lado o icone de abrir e fechar a sidebar
  - [x] OptionComponent
        - Novo Chat (estado inicial do /app) ao entrar no site estamos nessa oção inicial por padrão. 
        - Pesquisar (não é bem uma opção e sim botão) ele deve abrir um modal com um input, digite o nome do chat... (o component aplicar um blur no fundo)
    - [x] DeviceList (lista os 3 primeiros devices, com uma marcação se ta online/offline)
  - [x] MyChatsComponents (gestão dos chats) — Passo 4
  - [x] Footer com o o card de user: [Avatar: nome]
    - [x] ao clicar deve abrir um context menu, com duas opções por enquanto:
      - [x] Configurações (modal de configurações) ConfigComponent
      - [x] Saiba Mais
      - [x] Sair (logout) Modal de confirmação
- [x] no main:
- [x] Header: Olá, {nome}
- [x] ChatComponent


   ChatComponent:
    Um inputchat, o principal component e o que mais será usado.
    Regras basicas:
      1. Não ter overflow (scrrol), a usar o shift-enter o component vai crescendo
      2. Não é um input comum, pois ele tem botões nas suas laterais.
    SelectModelComponent proximo ao botão de send, para selecionar Modelos

  ConfigComponent:
  Um modal de configurações da site
  [sidebar] - [content]

  sidebar: (Opções)
  1. Geral
    Aparencia
    Tema [sytem, light, dark]

  2. Conta
     Seu perfil
     [UserCardComponent]: [Avatar, Name \n Email]
     Seu Nome - [input] (auto-save)
     Seu Apelido - [input]  (auto-save)

     Sua conta
     Desconectar - logout -  component
     Apagar Conta  - (Apenas o botão não funciona por enquanto)

  3. Byok
     Uma das etapas do site, é o BYOK. Declaras as KEYS dos provedores de IA

     Use suas proprias chaves de api no Spectral

     Disponiveis - input: Pesquisar provedores
     AiProvidersCardComponent:
     "Provedor" - [Não Configurado] (ProviderConfigComponent
    
     - [x] Definir um api no backend com todos os provedores para listarmos aqui (`GET /api/byok`)
     - [x] Definir o schema do BYOK no DB (tabela `AIKey`)
     - [x] Salvar/remover chave por provedor (`PUT`/`DELETE /api/byok/[provider]`)
     - [x] Criptografia das chaves com `BYOK_ENCRYPTION_KEY`
     - [x] Provedores iniciais: OpenAI, Anthropic, Google Gemini, OpenRouter e Groq
     - [x] Groq com `openai/gpt-oss-20b` (limites de referência: 30 RPM, 1.000 RPD, 8.000 TPM, 200.000 TPD)

     A criação de "/provider/[provider]/models
     Será um tela basisca e simples, onde fica listado os modelos dos provedores suportados

     - será necessario criar uma api que lista os modelos suportados pela spectral, com algums metadados:
       EX: Sep 23, 2026 262K context $0.70/M input tokens $1.40/M output tokens
       
    Isso deve ser feito com grande anteção pois ao decorrer será adicionado novos modelos, e isso deve ser estavel e controlave
    veja todos os providers em `specs/providers.md`

  4. Modelos rapidos (redirect para /providers/select-model )

  5. Gerenciar dispositivos (devices) — seção **Dispositivos** em Configurações

     - [x] Emparelhamento por código temporário (TTL de 5 min, uso único)
     - [x] Identidade Ed25519 por dispositivo e autenticação por desafio/assinatura
     - [x] Presença via heartbeat (15s) e janela online de 45s
     - [x] Revogação com encerramento do socket ativo
     - [x] Pacotes independentes `spectral/backend` (WSS) e `spectral/driver` (CLI)
     - [x] Referência técnica em `specs/devices.md`

- [x] O select de models (seleção rapida de modelos para uso): (InstantModel) 
  devemos definir uma rota para isso: /providers/select-model (requer auth)

    header: selecione seus modelos - input: Procurar modelo

    listar o nome do + Um toogle-buton que (false/true) que deixa ativado/desativado. os modelos para uso rapido no chat.
    listar o nome especifico do modelo exeplo: anthropic/fable-5
    as pequisa deve funcionar tanto no nome simples quanto o nome especifico do model

    com base no modelos que estão disponiveis dos providers, ele vai deixando ativos os que ele vai usar.

- [x] Toggle por modelo no dropdown do `ModelSelect` do chat
      Deve listar apenas os modelos ativados e um link: Selecionar modelos

- [x] Preferência persistida por usuário na tabela `InstantModel`
- [x] Rotas `GET /api/instant-models` e `PUT /api/instant-models`
- [x] Catálogo com OpenRouter (`MODEL_CATALOG_VERSION = 2`)



Passo 4 (o basico do funcionamento dos chats)
- Tendo cloncuido o passo 3 com exito, estamos formidavelente prontos para começar a implantação basica do chat 
- 1. Definir o schema do chat (definir junto com o programador e salvar e schema.md para reference)
- 2. Usaremos o ai-skd da vercel, por isso devemos definir o nosso service/lib para melhor manutenção
- 3. O usuario escolhe qual modelo de ia, ele vai utilizar. esses modelos estão listados SelectModelComponent
     Deve está disponiveis apenas o chats que foram previamente marcado na pagina de (InstantModel)

  MyChatsComponents (gestão dos chats)
  (corrija isso abaixo:)
  icone de 3 pontos na direita: (icode "...")

  1. Renomear (o nome vira um input, o user escreve deve ser salvo automaticamente )
  2. Excluir (modal de confirmação)
  ao clicar nesse component ele deve se comrportar assim na url: /chat/[uuid], mantendo o layout padrão do site, mudar apenas url


# Passo 5 — System prompt versionado

O prompt é composto por seções independentes e versionado para permitir evolução segura.

- [x] Composição em `lib/ai/prompts/build.ts` (`buildSystemPrompt`)
- [x] Seções em `lib/ai/prompts/sections/` (identidade, estilo, capacidades, loop agêntico, UI e ações, segurança, contexto do usuário)
- [x] Versão e changelog em `lib/ai/prompts/registry.ts` (`SYSTEM_PROMPT_VERSION = 16`)
- [x] Injeção em `app/api/chat/route.ts`
- [x] Persistência da versão em `Message.promptVersion`
- [x] Revisão do prompt composto com `npm run prompt:print`

Regras de evolução:
- Mudou o texto de qualquer seção → incrementar `SYSTEM_PROMPT_VERSION` e registrar em `systemPromptChangelog`.
- Adicionar personalização por usuário → criar nova seção ou ampliar `PromptContext`; nunca editar o prompt já versionado sem subir a versão.
- `Message.promptVersion` registra qual versão gerou cada resposta do assistente.

# Passo 6 — Tools nativas

- [x] Camada de tools em `lib/ai/tools/` com registro `getChatTools()`
- [x] Proteções de `fetchUrl`: timeout, limite de resposta, bloqueio de localhost/IPs privados e revalidação de redirects (SSRF)
- [x] Tool `fetchUrl` para consultas GET/POST
- [x] Tool `updatePlan` para planejamento visível
- [x] Tool `renderHtml` para conteúdo visual sanitizado no chat
- [x] Tool `runAction` para efeitos na aplicação
- [x] Poda de contexto em `prepareStep` com `pruneMessages`
- [x] Renderização das tool parts no chat (`components/chat/chat.tsx`)
- [x] Formatação das respostas em Markdown (`components/chat/markdown-message.tsx`, `react-markdown` + `remark-gfm`)
- [x] JSON Schema das tools sem `$ref` no topo (compatível com Gemini)

# Passo 7 — Loop agêntico

- [x] Agente: `lib/ai/agents/spectral-agent.ts` (`ToolLoopAgent`, `isStepCount(12)` + budget de tokens)
- [x] Plano: `lib/ai/tools/update-plan.ts` e `lib/ai/plan.ts`
- [x] Timeline: `components/chat/agent-activity.tsx` e `components/chat/agent-plan.tsx`
- [x] Persistência: `Message.parts` (jsonb), sem migração adicional
- [x] Rota: `app/api/chat/route.ts` usa `createAgentUIStreamResponse` e acumula usage por passo
- [x] `renderHtml` e `runAction` não aparecem como cartões na timeline; o efeito visual é o feedback

# Passo 8 — Generative HTML

Referência técnica completa: [`specs/ui-generative-html.md`](./ui-generative-html.md)

- [x] `components/ai-ui/render-html-part.tsx` com estados loading/error/success
- [x] Sanitização DOMPurify no servidor e revalidação no cliente
- [x] Persistência do HTML sanitizado em `Message.parts`
- [x] Política versionada `HTML_UI_VERSION = 1`
- [x] Tool `renderHtml` registrada e anunciada no system prompt
- [x] Allowlist de tags, atributos e classes Tailwind
- [x] Botões com ações tipadas em `data-spectral-action`
- [x] Links externos limitados a `http(s)`/`mailto`, com `rel="noopener noreferrer"` em `target="_blank"`
- [x] Limite de 20k caracteres e no máximo 2 chamadas de `renderHtml` por resposta
- [x] Histórico antigo de `renderUi` mostra fallback curto, sem renderer legado

# Passo 9 — Ações da aplicação

Referência completa: [`specs/ai-interaction-model.md`](./ai-interaction-model.md)

Modelo **“UI é dado, ação é evento”**:

- `renderHtml` mostra conteúdo sanitizado no chat.
- `runAction` executa efeitos na aplicação.
- `fetchUrl` busca dados.
- `updatePlan` mostra progresso.
- `sendMessage` é ação exclusiva de botão e nunca é exposta à IA.

Implementado:
- [x] Catálogo versionado `ACTION_CATALOG_VERSION = 1`
- [x] Tipos: `toast`, `setTheme`, `openSettings`, `navigate`, `copy`, `sendMessage`
- [x] `aiActionSchema` sem `sendMessage`; `appActionSchema` completo
- [x] Allowlist de `navigate`: `/app`, `/providers/select-model`, `/provider/{provider}/models`
- [x] Tool `runAction` server-acknowledged: valida no servidor e executa no cliente
- [x] `AppActionsProvider` com tema, toast, router, clipboard e configurações
- [x] `ChatActionProvider` com `sendMessage` e bloqueio de `sendMessage` vindo da IA
- [x] `ConfigComponent` com seção controlada (`general`, `account`, `byok`)
- [x] `openSettings({ section: "byok" })` abre o formulário; a IA nunca recebe chaves
- [x] `AppActionHandler` com dedupe por `toolCallId` e skip de mensagens do histórico inicial
- [x] `externUi` removido; tool parts antigas são ignoradas

# Passo 10 — Garantias, testes e próximos passos

- [x] Testes com Vitest para catálogo de ações, sanitização de HTML, política de classes e allowlist
- [x] Teste de JSON Schema sem `$ref`/`$defs`/`definitions` para as tools
- [x] `npm run typecheck` e `npm run test`
- [x] Documentação do modelo em `specs/ai-interaction-model.md`
- [x] Styleguide atualizado para HTML sanitizado com ações reais
- [x] Fase 2: execução determinística de tool a partir do clique (sem depender do modelo)
- [x] Fase 2: confirmação explícita para ações sensíveis (ex.: `navigate` iniciado pela IA)
- [ ] Fase futura: estado interativo no chat, avaliado sem reintroduzir `chatState`

Passo 11, tools de informações sobre modelo e providers.
  Iremos definir tools de controle para providers e models
  Para que a gente tenha mais dinamismos.
  exemplos de tools:
    Provider.list-all-providers, prompt: Qual são os provedores de IA que estão disponiveis para configurar?
    Provider.list-all-providers-configured, prompt: Qual são os provedores de IA que estão configurados?

  Implementado:
  - [x] `provider-list-all`: lista todos os provedores suportados com `configured`, `modelCount` e `updatedAt`
  - [x] `provider-list-configured`: lista apenas os provedores com chave BYOK configurada
  - [x] `model-list-by-provider`: lista o catálogo de um provedor com metadados e `quickEnabled`; funciona sem chave (`configured=false`)
  - [x] `model-list-enabled`: lista modelos ativados para uso rápido, com filtro opcional por provedor
  - [x] `model-set-enabled`: ativa/desativa modelo na seleção rápida com `{ provider, modelId, enabled }`, só para provedores com chave BYOK configurada
  - [x] Regra de ativação igual à UI: modelo sem preferência salva conta como ativado; `enabled=false` fica de fora
  - [x] Tools nunca retornam `apiKey`, `maskedKey` ou material de chave
  - [x] Registro em `getChatTools()` (`lib/ai/tools/provider-tools.ts` e `lib/ai/tools/model-tools.ts`)
  - [x] Seção `providers-and-models` no system prompt (`SYSTEM_PROMPT_VERSION = 15`)
  - [x] Testes em `lib/ai/tools/provider-tools.test.ts` e `lib/ai/tools/model-tools.test.ts`
  - [x] Documentação das tools em `specs/providers.md`

Passo 12 - Device System
  Device system é uma maneira de controlar dispositivos externos via chat ui
  Exemplo apos a integração final:  
    Abra o navegador no youtube no dispositivo "casa-pc"

  A comunicação funcionará via sockets, um backend externo
  No dispositivo que será conectado, deverá  ser instaldo o drive de comunicação e pareado no app do spectral

  o sistema completo está em ./devices-connect.md
  
  --- Até aqui está feito

  Integração com o chat via tools
  A api de tools `device-tools` permite ao chat consultar os dispositivos, e o driver controla a máquina.
  No driver foram definidas as APIs necessárias para controlar o dispositivo (PC agora; celular e TV Android no futuro).

  Fase 1 — somente consulta (implementada)
  - [x] `device-tools.device-list`: lista todos os dispositivos
  - [x] `device-tools.device-online-list`: lista apenas os dispositivos online
  - [x] Tools em `lib/ai/tools/device-tools.ts`, restritas aos dispositivos do usuário autenticado
  - [x] Sem exposição de chaves públicas ou fingerprints
  - [x] Seção `devices` no system prompt (`SYSTEM_PROMPT_VERSION = 8`)
  - [x] Testes em `lib/ai/tools/device-tools.test.ts`

  Fase 2 — controle remoto (implementada)
  - [x] Canal de comando backend → driver via WebSocket (request/response com correlation id)
  - [x] Endpoint HTTP interno no backend autenticado por segredo compartilhado
  - [x] Tools de controle `device-open-url`, `device-open-app`, `device-list-apps`, `device-get-os`, `device-type-text` e `device-press-key`
  - [x] Tools de leitura de arquivos `device-list-files`, `device-read-file`, `device-glob` e `device-grep` (somente leitura, sandbox da pasta do usuário)
  - [x] Executor no driver com allowlist de apps, URLs http/https e bloqueio de combinações perigosas
  - [x] Seção `devices` atualizada no system prompt (`SYSTEM_PROMPT_VERSION = 11`)
  - [x] Tools de PC documentadas em `specs/chat-device.md`

  Fase 3 - Adicionar mais força ao agente:

  - [x] `device-write-file` e `device-edit-file` (escrita/edição de arquivos no PC, sandbox da pasta do usuário)
  - [x] `device-run-command` (execução de comandos shell no PC, allowlist/denylist, timeout)
  Opções para a Fase 3 (definir ordem com o programador):
  - [ ] Confirmação explícita no chat para ações sensíveis (`device-type-text`, `device-press-key`, `device-write-file`, `device-edit-file` e `device-run-command`)
        - A tentativa anterior (`toolApproval`/confirmação em texto) foi removida em `60055bf`; hoje as tools executam direto.
  - [ ] `device-screenshot` + loop de visão (feedback de tela do dispositivo para o modelo)
  - [ ] Modo autônomo (`requireApproval: false`) para desativar confirmações

  Próximas fases (após Fase 3)
  - [ ] Suporte a celular e TV Android


Proximos passo:
  Device:
    Melhorá o sistema de configurações de devices
    Permitir roda codigo sem limitação, usar qualquer comando sem limitação.
    Abrir qualquer app. independente do app está listado no driver.
    Da mais profundiade ao device, fazer com que ele tenha mais poder de execução consiga, executar tarefas insanamente complexas.
    Device + playwritgh para controlar navegador
    Poder adicionar devices via chat.

    Integração do device com outros agentes, (device controlando o opencode/cloudcode)    

  
  Mais tools para melhorar o chat.
  
  Sistema de memorias entre os chats
  Virtual Files (um sistema de virtual arquivos e pastas) que podem ser clonados do dispositivo 
    
  Melhorar o generative HTML
    [x] Usar HTML em vez de componente React.
    [ ] Permitir a IA usar JS com sandbox seguro.

    A ia não tem esatados da tela, ela não qual tema estamos, por issa ela acaba mudando pra escuro tanto escuro
    
  
  Sistema de view de file/site do outro lado tela assim como claude
  Baixar files, Markdown
  Fazer LandingPage, fazer o oAuth, sistema de envio de email, e de conta verificada.
  
    

### Passo 40 (futuro): configurações personalizadas de prompt

Adicionar uma seção **Prompt** no `ConfigComponent` (junto de Geral, Conta e Byok) para o usuário
personalizar o comportamento do assistente. O prompt deixa de ser apenas interno e passa a ter
uma camada de preferências por usuário.

- [ ] Nova seção "Prompt" no `ConfigComponent` com auto-save
- [ ] Preferências: tom (neutro/amigável/técnico), verbosidade (curto/equilibrado/detalhado),
      idioma de resposta e um campo de instruções personalizadas (texto livre)
- [ ] Persistir por usuário (ex.: tabela `PromptPreference` ou coluna jsonb em `user`) e documentar em `specs/schema.md`
- [ ] Ampliar `PromptContext` e criar seções condicionais em `lib/ai/prompts/sections/` que só entram quando houver preferência
- [ ] Manter o prompt base sempre acima das preferências (preferências não podem remover segurança/limites)
- [ ] Incrementar `SYSTEM_PROMPT_VERSION` ao introduzir a composição com preferências
- [ ] Rotas `GET/PUT /api/prompt-preferences` com validação Zod'
- [ ] `Message.promptVersion` + hash/registro das preferências aplicadas para rastreabilidade

### Passo 41 (futuro): estado interativo no chat

Avaliar um modelo de estado interativo **sem reintroduzir o antigo `chatState`**, que foi removido
por não ter um contrato claro de persistência e segurança. A nova abordagem deve:

- [ ] Definir um estado tipado e versionado, com persistência explícita em `Message.parts`
- [ ] Separar estado de apresentação (`renderHtml`) de efeitos (`runAction`)
- [ ] Permitir que botões atualizem o estado sem depender de uma nova resposta do modelo
- [ ] Manter validação Zod no servidor e no cliente
- [ ] Documentar o contrato antes de implementar
    
  