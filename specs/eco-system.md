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
     - [x] Provedores iniciais: OpenAI, Anthropic, Google Gemini e OpenRouter

     A criação de "/provider/[provider]/models
     Será um tela basisca e simples, onde fica listado os modelos dos provedores suportados

     - será necessario criar uma api que lista os modelos suportados pela spectral, com algums metadados:
       EX: Sep 23, 2026 262K context $0.70/M input tokens $1.40/M output tokens
       
    Isso deve ser feito com grande anteção pois ao decorrer será adicionado novos modelos, e isso deve ser estavel e controlave
    veja todos os providers em `specs/providers.md`

  4. Modelos rapidos (redirect para /providers/select-model )

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


Passo 5:
- System prompt básico (definição do sistema de prompts internos)
  Isso deve ser bem construido pois com a evolução do sistema, os system prompts vão evoluindo para se adequar ao user!!
  #### System prompt v4 (`SYSTEM_PROMPT_VERSION = 4`)

  Referências:
  - Composição: `lib/ai/prompts/build.ts` (`buildSystemPrompt`)
  - Seções: `lib/ai/prompts/sections/` (identidade, estilo, capacidades, loop agêntico, interfaces generativas, segurança, contexto do usuário)
  - Versão e changelog: `lib/ai/prompts/registry.ts`
  - Injeção: `app/api/chat/route.ts`
  - Persistência: `Message.promptVersion`
  - Revisão do prompt composto: `npm run prompt:print`
  
  Regras de evolução:
  - Mudou o texto de qualquer seção → incrementar `SYSTEM_PROMPT_VERSION` e registrar em `systemPromptChangelog`.
  - Adicionar personalização por usuário → criar nova seção (ou ampliar `PromptContext`), nunca editar o prompt já versionado sem subir a versão.
  - `Message.promptVersion` registra qual versão gerou cada resposta do assistente.

Passo 6
- Tools nativas (a nivel de chat)
  Isso deve ser feita de maneira profissional pois um dos diferencias da IA é as tools nativas

  - [x] Camada de tools em `lib/ai/tools/` com registro `getChatTools()`

  - [x] Proteções: timeout, limite de resposta, bloqueio de localhost/IPs privados e revalidação de redirects (SSRF)
  - [x] Loop agêntico no `/api/chat` com `ToolLoopAgent`, até 12 passos e budget de tokens
  - [x] Tool `updatePlan` com timeline expansível em `components/chat/agent-activity.tsx`
  - [x] Poda de contexto em `prepareStep` com `pruneMessages`
  - [x] Renderização das tool parts no chat (`components/chat/chat.tsx`)
  - [x] System prompt v4 anuncia as tools e orienta planejamento, citação da fonte e limites


  todas tools:
    - [x] Tool nativa: Requisição de api [fetch] (`fetchUrl`, GET/POST)
    - [x] Tool nativa: Planejamento visível (`updatePlan`)
    - [x] Formatação nativa das respostas em markdown (`components/chat/markdown-message.tsx`, `react-markdown` + `remark-gfm`)

  essas tools rodam no chat, no futuro teremos tools externas que rodam ana aplicação, ela possuiram o sufixo ExternTools

Passo 7:
Loop agêntico
- Agente: `lib/ai/agents/spectral-agent.ts` (`ToolLoopAgent`, `isStepCount(12)` + budget de tokens)
- Plano: `lib/ai/tools/update-plan.ts` e `lib/ai/plan.ts`
- Timeline: `components/chat/agent-activity.tsx` e `components/chat/agent-plan.tsx`
- Persistência: `Message.parts` (jsonb), sem migração adicional
- Rota: `app/api/chat/route.ts` usa `createAgentUIStreamResponse` e acumula usage por passo


# Passo 8 — Generative UI

Aqui começa uma das funcionalidades mais interessantes do Spectral.

Referência técnica completa: [`specs/ui-generative-components.md`](./ui-generative-components.md)

Criar uma camada de componentes dinâmicos que podem ser apresentados pela IA dentro da conversa.

## Tipos de componentes
1. **Componentes a nível de chat** (aparecem no chat) — Implementado (interno de chat)
2. **Componentes a nível de aplicação** (aparecem na UI do site) — Futuro (externo de chat)

## Infraestrutura
- [x] Criar `components/ai-ui/`
- [x] Criar registro de componentes permitidos (`components/ai-ui/registry.tsx`)
- [x] Criar mecanismo de identificação das chamadas de UI (`RENDER_UI_TOOL_NAME`)
- [x] Criar renderizador de componentes (`components/ai-ui/render-ui-part.tsx`)
- [x] Implementar estados: loading, success, error e waiting
- [x] Persistir os dados necessários para recuperar as interfaces no histórico (`Message.parts`)
- [x] Catálogo versionado `UI_CATALOG_VERSION = 1`
- [x] Tool `renderUi` registrada em `getChatTools()` e anunciada no system prompt
- [x] Validação Zod no servidor e revalidação no cliente antes de renderizar

## Componentes Específicos (nível de chat)
- [x] `callout` (Destaque/alerta)
- [x] `infoCard` (Resumo com rótulo/valor)
- [x] `statGrid` (Grade de métricas)
- [x] `dataTable` (Tabela estruturada)
- [x] `timeline` (Etapas de processo)
- [x] `sourceList` (Fontes e referências)

## ChatUI.Api (Primitivos, nível de chat)
- [x] `Text` (variantes: h1, h2, p, span, muted, caption + pesos normal/medium/semibold/bold)
- [x] `Button` (variantes: default, outline, secondary, ghost)
- [x] `Div` (container com `className` para controle de layout)

**Regras:**
- [x] Apenas `text`, `button`, `div`
- [x] Máximo 2 níveis de `div` (`div > div`)
- [x] Se `div` estiver dentro de outro `div` (nível 2), seus filhos só podem ser `text` ou `button`
- [x] `div` no topo (nível 1) pode conter `text`, `button` ou `div` (nível 2)
- [x] Layout controlado via `className` (`flex`, `flex-row`, `flex-col`, `gap`, `justify-*`, `items-*`, `grid`)
- [x] Sem recursão — schemas explícitos por nível
- [x] Sem `component` dentro do `chatUi`

## Componentes Externos (nível de aplicação)
- [x] **ExternUI.Api** — Componentes que rodam fora do chat (na aplicação). Integrado ao sistema.

  Componentes:
    - [x] `Toast` (ExternUI.Api.Toast) — Exibir notificação toast na aplicação via tool `externUi` (estilizado com design system, com prevenção de duplicados)


Passo 10:
  coloque aqui...'



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

  Passo 41: tools de estado interativo: futuro
  vamos criar uma tools de estado interativo
  isso será uma maneira de termos "state" no chat
  isso se chamará "chatState" e servirá pra salvar dados
  isso no dara dinamismo, trazendo mais poder pra a ui do chat
  o chatState controla a reatividade do react

  exemplos legais:
    Crie um text com o numero 10
    (A IA vai criar um texto com o numero 10)

    Some + 10 naquele text
    (a reatividade do sistema vai fazer isso ficar muito bom!!)

    A IA deverá saber integrar isso a UI
    
  