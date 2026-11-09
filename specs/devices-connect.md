# Dispositivos (Devices
# Sistema de conexão

Módulo de emparelhamento e presença de computadores conectados à conta. A UI
fica em **Configurações → Dispositivos**; o gerenciamento HTTP roda no app
Next.js e o servidor de sockets é um serviço independente.

## Arquitetura

- `app/api/devices/**`: fonte de verdade do domínio (sessão, propriedade, códigos).
- `spectral/backend`: servidor WebSocket (`ws`) que autentica o driver consultando
  o mesmo PostgreSQL. Expõe também um endpoint HTTP interno na mesma porta para o
  app enviar comandos ao driver. Não expõe HTTP de gerenciamento.
- `spectral/driver`: CLI executada no dispositivo, com identidade local, reconexão e
  executor de comandos.
- `spectral/shared/device-commands.ts`: contrato puro (sem dependências) de comandos,
  validação e resultados, compartilhado por backend, driver e app.
- Pacotes independentes (`package.json`, `tsconfig.json` e `node_modules` próprios).

```text
Driver --HTTP--> Next.js (/api/devices/pairing...) --SQL--> PostgreSQL
Driver --WS----> spectral/backend (auth + heartbeat + comandos) --SQL--> PostgreSQL
App    --HTTP--> Next.js (/api/devices)              --SQL--> PostgreSQL
Next   --HTTP interno--> spectral/backend (/internal/devices/:id/commands)
```

## Emparelhamento

1. O driver gera (ou carrega) um par de chaves Ed25519 em
   `~/.spectral/driver/identity.json` (permissão `0600`).
2. `POST /api/devices/pairing` recebe a chave pública, hostname, plataforma e
   arquitetura. O servidor gera um código de 6 caracteres, guarda apenas o
   HMAC-SHA256 e devolve `{ sessionId, code, expiresAt, pollIntervalMs }`.
3. O usuário informa o código em Configurações → Dispositivos.
4. `POST /api/devices/pairing/confirm` valida o código e, em transação, bloqueia
   a sessão (`FOR UPDATE`), verifica expiração/uso, impede duplicidade ativa do
   mesmo fingerprint e cria o `Device`.
5. O driver consulta `GET /api/devices/pairing/:id`, recebe `paired` com
   `deviceId` e persiste o vínculo na identidade local.
6. O driver abre o WebSocket e autentica por desafio/assinatura.

### Regras do código

- Alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 símbolos; sem `O`, `0`, `I`, `1`).
- 6 caracteres, TTL de 5 minutos, uso único.
- Hash com `DEVICE_PAIRING_SECRET`; se ausente, usa `AUTH_SECRET`.
- O código nunca é gravado no banco, logado no servidor ou incluído em erros.
- Respostas de confirmação: `invalid_code` (404), `expired_code` (410),
  `used_code` (409), `already_paired` (409).
- Rate limit em memória (single-instance): 10 solicitações/min por IP e
  5 confirmações/min por usuário.

## HTTP

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/devices/pairing` | Driver | Solicita código |
| `GET` | `/api/devices/pairing/:id` | Driver | Consulta estado (`pending`, `paired`, `expired`) |
| `POST` | `/api/devices/pairing/confirm` | Usuário | Confirma o código |
| `GET` | `/api/devices` | Usuário | Lista dispositivos ativos |
| `GET` | `/api/devices/:id` | Proprietário | Consulta um dispositivo |
| `PATCH` | `/api/devices/:id` | Proprietário | Renomeia |
| `DELETE` | `/api/devices/:id` | Proprietário | Revoga (soft delete) |
| `GET` | `/api/devices/:id/screenshots/:screenshotId` | Proprietário | Serve uma captura temporária (15 min) |

Toda operação de gerenciamento deriva o `userId` da sessão autenticada. O
frontend nunca informa o proprietário.

## Protocolo WebSocket

Transporte `ws://` em desenvolvimento e `wss://` atrás de TLS em produção.

| Evento | Direção | Finalidade |
| --- | --- | --- |
| `device:authenticate` | Driver → Backend | Envia `deviceId` e `fingerprint` |
| `device:challenge` | Backend → Driver | Desafio aleatório de 32 bytes (30s) |
| `device:authenticate:proof` | Driver → Backend | Assinatura Ed25519 do desafio |
  | `device:authenticated` | Backend → Driver | Confirmação + parâmetros de heartbeat e `defaultFolder` (pasta padrão do dispositivo) |
| `device:heartbeat` | Driver → Backend | Sinal de vida |
| `device:heartbeat:ack` | Backend → Driver | Confirmação do heartbeat |
| `device:command` | Backend → Driver | Comando com `id`, `command` e `input` |
| `device:command:result` | Driver → Backend | Resultado correlacionado por `id` |
| `device:disconnect` | Driver → Backend | Encerramento voluntário |
| `device:error` | Backend → Driver | Erro com `code` estável antes do fechamento |

- Heartbeat a cada 15s; timeout de 45s sem heartbeat encerra a conexão.
- Autenticação deve concluir em 10s.
- Uma conexão ativa por dispositivo; uma nova autenticação fecha a anterior
  com `4001` (`replaced`).
- `lastSeenAt` é atualizado no authenticate e em cada heartbeat. O app considera
  online quando `now - lastSeenAt <= 45s`.
- Cada heartbeat consulta a revogação de forma condicional; dispositivo revogado
  recebe `revoked_device` e o socket é fechado.
- `maxPayload` de 4 MB por padrão (`DEVICE_WS_MAX_PAYLOAD_BYTES`), necessário
  para transportar screenshots em base64, e rate limit em memória por IP.

### Códigos de fechamento

| Código | Motivo |
| --- | --- |
| `4001` | Conexão substituída |
| `4002` | Heartbeat expirado |
| `4003` | Timeout de autenticação |
| `4004` | Dispositivo revogado |
| `4005` | Dispositivo desconhecido |
| `4006` | Falha de autenticação |
| `4007` | Rate limit |
| `4008` | Mensagem inválida |
| `4009` | Erro interno |
| `4010` | Backend encerrando |

## Comandos remotos

Fluxo de uma tool do chat até o dispositivo:

```text
Tool (Next.js) --POST /internal/devices/:id/commands--> Backend
Backend --device:command (id)--> Driver
Driver --device:command:result (id)--> Backend
Backend --HTTP 200 { ok, result }--> Tool
```

- O endpoint interno usa a mesma porta do WebSocket (`4001`) e exige o header
  `x-internal-secret`, comparado com `SPECTRAL_INTERNAL_SECRET` (fallback
  `AUTH_SECRET`) em tempo constante.
- O backend valida que o dispositivo existe, não está revogado e pertence ao
  `userId` informado antes de encaminhar o comando.
- Cada comando recebe um `id` (`randomUUID`) e aguarda o resultado correlacionado.
- Um comando em voo por dispositivo; tentativas concorrentes recebem
  `device_busy` (409).
- Timeout padrão de 15s (`DEVICE_COMMAND_TIMEOUT_MS`), limitado a 60s. O driver
  executa os comandos em fila, na ordem de chegada.
- Se o dispositivo desconectar, o backend falha o comando pendente com
  `device_disconnected`.

### Comandos disponíveis

| Comando | Input | Resultado |
| --- | --- | --- |
| `open-url` | `{ url }` | `ok` |
| `open-app` | `{ appId }` | `ok` + `output` |
| `list-apps` | `{}` | `ok` + `apps[{ id, name }]` |
| `get-os` | `{}` | `ok` + `os{ platform, type, release, version, architecture, elevated }` |
| `type-text` | `{ text, windowId? }` | `ok` + `window` |
| `press-key` | `{ key, modifiers?, windowId? }` | `ok` + `window` |
| `read-clipboard` | `{}` | `ok` + `clipboard{ text, length, truncated }` |
| `write-clipboard` | `{ text }` | `ok` |
| `list-windows` | `{ includeMinimized?, limit? }` | `ok` + `windows[{ id, title, processId, processName, bounds, focused, minimized }]` |
| `focus-window` | `{ windowId }` | `ok` + `window` |
| `minimize-window` | `{ windowId }` | `ok` + `window` |
| `maximize-window` | `{ windowId }` | `ok` + `window` |
| `restore-window` | `{ windowId }` | `ok` + `window` |
| `close-window` | `{ windowId }` | `ok` |
| `screenshot` | `{ monitor?, region?, maxWidth, quality, format }` | `ok` + `screenshot{ id, width, height, scale, monitor, region, format, byteLength, capturedAt }` + `imageBase64` |
| `list-files` | `{ path?, depth?, showHidden?, maxEntries? }` | `ok` + `entries[]`, `total`, `truncated` |
| `read-file` | `{ path, offset?, limit? }` | `ok` + `file{ content, startLine, endLine, totalLines, truncated, size }` |
| `glob` | `{ pattern, path?, showHidden?, maxResults? }` | `ok` + `paths[]`, `total`, `truncated` |
| `grep` | `{ pattern, path?, glob?, caseSensitive?, maxResults? }` | `ok` + `matches[]`, `filesScanned`, `truncated` |

### Validação e allowlist

- `open-url`: apenas `http://` e `https://`, até 2048 caracteres, sem
  usuário/senha na URL.
- `open-app`: `appId` no padrão `^[a-z0-9][a-z0-9-]{0,39}$` e presente na
  allowlist do driver (`chrome`, `edge`, `firefox`, `notepad`, `explorer`,
  `vscode`, `terminal`, `calculator`).
- `get-os`: sem input; retorna `platform`, `type`, `release`, `version` e
  `architecture` do `node:os` do driver.
- `type-text`: 1 a 2000 caracteres; caracteres de controle são rejeitados
  (exceto tab, CR e LF). `windowId` opcional (até 128 caracteres) faz o driver
  focar a janela antes de digitar.
- `press-key`: teclas `a-z`, `0-9`, `enter`, `tab`, `escape`, `backspace`,
  `delete`, `space`, `insert`, setas, `home`, `end`, `pageup`, `pagedown` e
  `f1`-`f12`; modificadores `ctrl`, `alt`, `shift` e `meta`. `windowId` opcional
  faz o driver focar a janela antes da tecla.
- `read-clipboard`: sem input; lê apenas texto. O conteúdo é limitado a 100 mil
  caracteres; quando maior, `text` vem cortado, `truncated` é `true` e `length`
  informa o tamanho original. Quando não há texto no clipboard, a leitura tende
  a voltar vazia; falhas reais retornam `clipboard_unavailable`.
- `write-clipboard`: `text` obrigatório de 1 a 100 mil caracteres; caracteres de
  controle são rejeitados (exceto tab, CR e LF). Falhas de escrita retornam
  `clipboard_write_failed`.
- `read-clipboard`/`write-clipboard` usam `Get-Clipboard`/`Set-Clipboard` no
  Windows (via PowerShell), `pbpaste`/`pbcopy` no macOS, `wl-paste`/`wl-copy` no
  Wayland e `xclip` com fallback para `xsel` no Linux X11. Wayland sem
  `wl-clipboard` retorna `unsupported_environment`; X11 sem `xclip`/`xsel`
  retorna `dependency_missing`.
- `list-windows`: `limit` entre 1 e 30 (padrão 20); `includeMinimized` padrão
  `false`; título truncado em 120 e nome do processo em 80 caracteres.
- `focus-window`: `windowId` obrigatório no padrão `^[A-Za-z0-9:._-]+$`.
  Retorna `window_not_found` se a janela sumiu e `focus_denied` se o SO bloquear
  o foco. No Wayland retorna `unsupported_environment`.
- `minimize-window`, `maximize-window`, `restore-window` e `close-window`:
  `windowId` obrigatório no mesmo padrão. Os três primeiros retornam
  `ok: true` + `window` com o snapshot atualizado; `close-window` retorna
  `ok: true`.
- `close-window` é gracioso: Windows usa `PostMessage(WM_CLOSE)`, macOS
  pressiona o botão de fechar via System Events e Linux usa `wmctrl -c`. O app
  pode abrir um diálogo para salvar e continuar aberto; não há força bruta nem
  encerramento por processo.
- `minimize-window`/`maximize-window`/`restore-window` usam `ShowWindow`
  (6/3/9) no Windows, `AXMinimized`/`AXFullScreen` no macOS e
  `wmctrl -b add,hidden`, `add,maximized_vert,maximized_horz` e
  `remove,hidden,maximized_vert,maximized_horz` no Linux X11.
- `alt+F4` e `ctrl+alt+delete` são bloqueados no contrato e no driver.
- `screenshot`: sem `monitor`/`region` captura a tela inteira virtual; `monitor`
  é índice 0-based; `region` é `{ x, y, width, height }` em coordenadas do
  sistema. `maxWidth` entre 320 e 3840 (padrão 1280), `quality` entre 30 e 90
  (padrão 70) e `format` `jpeg`/`png` (padrão `jpeg`). O driver captura em PNG
  nativo e reduz a largura progressivamente até caber em 400 KB. O resultado
  carrega `imageBase64` no WebSocket; o app salva os bytes em arquivo temporário
  com TTL de 15 min, devolve apenas metadados ao histórico e anexa a imagem ao
  modelo via `toModelOutput`. Windows usa PowerShell + .NET; macOS usa
  `screencapture`/`sips`; Linux X11 usa `import`/`convert`/`identify`/`xrandr` e
  Wayland retorna `unsupported_environment`.
- `list-files`: caminho padrão é a pasta do usuário; `depth` entre 1 e 3;
  `maxEntries` entre 1 e 500 (padrão 200); não segue links simbólicos.
- `read-file`: caminho obrigatório; `offset` a partir de 1; `limit` entre 1 e
  2000 (padrão 2000); máximo de 1 MB no disco e 64 KB / 2000 linhas retornadas;
  arquivos binários são rejeitados.
- `glob`: `pattern` obrigatório (máx. 256 caracteres); `maxResults` entre 1 e
  200 (padrão 100); ignora `node_modules`, `.git`, `dist`, `build` e pastas
  grandes por padrão.
- `grep`: `pattern` obrigatório (expressão regular, máx. 256 caracteres);
  `caseSensitive` padrão `false`; `maxResults` entre 1 e 200 (padrão 100);
  máximo de 2.000 arquivos e 50 MB escaneados; arquivos binários são ignorados.
- Leitura de arquivos é restrita à pasta do usuário com denylist de caminhos
  sensíveis (`.ssh`, `.gnupg`, `.aws`, credenciais, perfis de navegador,
  arquivos do sistema). Links simbólicos no caminho alvo são rejeitados.
- O driver usa `execFile`/`spawn` com argumentos separados (sem shell
  interpolado), `windowsHide` e timeout de execução de 10s.
- `type-text` e `press-key` agem sobre a janela em foco quando não recebem
  `windowId`; com `windowId`, o driver foca a janela e executa a ação no mesmo
  comando. O prompt exige confirmação em texto antes de conteúdo sensível e
  proíbe senhas.
- O clipboard pode conter dados sensíveis: a leitura deve ser pedida pelo
  usuário e a escrita deve avisar que substitui o conteúdo atual. Nenhum dos dois
  comandos persiste o texto no histórico além do resultado da tool.
- Janelas são listadas/focadas com APIs nativas: PowerShell + P/Invoke no
  Windows, System Events no macOS (exige Acessibilidade) e `wmctrl`/`xdotool`
  no Linux X11. Wayland não permite enumerar/controlar janelas globalmente e
  retorna `unsupported_environment`.

## Driver

```bash
npm run install:services     # instala dependências dos dois pacotes
npm run dev:backend          # inicia o WebSocket em :4001
npm run dev:driver           # inicia o driver (emparelha se necessário)
npm run pair:driver          # força uma nova solicitação de código
```

O driver deve ser iniciado com privilégios de administrador (PowerShell como
Administrador ou `sudo`) para comandos que exigem elevação; o console exibe o
status elevado. Para esta fase, as tools de leitura de arquivos funcionam com
privilégios normais, mas o driver elevado expande o escopo futuro.

O backend e o driver carregam o `.env` da raiz automaticamente, sem sobrescrever
variáveis já definidas no ambiente. O driver também aceita um `.env` local em
`spectral/driver/.env` com prioridade sobre o da raiz.

Variáveis do driver:

- `SPECTRAL_API_URL` (padrão `http://localhost:3000`)
- `SPECTRAL_WS_URL` (padrão `ws://localhost:4001`)
- `SPECTRAL_DRIVER_HOME` (padrão `~/.spectral/driver`)

Variáveis do backend:

- `DATABASE_URL`
- `SPECTRAL_WS_HOST` (padrão `0.0.0.0`)
- `SPECTRAL_WS_PORT` (padrão `4001`)
- `DEVICE_HEARTBEAT_TIMEOUT_MS` (padrão `45000`)
- `DEVICE_COMMAND_TIMEOUT_MS` (padrão `15000`, máximo `60000`)
- `DEVICE_WS_MAX_PAYLOAD_BYTES` (padrão `4194304`)
- `SPECTRAL_INTERNAL_SECRET` (fallback `AUTH_SECRET`)

Variáveis do app Next.js:

- `SPECTRAL_BACKEND_URL` (padrão `http://localhost:4001`)
- `SPECTRAL_INTERNAL_SECRET` (fallback `AUTH_SECRET`)
- `SPECTRAL_SCREENSHOT_DIR` (padrão `<tmp>/spectral-screenshots`)

O driver reautentica em cada reconexão com a chave privada local, usando backoff
exponencial com jitter. Se receber `revoked_device` ou `unknown_device`, encerra
e orienta executar `--pair`. Se outra instância assumir o dispositivo
(`replaced`), esta instância encerra.

## Segurança e limitações

- A chave privada nunca sai do dispositivo; o servidor guarda apenas a pública.
- Fingerprint = SHA-256 (base64url) do DER SPKI; apenas chaves Ed25519 são aceitas.
- Revogação é lógica e encerra o socket ativo no próximo heartbeat (≤15s).
- Rate limit, mapa de sockets e comandos pendentes são em memória; múltiplas
  instâncias exigiriam Redis (ou equivalente) para presença e coordenação.
- O endpoint HTTP interno exige segredo compartilhado e nunca deve ser exposto
  publicamente; em produção, mantenha-o na rede privada ou atrás do proxy.
- No Windows, `chmod 0600` é emulado de forma limitada; proteja o diretório do
  usuário com as permissões do sistema.
- O executor lista, foca, minimiza, maximiza, restaura e fecha janelas, captura
  tela e lê/escreve o clipboard sob comando explícito. Screenshots trafegam em
  base64 pelo WebSocket e ficam no máximo 15 minutos em disco temporário; não são
  persistidos no histórico. O clipboard aceita apenas texto, com limite de 100 mil
  caracteres. Arquivos são restritos à pasta do usuário com denylist (leitura,
  escrita e edição); não há shell arbitrário nem execução fora da allowlist.

## Próximos passos

O roadmap de evolução (mouse, `run-command` em camadas, aprovação, auditoria e
instalador) está em
[`specs/devices-evolution.md`](./devices-evolution.md).
