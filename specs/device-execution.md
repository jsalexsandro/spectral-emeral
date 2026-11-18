# Execução no dispositivo — o driver como “Claude Code sem cérebro”

> **Status:** Fase 0 (fundação), Fase 1 (shell MVP) e Fase 2 de arquivos
> (`mkdir`, `stat`, `copy`, `move`, `delete` para a lixeira e `apply-patch`)
> implementadas. Processos (restante da Fase 2) e jobs (Fase 3) seguem como
> plano. Detalha o item 7 de
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
| Escrever/editar | `Write`, `Edit`, `MultiEdit` | ✅ `write-file`, `edit-file`, `apply-patch` atômico | — |
| Buscar arquivos/texto | `Glob`, `Grep` (rg) | ✅ `glob`, `grep` | — |
| Operações de arquivo | `cp`, `mv`, `rm`, `mkdir`, `stat` | ✅ `mkdir`, `stat`, `copy`, `move`, `delete` (lixeira) | `zip`/`unzip` via shell |
| Abrir aplicativos | `open`/atalhos do sistema | ✅ `open-app`, `list-apps`, `find-app` (descoberta no Windows), `open-path`, `register-app`/`remove-app` | `open-app` com args/cwd é risco `launch` |
| Processos | `ps`, `kill`, `top` | ❌ | item 8 |
| Comandos longos | background + streaming | ❌ teto de 60 s honrado de ponta a ponta, 1 por PC | jobs (item 13) |
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

O orçamento declarado pelo comando (`timeoutMs` de `shell` e `run-command`) é
honrado de ponta a ponta: a tool repassa o valor ao transporte e o backend espera
o orçamento **mais 5s de folga** para receber o resultado depois do kill da
árvore. Sem a folga, um comando que usa os 60s inteiros empata com o timer do
backend e vira `command_timeout` mesmo tendo terminado.

---

## 4. Contrato proposto

### 4.1 `shell` (item 7a) — a primitiva central

Entrada:

```ts
{
  script: string                 // comando único ou script multilinha
  shell?: "auto" | "pwsh" | "powershell" | "cmd" | "bash" | "sh" | "zsh"
  cwd?: string                   // qualquer caminho absoluto; relativo resolve contra a pasta padrão
  timeoutMs?: number             // 1s..60s, honrado no transporte +5s; acima disso use job
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
  processos no Unix), não só o pai. O driver devolve `timedOut: true` e o
  transporte ainda aguarda 5s para entregar esse resultado.
- `env` é allowlist: `PATH`, `HOME`, `TEMP`, etc. + variáveis explícitas.
  Nunca herdar segredos do processo do driver.
- Saída em UTF-8; no Windows, decodificar conforme o code page quando o comando
  externo não emitir UTF-8.
- `cwd` aceita qualquer caminho absoluto na maquina. Caminhos protegidos
  (instalacao do Spectral, System32, WinSxS, Boot) nao podem ser usados como
  `cwd` (`cwd_protected`).

Erros: `unsupported_platform` (macOS/Linux nesta versão), `policy_denied`,
`shell_unavailable`, `cwd_protected`, `cwd_not_found`, `not_a_directory`,
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

### 4.3 Arquivos (itens 5 e 7c) — ✅ implementado

Estado real do contrato em `spectral/shared/device-commands.ts`, executado por
`FileSandbox` (`spectral/driver/src/commands/files.ts`):

| Comando | Entrada | Resultado | Risco | Observação |
|---|---|---|---|---|
| `mkdir` | `{ path, recursive? }` | `mkdir: { path, created }` | write | `recursive` padrão `true`; idempotente quando já é diretório |
| `stat` | `{ path }` | `stat: { path, type, size, modifiedAt, createdAt, mode, isSymlink, linkTarget }` | read | `lstat` sem seguir o último componente |
| `copy` | `{ from, to, overwrite?, recursive? }` | `copy: { from, to, files, bytes }` | write | árvore arquivo por arquivo; symlinks ignorados |
| `move` | `{ from, to, overwrite? }` | `move: { from, to }` | write | `rename` é o caso de mesmo diretório; `EXDEV` copia e apaga |
| `delete` | `{ path, recursive?, permanent? }` | `delete: { path, deleted, toTrash }` | **destructive** | lixeira por padrão; `permanent: true` apaga de vez |
| `apply-patch` | `{ path, patches: [{ oldText, newText, replaceAll? }] }` | `patch: { path, applied, replacements }` | write | atômico; preserva CRLF/BOM; 10 patches / 1 MB |
| `zip`/`unzip` | — | — | — | opcionais via `shell`; zip slip fica fora do contrato |

Regras implementadas:

- Raízes do `FileSandbox` não existem mais: o driver opera na maquina inteira.
  Caminhos relativos resolvem contra a pasta padrão; `~` contra o home.
- Escrita/edicao fora do diretorio de referencia do usuario (home) e classificada
  como destrutiva: pede aprovacao no Modo Construtor, liberada em Poder Total.
- `delete` usa a lixeira do Windows (`Microsoft.VisualBasic.FileIO.FileSystem`,
  `SendToRecycleBin`, timeout de 20 s). Fora do Windows, sem lixeira, retorna
  `unsupported_platform`; `permanent: true` usa `rm` em qualquer plataforma.
- Caminhos protegidos (instalacao do Spectral, System32, WinSxS, Boot) nunca
  podem ser apagados (`path_protected`).
- Diretorio com conteúdo exige `recursive: true`; symlink é removido como link,
  nunca seguido.
- `copy`/`move` validam origem e destino, recusam destino dentro da origem
  (`invalid_destination`) e só substituem com `overwrite: true`.
- `apply-patch` aplica todos os patches ou nenhum: cada `oldText` precisa ocorrer
  exatamente uma vez, salvo `replaceAll: true`; detecta EOL dominante e preserva
  BOM.
- Erros: `path_denied`, `path_protected`, `path_not_found`,
  `parent_not_found`, `path_exists`, `symlink_not_allowed`, `not_a_file`,
  `directory_not_empty`, `directory_requires_recursive`, `protected_path`,
  `destination_not_found`, `invalid_destination`, `permission_denied`,
  `trash_failed`, `text_not_found`, `multiple_matches`, `binary_file`,
  `file_too_large`, `unsupported_platform`.
- Tools no app: `device-mkdir`, `device-stat`, `device-copy`, `device-move`,
  `device-delete`, `device-apply-patch`.

### 4.3b Apps (descoberta, abertura e catálogo local) — ✅ implementado

Descoberta dinâmica no Windows, abertura com argumentos e catálogo local de apps
no driver. Substitui a allowlist fixa e o cadastro manual em Configurações.

| Comando | Entrada | Resultado | Risco | Observação |
|---|---|---|---|---|
| `list-apps` | `{ query?, refresh?, limit? }` | `apps: [{ id, name, source?, target?, args?, cwd? }]` | read | fixos + descobertos + catálogo local (`custom`); `limit` 1–200 |
| `find-app` | `{ query, refresh?, limit? }` | `found`, `query`, `apps[]` | read | busca ranqueada por nome/id/caminho |
| `open-app` | `{ appId?, path?, args?, cwd? }` | `output` com o nome aberto | input sem args; **launch** com args/cwd | exatamente um entre `appId` e `path` |
| `open-path` | `{ path }` | `output` com o caminho aberto | input | recusa extensões de app e a blocklist de scripts/instaladores (ver 4.3c) |
| `register-app` | `{ name, path, args?, cwd? }` | `apps: [{...}]` | write | grava em `~/.spectral/driver/apps.json` |
| `remove-app` | `{ appId }` | `output` de remoção | write | remove do catálogo local |

Regras implementadas:

- Descoberta no Windows (`spectral/driver/src/commands/apps.ts`): atalhos `.lnk`
  do Menu Iniciar do usuário e comum, além de `App Paths` em HKLM (64/32-bit) e
  HKCU. Cache de 5 minutos; `refresh: true` força nova varredura.
- Ids derivam de `deviceAppIdFromTarget(name, target)` (slug + FNV-1a), estáveis
  entre execuções e compatíveis com `DEVICE_APP_ID_PATTERN`. Duplicatas de
  caminho e apps fixos são filtrados.
- `open-app` por `appId` resolve primeiro apps fixos, depois o catálogo local e
  por fim os descobertos; id desconhecido retorna `app_not_found`. `args` (até
  32, máximo 512 chars cada, sem caracteres de controle) e `cwd` (diretório
  existente) acompanham `appId` ou `path`. Com args/cwd o risco é `launch`
  (aprovação no build). Erros: `app_not_found`, `unsupported_app_path`,
  `app_args_unsupported` (atalho com args), `invalid_app_args`,
  `invalid_app_cwd`.
- `open-path` abre arquivo ou pasta no app padrão, sem aprovação. Recusa as
  extensões de app (`invalid_path`) e a blocklist
  `DEVICE_OPEN_PATH_BLOCKED_EXTENSIONS` (scripts, instaladores, documentos com
  macro). No driver a blocklist só vale para arquivos: uma pasta cujo nome
  termina numa extensão bloqueada continua abrindo. Erros: `path_not_found`.
- Catálogo local do driver em `~/.spectral/driver/apps.json` (versão 1, escrita
  atômica, dedupe por caminho, máx. 100). `register-app` valida o caminho na
  hora (`assertLaunchablePath`) e cadastra/atualiza pelo caminho; `remove-app`
  remove pelo id. Aparece em `list-apps` com `source: custom`.
- `Device.customApps` (banco) é importado uma vez para o driver quando o
  dispositivo fica online; cadastro manual em Configurações é retirado. Drop da
  coluna fica para a próxima release.
- Fora do Windows os apps fixos continuam funcionando; a descoberta retorna
  vazia e `find-app` só encontra os fixos. `open-path` funciona em
  macOS/Linux (`open`/`xdg-open`).
- Tools no app: `device-find-app`, `device-list-apps`, `device-open-app`,
  `device-open-path`, `device-register-app`, `device-remove-app`.
- Driver roda em `tsx watch`; dispositivo de teste online.

### 4.3c Teste ao vivo dos apps (2026-11-12) — achados corrigidos

O executor foi exercitado direto (`executeDeviceCommand`), sem passar pelo
`toolApproval`, para validar o driver e a classificação de risco. Resultados:

| Cenário | Resultado |
|---|---|
| `list-apps` com `query: "python"` | catálogo local retorna `source: custom` (`python-3-11-b4ea90`) |
| `find-app` com `query: "zed"` | `zed-7eb333` → `...\Zed\Zed.exe` |
| `open-app` sem args | abre na pasta padrão (home), não no projeto |
| `open-app` com `args: ["."]` + `cwd` do projeto | abre o projeto (`zed .`) |
| `open-app` com `args: ["README.md"]` + `cwd` | abre o arquivo no Zed |
| `open-path` em pasta | abre no Explorer |
| `open-path` em `.exe` | `invalid_path` |
| `register-app` repetido | idempotente, preserva o id |
| `remove-app` de id inexistente | `app_not_found` |
| `run-command` com `taskkill` | `command_not_allowed` (allowlist) |
| `shell` com `Write-Output` | exit 0, saída capturada |

**Achado 1 — `open-path` executava scripts fora da denylist.** Um arquivo
`.vbs` aberto por `open-path` foi executado pelo Windows Script Host via
`rundll32 url.dll,FileProtocolHandler` e criou um arquivo marcador, sem
aprovação. O mesmo valia para `.js`, `.msi`, `.hta`, `.scr`, `.cpl`, `.jar`,
`.reg` e `.url`. **Correção aplicada:** `DEVICE_OPEN_PATH_BLOCKED_EXTENSIONS` no
contrato e no driver, com scripts, instaladores, handlers e documentos com
macro; no driver a checagem roda depois do `stat` e só para arquivos. Coberto
por testes de contrato, do schema da tool e de `parseDeviceCommand`.

**Achado 2 — o fallback via `device-shell` contornava a aprovação de
`launch`.** `device-shell` com `Start-Process <app>.exe -ArgumentList '.'` era
classificado como `exec` e rodava sem aprovação no build com confirmação,
enquanto o mesmo lançamento via `open-app` com `args` era `launch`. **Correção
aplicada:** `LAUNCH_COMMAND_PATTERNS` classifica `Start-Process`, `start`,
`open`, `xdg-open`, `explorer` e a invocação direta de `.exe`/`.cmd` ancorada no
início da linha ou depois de `&`/`;`/`|` como `launch`, sempre depois de
`system` e `destructive`. Coberto por testes de classificação e da matriz
plan/build/Poder Total.

Limites que continuam: os regexes são heurísticos e não são sandbox. Entradas
indiretas como `cmd /c start`, `Invoke-Expression`, `wmic process call create` e
`schtasks` ainda podem lançar apps sem cair no padrão de `launch`. `open-path`
continua abrindo qualquer documento fora da blocklist, e `device-shell` com
script arbitrário continua sendo execução plena no build.

O harness chamou o executor diretamente, então o card Permitir/Negar e a
auditoria não foram exercitados nesse teste; para isso, use o chat do Spectral.

### 4.4 Processos (item 8)

```ts
list-processes: { query?: string; limit?: number } →
  { processes: [{ pid, parentPid, name, command, memoryBytes,
                  startedAt, sessionId }] }

kill-process: { pid: number; force?: boolean; tree?: boolean } →
  { killed: boolean }   // Modo Construtor; sempre aprovação (destructive)
```

- `list-processes` consulta `Get-CimInstance Win32_Process` no Windows; macOS/Linux
  retornam vazio (`unsupported_platform` no driver). Ordenado por memória
  decrescente; `query` filtra nome e linha de comando; `limit` padrão 40, máximo 100.
- `kill-process` encerra **sempre por `pid`** (nunca por nome). `force` aplica
  `taskkill /F`; `tree` aplica `taskkill /T` (mata filhos). Após o `taskkill`, o
  driver verifica se o processo sumiu (até ~2 s) e só então devolve `killed: true`.
- Proteções que retornam `protected_process`: `pid <= 4`; o próprio driver e seus
  ancestrais; processos críticos do Windows (`csrss`, `wininit`, `winlogon`,
  `services`, `lsass`, `dwm`, `svchost`, etc.). Com `tree: true`, qualquer
  descendente protegido também bloqueia o encerramento.
- Nunca matar o próprio driver, o backend ou processos de sistema protegidos.
- `start-process` fica fora desta v1: `open-app`, `device-shell` e jobs já cobrem
  abrir/executar; `cpuPercent` fica fora (exigiria amostragem dupla).

### 4.5 Jobs (item 13) — o que destrava builds e servidores

```ts
job-start:  { script, shell?, cwd?, env?, label?, maxRuntimeMs? } → { jobId }
job-status: { jobId } → { status: "running" | "exited" | "killed" | "failed",
                          exitCode?, startedAt, durationMs, stdoutBytes, stderrBytes,
                          outputChars, truncated, timedOut, cancelled, error? }
job-output: { jobId, cursor, maxBytes? } →
  { chunks: [{ cursor, stream: "stdout" | "stderr", text }], nextCursor, startCursor, truncated }
job-cancel: { jobId } → { cancelled: boolean, job: {...} }
job-list:   { } → { jobs: [...] }
```

- Driver é a fonte da verdade dos jobs; backend só proxy, sem tabela nem migração.
- Buffer circular por job (1 MB) com cursor monotônico de code units UTF-16 no fluxo
  combinado stdout+stderr; `startCursor` indica descarte do começo do buffer.
- `job-output` é incremental por `cursor` para não reenviar tudo ao modelo.
- `maxRuntimeMs` padrão 30 min (mínimo 1s, máximo 60 min); estouro mata a árvore.
- Até 3 jobs simultâneos por dispositivo; quarto `job-start` retorna `job_limit`.
- Job concluído fica retido ~10 min, depois some (`job_not_found`).
- `job-cancel` mata a árvore de processos (`taskkill /T` no Windows, grupo no Unix)
  e não exige aprovação adicional (risco `input`).
- `job-start` é risco `exec`: negado no Modo Leitura, aprovação no Construtor sem
  Poder Total, liberado em Poder Total.
- Reiniciar o driver perde jobs em andamento (documentado).
- Sem PTY/sessão persistente nesta fase; `cwd`/`env` explícitos por comando.
- Sem WebSocket app↔backend: o modelo faz polling pelas tools.
- Windows primeiro; macOS/Linux retornam `unsupported_platform`.

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
| `launch` | deny | approval | allow |
| `destructive`, `system` | deny | approval | allow |

- O Modo Leitura nunca é furado pela preferência do dispositivo.
- As tools expostas ao modelo são filtradas por capability + modo para reduzir
  escolha errada; o contrato permanece estável.
- Defesa em profundidade: o app bloqueia antes de enviar e o driver repete as
  validações de sandbox/denylist.
- Escrita fora do diretorio de referencia do usuario (home) e classificada como
  `destructive`: pede aprovacao no Construtor (salvo Poder Total).
  `device-delete` e comandos perigosos (`rm -rf`, `format`, `shutdown`, etc.)
  continuam sempre `destructive`/`system`.

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
- `plan` bloqueia `input`, `write`, `exec`, `launch`, `destructive` e `system`
  no app e novamente no driver (defesa em profundidade).
- Tools `device-shell` e `device-env`, chip de modo no composer (`Shift+Tab`) e
  card de aprovação no chat.
- Prompt de operação da máquina (`SYSTEM_PROMPT_VERSION = 30`).

**Pronto quando:** “cria um projeto Next, instala dependências e roda o dev”
funciona com aprovação, saída capturada e auditoria; comandos de leitura não
pedem aprovação. ✅ (builds/servidores longos continuam na Fase 3: jobs.)

### Fase 2 — Arquivos e processos (M)

Arquivos — ✅ implementado (Windows):
- `mkdir`, `stat`, `copy`, `move` (renomear incluso), `delete` para a lixeira e
  `apply-patch` atômico; `zip`/`unzip` ficam no `shell`.
- Acesso total a disco: `cwd` e caminhos de arquivo aceitam qualquer caminho
  absoluto. Escrita fora do home e classificada como destrutiva (precisa de
  aprovacao, salvo Poder Total). Caminhos protegidos (Spectral, System32,
  WinSxS, Boot) nunca apagados (`path_protected`).
- `overwrite` explícito, symlinks nunca seguidos.
- Tools `device-mkdir`, `device-stat`, `device-copy`, `device-move`,
  `device-delete` (risco `destructive`) e `device-apply-patch` (risco `write`).
- Prompt atualizado (`SYSTEM_PROMPT_VERSION = 31`).
- macOS/Linux: `delete` sem `permanent` retorna `unsupported_platform`; o
  restante opera por plataforma no driver.

Processos — pendente:
- `list-processes`, `start-process`, `kill-process`.

**Arquivos prontos quando:** organizar uma pasta (criar, copiar, mover, apagar
para a lixeira) e editar vários trechos de um arquivo funcionam com aprovação só
no destrutivo, auditoria e verificação posterior. ✅

**Fase completa quando:** encerrar um processo também funcionar com aprovação e
auditoria.

### P2 — Acesso total a disco (concluído)
- `cwd` aceita qualquer caminho absoluto na maquina; não há mais
  `cwd_outside_root`.
- Arquivos leem/gravam em qualquer caminho; escrita fora do home é
  `destructive` (aprovação no Construtor, direto em Poder Total).
- Caminhos protegidos (instalação do Spectral, System32, WinSxS, Boot)
  bloqueados para `cwd` e exclusão (`cwd_protected`, `path_protected`).
- Deny de credenciais (`.ssh`, `.env`, cookies, chaves privadas) continua ativo.
- Prompt `SYSTEM_PROMPT_VERSION = 35`.

**Pronto quando:** `npm run dev` em qualquer pasta funciona, escrever em
`D:\projeto` pede aprovacao (ou libera em Poder Total) e caminhos protegidos
rejeitam. ✅

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
