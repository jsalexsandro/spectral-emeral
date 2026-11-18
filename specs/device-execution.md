# Execução no dispositivo — o driver como “Claude Code sem cérebro”

> **Status (2026-11-18):** fundação, shell, arquivos, processos, jobs e task
> runner entregues. Prompt **v44**. A escada de execução vai de
> `device-run-command` até `device-job-start`, com `device-run-snippet` e
> `device-setup-toolchain` como caminhos especializados.
>
> **Governança travada:** Poder Total e a opção “Instalação de software sem
> confirmação” (`confirmInstall`) permanecem com os efeitos atuais. Esta entrega
> não altera nem um nem outro: `confirmInstall: false` (padrão) exige aprovação
> para instalação mesmo em Poder Total; `true` libera a instalação sem aprovação
> somente em Poder Total; o Modo Leitura nega sempre.
>
> **Tese:** o driver é o **plano de execução**; o cérebro (LLM, planejamento,
> aprovação e auditoria) fica no app/backend. O driver oferece as primitivas que
> o Claude Code usa para operar uma máquina — shell, arquivos, processos, jobs —
> de forma determinística, versionada e auditável. A GUI/UIA continua como
> diferencial para o que não tem CLI.

---

## 1. Princípios

1. **Contrato primeiro.** Toda capacidade nasce em
   `spectral/shared/device-commands.ts`, com validação, tipo de resultado,
   limites e código de erro. O driver nunca inventa contrato local.
2. **O cérebro não vai para o driver.** Raciocínio, plano, todo list, memória,
   subagents, MCP, hooks e escolha de ferramenta são do app. O driver executa e
   reporta.
3. **Capacidade ≠ permissão.** O driver sabe fazer; o app decide se pode. O
   padrão é o Modo Leitura; ações que mudam a máquina exigem o Modo Construtor.
4. **Aprovação fora da banda do modelo.** Nenhuma ação destrutiva depende de
   “confirme em texto”: a aprovação é um evento do app, que o modelo não
   controla.
5. **Tudo auditável.** Toda execução gera registro com quem, o quê, onde, quando
   e qual foi a decisão.
6. **Saída pensada para o modelo.** `exitCode` sempre; stdout/stderr limitados,
   com cabeça e cauda; erros com `code`, `hint` e `retryable`.
7. **Degradação clara.** Driver antigo ou plataforma sem suporte responde
   `unsupported_platform` / `capability_unavailable`, nunca erro genérico.

---

## 2. Mapa de capacidades

| Capacidade | Spectral hoje | Onde |
|---|---|---|
| Comando curto | ✅ `run-command` — qualquer executável por PATH ou caminho absoluto, argv sem operadores | `commands/files.ts` |
| Shell / scripts | ✅ `shell` — script em arquivo temporário, até 60 s | `commands/shell.ts` |
| Processo longo / servidor | ✅ `job-start/status/output/cancel/list` — até 3 jobs, retenção ~10 min | `commands/jobs.ts` |
| Trecho em linguagem | ✅ `run-snippet` — qualquer linguagem instalada, sem lista fechada | `commands/snippet.ts` |
| Instalar runtime | ✅ `setup-toolchain` — catálogo fechado via winget, governado por `confirmInstall` | `commands/toolchain.ts` |
| Descobrir ambiente | ✅ `env` / `get-os` — shell, runtimes, home, elevação, `capabilities` | `commands/system.ts` |
| Arquivos | ✅ `read`, `write`, `edit`, `glob`, `grep`, `mkdir`, `stat`, `copy`, `move`, `delete` (lixeira), `apply-patch` | `commands/files.ts`, `commands/project.ts` |
| Apps | ✅ `list-apps`, `find-app`, `open-app`, `open-path`, `register-app`, `remove-app`; abertura com args/cwd é risco `launch` | `commands/apps.ts` |
| Processos | ✅ `list-processes`, `kill-process` (sempre por `pid`, proteções de sistema) | `commands/processes.ts` |
| Sistema | ✅ volume, brilho, energia, bloqueio de tela, mídia (Windows-first) | `commands/system.ts`, `commands/windows.ts` |
| Rede | via `shell` no Modo Construtor; sem tool HTTP dedicada | — |
| GUI nativa | ✅ UIA, mouse, screenshot, janelas — diferencial sobre CLI | `commands/windows.ts` |
| Clipboard | ✅ texto | `commands/windows.ts` |
| Task runner na UI | ✅ Configurações → Dispositivos → Tarefas | rotas `/api/devices/[id]/jobs` |
| **Cérebro** | app (LLM, plano, prompt, aprovação, auditoria) | — |

O driver nunca conhece o chat, o modelo ou o prompt — apenas o contrato.

---

## 3. Arquitetura em camadas

```
LLM (app)
  │  tools (descrições e schemas)
  ▼
app: política da sessão (plan/build) + política do dispositivo + aprovação
  │
  ▼
backend/control plane: valida contrato, audita, despacha por WebSocket
  │
  ▼
driver/execution plane: executor.ts → commands/{files,shell,jobs,snippet,toolchain,…}

Task runner (humano): app/app/devices-section.tsx
  │  components/devices/task-runner-dialog.tsx
  ▼
app/api/devices/[id]/jobs[/[jobId]] → lib/devices/job-api.ts → driver
```

- **App:** expõe tools, renderiza aprovação/auditoria e o task runner, e ensina
  o modelo a operar a máquina no prompt. É aqui que `plan` é barrado.
- **Backend:** valida contrato, aplica a decisão da política, cria pedido de
  aprovação, registra auditoria e transmite comandos.
- **Driver:** executa, aplica defesa em profundidade (caminhos protegidos,
  credenciais, timeout, kill de árvore), formata saída. **Não recebe o modo da
  sessão**; a barreira do Modo Leitura é do app.
- **Dados:** `Device.executionPolicy` (`confirmDestructive`, `confirmInstall`),
  `AuditEvent`. Jobs **não** têm tabela: o driver é a fonte da verdade.

### Regra de ouro do transporte

O WebSocket tem `maxPayload` de 4 MB, timeout máximo de 60 s por comando e um
comando em voo por PC:

- execução curta → resposta síncrona;
- acima de 60 s → `job-start` responde com `jobId`; saída é lida por cursor;
- binários grandes → canal separado, nunca base64 no comando.

O orçamento declarado (`timeoutMs` de `shell`/`run-command`) é honrado de ponta a
ponta: a tool repassa o valor ao transporte, que espera o orçamento **+5 s** de
folga para receber o resultado depois do kill da árvore.

---

## 4. Escada de execução (prompt v44)

Use a ferramenta mais baixa que resolve:

| Degrau | Ferramenta | Quando | Limite |
|---|---|---|---|
| 1 | `device-run-command` | um executável com `args` | argv validado, 15 s padrão / 60 s máx., 64 KB |
| 2 | `device-shell` | script de shell curto | 30 s padrão / 60 s máx., 64 KB por stream |
| 3 | `device-job-start` | processo longo ou servidor | 30 min padrão / 60 min máx., 3 jobs por PC |
| Especialista | `device-run-snippet` | trecho em linguagem específica | ~30 s, ~60k chars por stream |
| Especialista | `device-setup-toolchain` | instalar runtime do catálogo | via winget, como job, governado por `confirmInstall` |

Um comando simples não vira script; um script não vira job por hábito.
`device-open-app` continua sendo o caminho para **lançar aplicativos**; abrir com
`args` ou `cwd` é risco `launch`.

### 4.1 `run-command`

```ts
{
  command: string       // nome no PATH ou caminho absoluto; sem allowlist/denylist
  args?: string[]       // argv: operadores e aspas são recusados no parsing
  timeoutMs?: number    // 15s padrão, 60s máx.
  cwd?: string          // resolveWorkingDirectory: protegidos viram cwd_protected
}
```

- O parsing bloqueia `; & | \` $ < > ( ) { } [ ] \ " '`, CR/LF e NUL tanto em
  `command` quanto em cada `arg`. Não há interpretação de shell.
- Interpretadores com `-c`/`-e` (incluindo `cmd /c`) retornam
  `inline_script_denied`; use `device-shell` ou `device-run-snippet`.
- Instalação de runtime retorna `runtime_install_denied`; use
  `device-setup-toolchain`.
- Limites: `DEVICE_RUN_ARGS_MAX_LENGTH = 1024`, `DEVICE_RUN_OUTPUT_MAX_BYTES =
  64 KB`.
- Na política do app, comandos comuns (`node`, `git`, `npm run build`, `curl`)
  são `exec`. Caminhos absolutos de `.exe` continuam caindo na heurística
  preservada `LAUNCH_COMMAND_PATTERNS` e viram `launch`.

### 4.2 `shell`

```ts
{
  script: string
  shell?: "auto" | "pwsh" | "powershell" | "cmd" | "bash" | "sh" | "zsh"
  cwd?, env?, stdin?, timeoutMs?, maxOutputBytes?
}
```

- Script sempre em arquivo temporário; nunca interpolado em linha de comando.
- Timeout mata a **árvore** de processos (job object no Windows, grupo no Unix).
- `env` é allowlist: variáveis do driver **não** são herdadas.
- Saída: `exitCode`, `stdout`, `stderr`, contadores, `durationMs`, `truncated`,
  `timedOut`. `exitCode` diferente de zero não é `ok: false`.
- mac/Linux retornam `unsupported_platform` nesta versão.

### 4.3 Jobs

```ts
job-start:  { script, shell?, cwd?, env?, label?, maxRuntimeMs? } → { jobId }
job-status: { jobId } → { status: running|exited|killed|failed, exitCode?,
                          startedAt, durationMs, stdoutBytes, stderrBytes,
                          truncated, timedOut, cancelled, error? }
job-output: { jobId, cursor, maxBytes?, waitMs? } →
              { chunks: [{ cursor, stream: stdout|stderr, text }],
                nextCursor, startCursor, status, exitCode, cancelled }
job-cancel: { jobId } → { cancelled, job }
job-list:   { } → { jobs: [...] }
```

- Buffer circular de 1 MB; cursor monotônico em code units UTF-16 do fluxo
  combinado. `startCursor` maior que o pedido indica descarte do começo.
- `waitMs` (5–10 s) segura a chamada até saída nova ou fim do job, evitando
  polling em rajada.
- `maxRuntimeMs`: 1 s–60 min, padrão 30 min; estouro mata a árvore.
- 3 jobs simultâneos por dispositivo; quarto retorna `job_limit`.
- Concluído fica retido ~10 min; depois `job_not_found`.
- `job-cancel` é risco `input` e não exige aprovação adicional;
  `cancelled: false` significa que o job já tinha terminado.
- `job-start` é `exec` na política do app: negado no Modo Leitura e liberado no
  Construtor; riscos `install`/`system`/`destructive` no script são classificados
  pelo texto.

### 4.4 `run-snippet` e `setup-toolchain`

- `run-snippet`: qualquer linguagem instalada; descritores curados para
  node/python/go/rust/java/dotnet/ruby/php/c/cpp e fallback genérico; `rust`,
  `c`, `cpp` compilam e executam; `java` usa single-file source. Código que
  instala runtime é barrado com `runtime_install_denied`.
- `setup-toolchain`: catálogo fechado (`node`, `pnpm`, `yarn`, `bun`, `python`,
  `uv`, `git`, `go`, `rust`, `dotnet`, `java`), sem `version`, `packageId` ou
  flags do winget escolhidos pelo modelo. `packageId`/`version` vazios retornam
  `invalid_package_id`/`invalid_version`. Já instalado devolve
  `already_installed`. Depois do job, `device-env` com `refresh: true`.

---

## 5. Barreiras inegociáveis

### 5.1 No app

- **Modo Leitura (`plan`)** nega toda mutação, independente de Poder Total ou
  `confirmInstall`. É a primeira checagem de `evaluateDeviceToolCall`.
- **Poder Total** (`confirmDestructive: false`) libera `destructive`, `system` e
  `launch`, mas **não** altera o comportamento de `install`.
- **`confirmInstall`**: `false` (padrão) exige aprovação para `install` mesmo em
  Poder Total; `true` libera sem aprovação somente em Poder Total; `plan`
  nega sempre. O ramo `install` de `evaluateDeviceToolCall` é explícito.
- **`LAUNCH_COMMAND_PATTERNS` e `INSTALL_COMMAND_PATTERNS`** continuam ativos.
  A heurística de `launch` cobre `Start-Process`, `start`, `open`, `xdg-open`,
  `explorer` e `.exe`/`.cmd` invocado diretamente; `system` e `destructive` vêm
  primeiro. `INSTALL_COMMAND_PATTERNS` também classifica `job-start` e
  `run-snippet` pelo texto executável.

### 5.2 No driver

Defesa em profundidade, independente da decisão do app:

- Caminhos protegidos (instalação do Spectral, System32, WinSxS, Boot) e
  credenciais (`.ssh`, `.env`, cookies, chaves privadas) continuam barrados.
- `runtime_install_denied`: `shell`, `job-start`, `run-snippet` e `run-command`
  recusam instalação de runtime fora de `setup-toolchain`, mesmo em Poder Total.
- `inline_script_denied`: interpretador com `-c`/`-e` em `run-command`.
- `cwd_protected`: usado por `shell`, `jobs`, `snippet` e `run-command`, inclusive
  quando vem de `defaultFolder`.
- Segredos do processo do driver nunca são herdados por `env`.
- `job_limit`, kill de árvore, timeout e limites de saída.

> As duas camadas são complementares: o app decide **se pode**; o driver garante
> **como** executa. Uma decisão permissiva do app nunca desliga uma barreira do
> driver.

---

## 6. Política, aprovação e auditoria

### 6.1 Entradas

```ts
DeviceExecutionPolicy = {
  confirmDestructive: boolean  // padrão true; false = Poder Total
  confirmInstall: boolean      // padrão false; true = libera install em Poder Total
  updatedAt?: string
}
```

O usuário escolhe no chat o **modo da sessão** (`Shift+Tab`: Leitura ou
Construtor) e no dispositivo as duas confirmações. O toggle “Instalação de
software sem confirmação” continua em `app/app/devices-section.tsx` e segue no
payload de `renameDeviceSchema`.

### 6.2 Matriz (`lib/devices/execution-policy.ts`)

| Risco | `plan` | `build` + confirmar | `build` + Poder Total |
|---|---|---|---|
| `read` | allow | allow | allow |
| `input`, `write`, `exec` | deny | allow | allow |
| `launch` | deny | approval | allow |
| `destructive`, `system` | deny | approval | allow |
| `install` (`confirmInstall: false`) | deny | approval | **approval** |
| `install` (`confirmInstall: true`) | **deny** | approval | **allow** |

Escrita fora do home é `destructive`; `device-delete` e padrões como `rm -rf`,
`format`, `shutdown` permanecem `destructive`/`system`.

### 6.3 Aprovação e auditoria

1. A tool chama o backend.
2. O backend classifica o risco e avalia modo + política.
3. Se exigir aprovação, cria `ApprovalRequest` e envia `data-approval` ao chat.
4. O usuário decide: permitir uma vez / permitir nesta sessão / negar.
5. O backend executa ou retorna `approval_denied`; a decisão é auditada.
6. Timeout (ex.: 2 min) nega por padrão.

O modelo nunca recebe a decisão como texto, só o resultado da tool. O registro
de auditoria guarda `tool`, `command`, `risk`, `decision`, hash/resumo e
`ok`/`code`/`exitCode`/`durationMs` — nunca stdout/stderr brutos.

---

## 7. Task runner por dispositivo

Observabilidade para o humano; **nenhum estado novo é duplicado**.

- `lib/devices/job-api.ts`: posse do dispositivo (`userId`, não revogado), rate
  limit (60 chamadas / 10 s por rota) e tradução de código de erro para HTTP.
- `GET/POST /api/devices/[id]/jobs` — listar e iniciar jobs.
- `GET/POST /api/devices/[id]/jobs/[jobId]` — status, saída por `cursor` e
  cancelamento (`view=status|output`, `waitMs`, `maxBytes`).
- `components/devices/task-runner-dialog.tsx` — lista, inicia, lê saída e
  cancela; visível em Configurações → Dispositivos → **Tarefas**, só para
  dispositivos online.
- Schemas em `lib/validations/device.ts`: `startDeviceJobSchema`,
  `deviceJobQuerySchema`, `deviceJobIdSchema`.
- Rotas exigem sessão autenticada e posse do dispositivo; o driver continua
  sendo a única fonte da verdade dos jobs.

---

## 8. Prompt e descrições das tools

- `SYSTEM_PROMPT_VERSION = 44`, com changelog em `lib/ai/prompts/registry.ts`.
- `lib/ai/prompts/sections/devices.ts` documenta a escada, as barreiras do
  driver, o task runner e a tradução de `inline_script_denied` /
  `runtime_install_denied` / `cwd_protected`.
- O texto de instalação/Poder Total foi mantido, inclusive a orientação de que
  `device-setup-toolchain` pede aprovação no Modo Construtor.
- `setupToolchainDescription` permanece com o texto original: instalação,
  desinstalação e atualização exigem aprovação caso a caso, **salvo quando o
  dispositivo está em Poder Total com a opção “Instalação de software sem
  confirmação” ligada**. O Modo Leitura nega sempre.
- Descrições de `run-command`, `shell`, `job-start` e `run-snippet` refletem a
  escada e as barreiras; nenhuma delas declara `confirmInstall` sem efeito.

---

## 9. Estado das fases

| Fase | Estado |
|---|---|
| 0 — Fundação (política, auditoria, aprovação, `env`) | ✅ |
| 1 — Shell MVP (Windows) | ✅ |
| 2 — Arquivos e processos | ✅ |
| P2 — Acesso total a disco | ✅ |
| 3 — Jobs (buffer, cursor, cancelamento) | ✅ |
| 3b — Task runner no app | ✅ |
| 4 — Expansão (rede HTTP dedicada, Playwright, transferência de arquivos) | pendente |

Validação da entrega: `npm run typecheck`, `npm run lint` e `npm test` verdes
(53 arquivos de teste, 497 testes). `specs/add.md` e `added.md` são rascunhos
fora do commit.

---

## 10. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Execução arbitrária (RCE por design) | opt-in por dispositivo + aprovação + auditoria + barreiras do driver + rate limit |
| Contorno de aprovação por shell/job/snippet | `LAUNCH_COMMAND_PATTERNS` e `INSTALL_COMMAND_PATTERNS` no app; `runtime_install_denied` no driver |
| Prompt injection vindo de arquivo/saída | tratar saída como dado; aprovação para destrutivo; nunca executar instruções de output |
| Exfiltração de dados | sem tool HTTP dedicada; `env` sem segredos do driver; auditoria |
| Caminhos protegidos/credenciais | `resolvePath` + `realpath` + `cwd_protected` + `path_protected` |
| Quoting/encoding no Windows | argv sem operadores em `run-command`; script em arquivo; UTF-8 |
| Processo órfão | job object / grupo de processos + kill de árvore |
| Driver antigo | `capabilities` + `capability_unavailable` |
| Contexto explodindo | saída limitada + jobs incrementais + loop com wrap-up |
| Heurística incompleta de `launch` | regexes são heurística, não sandbox; entradas indiretas (`cmd /c start`, `Invoke-Expression`, `schtasks`) seguem fora do padrão e devem ser tratadas com cautela |

---

## 11. Fora de escopo (é cérebro, não driver)

- Planejamento, todo list, subagents e memória.
- Cliente MCP, hooks, skills e plugins.
- Escolha de ferramenta, prompt e tratamento de erros pelo modelo.
- Persistência de transcrição e interface de chat.

O driver só precisa ser **previsível, seguro e auditável**. A inteligência mora
acima.

---

## 12. Referências

- Roadmap: [`devices-evolution.md`](./devices-evolution.md) (itens 5, 7, 8, 13,
  14, 15, 16)
- Protocolo e transporte: [`devices-connect.md`](./devices-connect.md)
- Tools atuais: [`chat-device.md`](./chat-device.md)
- Schema: [`schema.md`](./schema.md)
