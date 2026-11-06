# Spectral AI - Schema Documentation

## Database: PostgreSQL
Using DrizzleORM with NextAuth.js (Auth.js) adapter.

## Tables

### user
- `id` (text, PK) - CUID gerado automaticamente via @paralleldrive/cuid2
- `name` (text, nullable) - Nome exibido; editável (2–80 caracteres) em Configurações → Conta
- `nickname` (text, nullable) - Apelido opcional (até 40 caracteres); editável em Configurações → Conta. Vazio é salvo como `null`
- `email` (text, unique, nullable) - Somente leitura após o cadastro
- `emailVerified` (timestamp, nullable)
- `image` (text, nullable)
- `password` (text, nullable) - Hash scrypt no formato `scrypt:<salt>:<hash>`; nulo para contas apenas sociais
- `createdAt` (timestamp, not null) - Default: now()
- `updatedAt` (timestamp, not null) - Default: now(); atualizado em cada alteração de perfil (`PATCH /api/user`)

> Alterações de perfil (nome/apelido) são persistidas via `PATCH /api/user` e refletidas na sessão JWT.

### account
Armazena contas vinculadas para login social (Google, GitHub, Apple, etc.).
- `id` (text, PK) - CUID gerado automaticamente
- `userId` (text, FK -> user.id, cascade delete) - Indexado
- `type` (text) - Tipo de conta (oauth, email, etc.)
- `provider` (text) - Provedor (google, github, apple)
- `providerAccountId` (text) - ID da conta no provedor
- Unique index: (provider, providerAccountId)
- `refresh_token`, `access_token`, `id_token` (text, nullable)
- `expires_at` (integer, nullable)
- `token_type`, `scope`, `session_state` (text, nullable)

### session
- `sessionToken` (text, PK)
- `userId` (text, FK -> user.id, cascade delete)
- `expires` (timestamp, not null)

### AIKey
Chaves de API dos provedores de IA por usuário (BYOK). O valor em `apiKey` é armazenado criptografado (AES-256-GCM).
- `id` (text, PK) - CUID gerado automaticamente
- `userId` (text, FK -> user.id, cascade delete) - Indexado
- `provider` (text) - Identificador do provedor: `openai`, `anthropic`, `google`, `openrouter` ou `groq`
- `apiKey` (text, not null) - Chave criptografada no formato `v1:<iv>:<tag>:<ciphertext>` (base64)
- `createdAt` (timestamp, not null) - Default: now()
- `updatedAt` (timestamp, not null) - Default: now(); atualizado em cada upsert
- Unique index: (userId, provider)

> A chave nunca é retornada pela API; a listagem expõe apenas o status e os 4 últimos caracteres, calculados no servidor.

### InstantModel
Preferência do usuário sobre quais modelos aparecem na seleção rápida do chat.
- `id` (text, PK) - CUID gerado automaticamente
- `userId` (text, FK -> user.id, cascade delete) - Indexado
- `provider` (text) - Identificador do provedor: `openai`, `anthropic`, `google`, `openrouter` ou `groq`
- `modelId` (text) - ID do modelo no catálogo (`lib/ai/models.ts`)
- `enabled` (boolean, not null) - Default: `true`; `false` remove o modelo da seleção rápida
- `createdAt` (timestamp, not null) - Default: now()
- `updatedAt` (timestamp, not null) - Default: now(); atualizado em cada upsert
- Unique index: (userId, provider, modelId)

> A ausência de registro significa modelo ativo. O `PUT /api/instant-models` grava apenas overrides explícitos; registros de modelos removidos do catálogo são ignorados na leitura.

### Device
Dispositivo emparelhado a um usuário. A revogação é lógica (`revokedAt`), preservando o histórico de última conexão.
- `id` (text, PK) - CUID gerado automaticamente
- `userId` (text, FK -> user.id, cascade delete) - Indexado
- `name` (text, not null) - Nome exibido; editável em Configurações → Dispositivos
- `hostname` (text, nullable) - Hostname informado pelo driver
- `platform` (text, not null) - `process.platform` do driver (`win32`, `darwin`, `linux`...)
- `architecture` (text, nullable) - `process.arch` do driver
- `publicKey` (text, not null) - Chave pública Ed25519 em PEM (SPKI)
- `fingerprint` (text, not null) - SHA-256 (base64url) da chave pública em DER; indexado
- `lastSeenAt` (timestamp, nullable) - Atualizado a cada heartbeat; online quando ≤ 45s
- `revokedAt` (timestamp, nullable) - Revogação lógica; dispositivo revogado não autentica
- `createdAt` (timestamp, not null) - Default: now()
- `updatedAt` (timestamp, not null) - Default: now(); atualizado ao renomear/revogar
- Index: (userId), (fingerprint), (userId, revokedAt)

> O servidor nunca recebe a chave privada. A presença não é persistida como enum; o status é derivado de `lastSeenAt`.

### DevicePairingSession
Sessão temporária de emparelhamento. O código de 6 caracteres nunca é armazenado em texto puro.
- `id` (text, PK) - CUID gerado automaticamente; usado pelo driver para consultar o estado
- `codeHash` (text, not null) - HMAC-SHA256 do código normalizado (`DEVICE_PAIRING_SECRET`, fallback `AUTH_SECRET`)
- `deviceId` (text, FK -> Device.id, set null) - Preenchido na confirmação atômica
- `publicKey` (text, not null) - Chave pública Ed25519 informada pelo driver
- `fingerprint` (text, not null) - Fingerprint da chave pública; indexado
- `hostname`, `architecture` (text, nullable) e `platform` (text, not null)
- `expiresAt` (timestamp, not null) - TTL de 5 minutos; indexado
- `consumedAt` (timestamp, nullable) - Uso único; preenchido dentro da transação
- `createdAt` (timestamp, not null) - Default: now()
- Unique index: (`codeHash`)

> A confirmação executa `SELECT ... FOR UPDATE` e só consome a sessão se ela não estiver consumida nem expirada. Um dispositivo ativo com o mesmo fingerprint no mesmo usuário retorna `already_paired`.

### MessageRole
Enum PostgreSQL com os valores `user`, `assistant` e `system`.

### Chat
Conversa do usuário. O `id` é gerado no cliente (UUID) para permitir o envio da primeira mensagem sem criar registros vazios, mas também aceita o CUID padrão do banco.
- `id` (text, PK) - UUID gerado no cliente ou CUID padrão
- `userId` (text, FK -> user.id, cascade delete)
- `title` (text, not null) - Default: `"Nova conversa"`; derivado da primeira mensagem do usuário
- `provider` (text, nullable) - Provedor do **último modelo usado** na conversa
- `model` (text, nullable) - ID do **último modelo usado** na conversa
- `createdAt` (timestamp, not null) - Default: now()
- `updatedAt` (timestamp, not null) - Default: now(); atualizado a cada nova mensagem
- Index: (userId, updatedAt)

### Message
Mensagem persistida de uma conversa.
- `id` (text, PK) - ID do `UIMessage` gerado pelo AI SDK
- `chatId` (text, FK -> Chat.id, cascade delete)
- `role` (MessageRole, not null) - `user`, `assistant` ou `system`
- `content` (text, not null) - Texto derivado da concatenação das partes de texto (usado para título e busca)
- `parts` (jsonb, not null) - Partes completas do `UIMessage` (`UIMessagePart[]`), preservando texto, raciocínio, ferramentas etc. Também guarda as tool parts de Generative HTML (`renderHtml`) com `input`, `output` e `uiVersion`, o que permite reconstruir as interfaces no histórico sem tabela adicional.
- `provider` (text, nullable) - Provedor do modelo que gerou a resposta (`assistant`)
- `model` (text, nullable) - ID do modelo que gerou a resposta (`assistant`)
- `promptVersion` (integer, nullable) - Versão do system prompt (`SYSTEM_PROMPT_VERSION`) usada na resposta (`assistant`)
- `inputTokens` (integer, nullable) - Tokens de entrada reportados pelo provedor
- `outputTokens` (integer, nullable) - Tokens de saída reportados pelo provedor
- `createdAt` (timestamp, not null) - Default: now()
- Index: (chatId, createdAt)

> A mensagem do usuário é gravada imediatamente no envio. A resposta do assistente é gravada no fim do stream, incluindo partes e uso de tokens. Mensagens de conversas de outros usuários nunca são retornadas.

### verificationToken
Para verificação de email/magic links.
- `identifier` (text)
- `token` (text)
- `expires` (timestamp, not null)
- Unique index: (identifier, token)

## Migrations

- `0000_jazzy_fenris` — tabelas iniciais do Auth.js (`user`, `account`, `session`, `verificationToken`) e coluna `password`.
- `0001_add_nickname` — adiciona a coluna `nickname` em `user`.
- `0002_ai_key` — cria a tabela `AIKey` (chaves BYOK por usuário).
- `0003_instant_model` — cria a tabela `InstantModel` (preferências de modelos rápidos por usuário).
- `0004_chat` — cria o enum `MessageRole` e as tabelas `Chat` e `Message`.
- `0005_message_prompt_version` — adiciona a coluna `promptVersion` em `Message`.
- `0006_complex_drax` — cria `Device` e `DevicePairingSession` (emparelhamento e presença).
- `0007_red_lorna_dane` — adiciona `DevicePairingSession.deviceId` para o driver recuperar o dispositivo confirmado.

Aplicar com:

```bash
npx drizzle-kit migrate
```
