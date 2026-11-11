# Execução no dispositivo — o driver como “Claude Code sem cérebro”

> **Status:** Fase 0 (fundação) e Fase 1 (shell MVP) implementadas. As fases 2
> (arquivos/processos) e 3 (jobs) seguem como plano. Detalha o item 7 de
> [`specs/devices-evolution.md`](./devices-evolution.md) e é a base para os
> itens 5, 8 e 13.
>
> **Tese:** o driver é o **plano de execução**; o cérebro (LLM, planejamento,
> aprovação e auditoria) fica no app/backend. O driver precisa oferecer todas as
> primitivas que o Claude Code usa para operar uma máquina — shell, arquivos,
> processos, jobs — de forma determinística, versionada e auditável. A GUI/UIA
> continua como diferencial para o que não tem CLI.

---

## 1. Princípios

1. **Contrato primeiro.** Toda capacidade nova nasce em
   `spectral/shared/device-commands.ts`, com validação, tipo de resultado,
   limites e código de erro. O driver nunca inventa um contrato local.
2. **O cérebro não vai para o driver.** Raciocínio, plano, todo list, memória,
   subagents, MCP, hooks e escolha de ferramenta são do app. O driver executa e
   reporta.
3. **Capacidade ≠ permissão.** O driver sabe fazer; o app decide se pode. O
   padrão é o Modo Leitura; ações que mudam a máquina exigem o Modo Construtor.
4. **Aprovação fora da banda do modelo.** Nenhuma ação destrutiva depende de
   “confirme em texto”: a aprovação é um evento do app, que o modelo não
   controla.
5. **Tudo auditável.** Toda execução gera um registro com quem, o quê, onde,
   quando e qual foi a decisão.
6. **Saída pensada para o modelo.** Exit code sempre; stdout/stderr limitados,
   com cabeça e cauda; erros com `code`, `hint` e `retryable`.
7. **Degradação clara.** Driver antigo ou plataforma sem suporte responde
   `unsupported_platform` / `capability_unavailable`, nunca erro genérico.

---

## 2. Mapa de capacidades

| Capacidade | Claude Code | Spectral hoje | Entrega |
|---|---|---|---|
| Shell / scripts | Bash livre, cwd, exit code | allowlist `dir`, `type`, `echo`… | `shell` (item 7a) |
| Descobrir ambiente | `env`, `which`, `uname` | `get-os` básico | `env` (item 7b) |
| Ler arquivo | `Read` com offset/limit | ✅ `read-file` | — |
| Escrever/editar | `Write`, `Edit`, `MultiEdit` | ✅ `write-file`, `edit-file` (1 ocorrência) | `apply-patch` (item 7c) |
| Buscar arquivos/texto | `Glob`, `Grep` (rg) | ✅ `glob`, `grep` | — |
| Operações de arquivo | `cp`, `mv`, `rm`, `mkdir` | ❌ | item 5 |
| Processos | `ps`, `kill`, `top` | ❌ | item 8 |
| Comandos longos | background + streaming | ❌ timeout 60 s, 1 por PC | jobs (item 13) |
| Rede | `curl`/WebFetch | ❌ (bloqueado) | via `shell` no Modo Construtor |
| GUI nativa | ❌ | ✅ UIA, mouse, screenshot, janelas | diferencial |
| Clipboard | limitado | ✅ texto | — |
| Sistema | volume/energia/etc. | ❌ | item 9 |
| Navegador | via Playwright/MCP | ❌ | item 4c |
| **Cérebro** | plano, todo, memória, subagents, MCP, hooks | app | app |

O driver nunca deve conhecer o chat, o modelo ou o prompt — apenas o contrato.

---

## 3. Arquitetura em camadas

```
LLM (app) ── tools ── backend (control plane) ── WS ── driver (execution plane)
                        │                                │
                        ├─ política do dispositivo       ├─ executor.ts (dispatch)
                        ├─ aprovação                     ├─ commands/shell.ts
                        ├─ auditoria                     ├─ commands/files.ts
                        ├─ jobs (registro/eventos)       ├─ commands/processes.ts
                        └─ capabilities                  └─ commands/jobs.ts
```

- **Driver:** executa, aplica defesa em profundidade (sandbox, denylist,
  timeout, kill de árvore de processos), formata saída.
- **Backend:** valida contrato, aplica política, cria pedido de aprovação,
  registra auditoria, mantém jobs e transmite eventos.
- **App:** expõe tools com schemas/descrições, renderiza aprovação e auditoria,
  e ensina o modelo a operar a máquina no prompt.
- **Dados:** `Device.executionPolicy` (preferência de confirmação), `DeviceJob`,
  `AuditEvent`.

### Regra de ouro do transporte

O WebSocket hoje tem `maxPayload` de 4 MB e timeout máximo de 60 s por comando,
com um comando em voo por PC. O plano de execução **não pode** depender de um
comando longo:

- execução curta → resposta síncrona;
- execução longa → `job-start` responde na hora com `jobId`; progresso e saída
  são eventos/polling curtos;
- binários grandes → canal separado (item 6), não base64 no comando.

---

## 4. Contrato proposto

### 4.1 `shell` (item 7a) — a primitiva central

Entrada:

```ts
{
  script: string                 // comando único ou script multilinha
  shell?: "auto" | "pwsh" | "powershell" | "cmd" | "bash" | "sh" | "zsh"
  cwd?: string                   // dentro do home ou da pasta padrão
  timeoutMs?: number             // 1s..60s; acima disso use job
  env?: Record<string, string>   // até 32 variáveis extras, sem segredos
  stdin?: string                 // até 64 KB
  maxOutputBytes?: number        // 1KB..512KB por stream, padrão 64KB
}
```

Saída (implementada em `spectral/shared/device-commands.ts`):

```ts
{
  shell: "pwsh" | "powershell" | "cmd" | "bash" | "sh" | "zsh"
  shellPath: string
  cwd: string
  exitCode: number               // 0..255; -1 para timeout/abortado
  stdout: string
  stderr: string
  stdoutBytes: number
  stderrBytes: number
  durationMs: number
  truncated: boolean
  timedOut: boolean
}
```

Execução (decisão de projeto):

- **Nunca** interpolar o script numa linha de shell com `execFile`.
- Gravar o script em arquivo temporário com nome aleatório e executar:
  - Windows: `pwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass
    -File <tmp>.ps1`.
  - Unix: `bash <tmp>.sh` (sem forçar `-e`; o script decide).
- Timeout mata a **árvore** de processos (job object no Windows; grupo de
  processos no Unix), não só o pai.
- `env` é allowlist: `PATH`, `HOME`, `TEMP`, etc. + variáveis explícitas.
  Nunca herdar segredos do processo do driver.
- Saída em UTF-8; no Windows, decodificar conforme o code page quando o comando
  externo não emitir UTF-8.

Erros: `unsupported_platform` (macOS/Linux nesta versão), `policy_denied`,
`shell_unavailable`, `cwd_outside_root`, `cwd_not_found`, `not_a_directory`,
`command_timeout`, `output_too_large`, `command_failed` e `approval_denied`.

### 4.2 `env` (item 7b) — o modelo para de adivinhar

```ts
DeviceEnv = {
  platform: "win32" | "darwin" | "linux"
  arch: string
  hostname: string
  user: string
  home: string
  temp: string
  cwd: string
  shells: Array<{ id: string; path: string; version?: string }>
  runtimes: Array<{ id: "node" | "npm" | "pnpm" | "yarn" | "python" | "pip" |
                    "git" | "docker" | "rg" | string; version?: string; path?: string }>
  elevated: boolean
  locale?: string
  capabilities: string[]
}
```

- Coletado no `device:authenticated` e cacheado (TTL de 5 min).
- `capabilities` evita tool inútil: se não tem `pwsh`, o modelo vê `powershell`.
- Também alimenta o item 12 (negociação de capacidades) da UI.

### 4.3 Arquivos (itens 5 e 7c)

Manter o `FileSandbox` atual e adicionar:

| Comando | Entrada | Observação |
|---|---|---|
| `mkdir` | `{ path, recursive? }` | idempotente |
| `copy` | `{ from, to, overwrite? }` | recursivo |
| `move` | `{ from, to, overwrite? }` | |
| `rename` | `{ path, name }` | mesmo diretório |
| `delete` | `{ path, recursive?, permanent? }` | lixeira por padrão |
| `stat` | `{ path }` | tipo, tamanho, datas, permissões |
| `zip` | `{ paths[], to }` | limite de tamanho |
| `unzip` | `{ from, to }` | proteção contra zip slip |
| `apply-patch` | `{ path, patches[] }` | multi-edição determinística |

Regras:

- `delete` exige aprovação e usa lixeira quando possível.
- `copy`/`move` validam origem e destino no sandbox.
- `apply-patch` substitui o `edit-file` de 1 ocorrência para edições maiores,
  com `context` antes/depois e falha atômica (nenhuma escrita parcial).
- Raízes permitidas vêm da política, não do `homedir` fixo.

### 4.4 Processos (item 8)

```ts
list-processes: { filter?: string; limit?: number } →
  { processes: [{ pid, name, command, cpuPercent, memoryBytes, startedAt,
                  sessionId? }] }

start-process: { command, args?, cwd?, detached?, env? } →
  { process: { pid, name } }         // Modo Construtor; Poder Total dispensa aprovação

kill-process: { pid?, name?, force? } →
  { killed: number }                 // sempre aprovação
```

- `kill-process` por nome exige confirmação explícita do alvo.
- Nunca matar o próprio driver, o backend ou processos de sistema protegidos.

### 4.5 Jobs (item 13) — o que destrava builds e servidores

```ts
job-start:  { script, shell?, cwd?, env?, label?, maxRuntimeMs? } → { jobId }
job-status: { jobId } → { status: "running" | "exited" | "killed" | "failed",
                          exitCode?, startedAt, durationMs, bytesOut }
job-output: { jobId, cursor, maxBytes? } →
  { chunks: [{ cursor, stream: "stdout" | "stderr", text }], nextCursor }
job-cancel: { jobId } → { cancelled: boolean }
job-list:   { } → { jobs: [...] }
```

- Buffer circular por job (ex.: 1 MB) + log completo em arquivo temporário.
- `job-output` é incremental por `cursor` para não reenviar tudo ao modelo.
- Backend mantém o registro e emite eventos ao app; o driver mantém o processo.
- `maxRuntimeMs` (ex.: 30 min) encerra o job e mata a árvore.
- Um job é isolado por dispositivo e por chat; `job-list` mostra os ativos.

### 4.6 Rede

Não criar uma tool nova de HTTP no MVP: `curl`/`Invoke-WebRequest` via `shell`
no Modo Construtor. Isso mantém uma única superfície de execução. Se depois for
necessário, criar `http-request` com allowlist de domínios e sem credenciais.

### 4.7 Gui e navegador

- GUI: itens 1–4b já implementados; UIA é o caminho determinístico para apps
  nativos.
- Navegador: item 4c (Playwright), depois que o plano de execução estiver
  estável.

---

## 5. Política, aprovação e auditoria

### 5.1 Dois modos, uma preferência

O modelo é deliberadamente pequeno. O usuário escolhe apenas duas coisas:

1. **Modo da sessão no chat** (`Shift+Tab`): `plan` (Leitura) ou `build`
   (Construtor). Vale só para aquela conversa e fica em `localStorage`.
2. **Confirmação no dispositivo** (Configurações → Dispositivos):
   `confirmDestructive: true` (Pedir confirmação, padrão) ou `false`
   (Poder Total). Vale para todos os chats com aquele PC.

```ts
DeviceExecutionPolicy = {
  confirmDestructive: boolean   // padrão: true
  updatedAt?: string
}
```

Matriz de decisão (`lib/devices/execution-policy.ts`):

| Risco | `plan` | `build` + confirmar | `build` + Poder Total |
|---|---|---|---|
| `read` | allow | allow | allow |
| `input`, `write`, `exec` | deny | allow | allow |
| `destructive`, `system` | deny | approval | allow |

- O Modo Leitura nunca é furado pela preferência do dispositivo.
- As tools expostas ao modelo são filtradas por capability + modo para reduzir
  escolha errada; o contrato permanece estável.
- Defesa em profundidade: o app bloqueia antes de enviar e o driver repete as
  validações de sandbox/denylist.

### 5.2 Aprovação de verdade (item 16)

Fluxo:

1. A tool chama o backend.
2. Backend avalia risco (`read`, `write`, `destructive`, `network`, `system`).
3. Se exige aprovação, cria `ApprovalRequest` e transmite um part
   `data-approval` para o chat.
4. O usuário decide: **permitir uma vez / permitir nesta sessão / negar**.
5. Backend executa ou retorna `approval_denied`; a decisão é auditada.
6. Timeout (ex.: 2 min) nega por padrão.

O modelo nunca recebe a decisão como texto: recebe o resultado da tool.

### 5.3 Auditoria (item 14)

```ts
AuditEvent = {
  id, userId, deviceId, chatId, messageId,
  tool, command, risk, decision, // allowed | denied | auto
  inputHash, summary,            // sem segredos
  ok, code?, exitCode?, durationMs,
  createdAt
}
```

- UI “Atividade do dispositivo” em Configurações → Dispositivos.
- Retenção configurável (ex.: 90 dias).
- Nunca armazenar stdout/stderr brutos; apenas hash/resumo e referência ao job.

### 5.4 Contexto do dispositivo

A coluna `Device.notes` foi aposentada: o contexto por máquina deixou de ser
configurável para manter o modelo simples. O que o modelo precisa saber sobre a
máquina vem de `device-env` e `device-get-os` (shell, runtimes, caminhos,
elevação), e a pasta padrão continua em `defaultWorkingDirectory`.

---

## 6. Formatação de saída para o modelo

- `exitCode` sempre presente; `timedOut` explícito.
- stdout/stderr com teto (padrão 64 KB): manter cabeça e cauda com
  `...[N bytes omitidos]...`; o log completo fica no job/temp e é referenciável.
- Remover ANSI e normalizar CRLF.
- Truncar linhas muito longas (ex.: 2.000 caracteres) sem cortar o começo.
- Erros com `{ code, message, hint?, retryable? }`.
- Sempre devolver `cwd`, `shell` e `durationMs` para o modelo se orientar.
- Resultado de comando é **entrada não confiável**: o prompt deve tratar
  conteúdo de arquivo/saída como dados, não como instruções.

---

## 7. Prompt: “operar a máquina”

Nova seção no system prompt, com regras no estilo Claude Code:

1. Investigue antes de agir: `env`, listar diretório, `grep`.
2. Prefira `shell` para volume/ambiguidade; tools dedicadas para edições
   cirúrgicas.
3. Sempre passe `cwd` explícito; nunca dependa do diretório ambiente.
4. Comandos não interativos: `-y`, `--yes`, `--no-pager`, `-NonInteractive`,
   `CI=1`; nunca `vim`, `more`, `pause`.
5. Verifique `exitCode` e leia `stderr` antes de continuar; não repita o mesmo
   comando às cegas.
6. Verifique o efeito depois de mutar (listar, ler, `stat`).
7. Destrutivo só com aprovação e com o alvo explicado.
8. Saídas pequenas: `head`, `tail`, `Select-Object -First`, `grep`.
9. Windows usa PowerShell; Unix usa bash; não misture sintaxe.
10. Nunca imprima segredos; se um comando puder expor token, não rode.
11. Prefira `apply-patch`/`edit-file` a reescrever o arquivo inteiro.
12. Se não houver CLI, use UIA/mouse/screenshot.

---

## 8. Fases de implementação

### Fase 0 — Fundação (M) — ✅ implementada
- `Device.executionPolicy` (preferência `confirmDestructive`) em
  `db/schema/device.ts`, com UI em Configurações → Dispositivos.
- `DeviceAuditEvent` + registro em `lib/devices/audit.ts` (comando sanitizado,
  sem stdout/stderr).
- Aprovação nativa do AI SDK 7 (`toolApproval` +
  `tool-approval-request` + `addToolApprovalResponse`), com pedidos assinados
  por `experimental_toolApprovalSecret`.
- `get-env` no contrato e no driver (`device-env`): shell padrão, shells,
  runtimes, usuário, home, temp, cwd, elevação, locale e capabilities.

**Pronto quando:** uma tool de risco pede aprovação, é negada, e a negativa
aparece na auditoria. ✅

### Fase 1 — Shell MVP (G) — ✅ implementada (Windows)
- `shell` com script em arquivo temporário, timeout com kill de árvore, saída
  limitada com cabeça/cauda e erros estruturados.
- Matriz de política em `lib/devices/execution-policy.ts`: modo da sessão
  (`plan`/`build`) × preferência do dispositivo (`confirmDestructive`) × risco
  da tool.
- `plan` bloqueia `input`, `write`, `exec`, `destructive` e `system` no app e
  novamente no driver (defesa em profundidade).
- Tools `device-shell` e `device-env`, chip de modo no composer (`Shift+Tab`) e
  card de aprovação no chat.
- Prompt de operação da máquina (`SYSTEM_PROMPT_VERSION = 30`).

**Pronto quando:** “cria um projeto Next, instala dependências e roda o dev”
funciona com aprovação, saída capturada e auditoria; comandos de leitura não
pedem aprovação. ✅ (builds/servidores longos continuam na Fase 3: jobs.)

### Fase 2 — Arquivos e processos (M)
- `mkdir`, `copy`, `move`, `rename`, `delete`, `stat`, `zip`, `unzip`,
  `apply-patch`.
- `list-processes`, `start-process`, `kill-process`.

**Pronto quando:** organizar uma pasta, editar múltiplos trechos de um arquivo e
encerrar um processo funcionam com aprovação e auditoria.

### Fase 3 — Jobs (G)
- `job-start/status/output/cancel/list` + buffer + streaming no chat.
- `maxRuntimeMs`, cancelamento e kill de árvore.

**Pronto quando:** um `npm run dev` fica vivo além de 60 s, a IA lê a saída
incremental e consegue cancelar.

### Fase 4 — Expansão
- Rede via shell (se necessário, `http-request` com allowlist).
- Playwright (4c), sistema (item 9), transferência de arquivos (item 6).

---

## 9. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Execução arbitrária (RCE por design) | opt-in por dispositivo + aprovação + auditoria + denylist + raízes + rate limit |
| Prompt injection vindo de arquivo/saída | tratar saída como dado; aprovação para destrutivo; nunca executar instruções de output |
| Exfiltração de dados | `network: off` por padrão; aprovação para rede; auditoria |
| Escrita fora do sandbox | `resolvePath` + `realpath` + symlink bloqueado + raízes da política |
| Quoting/encoding no Windows | script em arquivo + UTF-8 + sem interpolação |
| Processo órfão | job object / grupo de processos + kill de árvore |
| Driver antigo | capabilities + `capability_unavailable` |
| Contexto explodindo | saída limitada + jobs incrementais + loop com wrap-up |

---

## 10. Fora de escopo (é cérebro, não driver)

- Planejamento, todo list, subagents e memória.
- Cliente MCP, hooks, skills e plugins.
- Escolha de ferramenta, prompt e tratamento de erros pelo modelo.
- Persistência de transcrição e interface de chat.

O driver só precisa ser **previsível, seguro e auditável**. A inteligência mora
acima.

---

## 11. Referências

- Roadmap: [`devices-evolution.md`](./devices-evolution.md) (itens 5, 7, 8, 13,
  14, 15, 16)
- Protocolo e transporte: [`devices-connect.md`](./devices-connect.md)
- Tools atuais: [`chat-device.md`](./chat-device.md)
- Schema: [`schema.md`](./schema.md)
