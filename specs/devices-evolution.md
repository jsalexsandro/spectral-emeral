# Evolução dos dispositivos (roadmap)

> **Status:** roadmap vivo. Os itens marcados com ✅ já estão implementados e
> documentados em [`specs/chat-device.md`](./chat-device.md).
> **Escopo atual:** PC (Windows, macOS e Linux). Celular e TV Android ainda não
> são suportados.

O sistema de devices é o carro chefe do Spectral, mas hoje está limitado a
comandos pontuais e a uma IA que não enxerga o resultado das próprias ações.
Este documento organiza o que falta, por que cada item importa, onde mexer e
qual é a ordem recomendada.

## Estado atual

O que já existe e funciona:

- Emparelhamento por código, presença por heartbeat e revogação
  (`specs/devices-connect.md`).
- Gestão em Configurações → Dispositivos: listar, renomear, revogar e definir a
  pasta padrão.
- Tools de chat: `device-list`, `device-online-list`, `device-get-os`,
  `device-env`, `device-list-apps`, `device-find-app`, `device-open-url`,
  `device-open-app`, `device-open-path`, `device-register-app`,
  `device-remove-app`,
  `device-type-text`, `device-press-key`, `device-list-windows`,
  `device-focus-window`, `device-window-action`, `device-screenshot`,
  `device-inspect-ui`, `device-ui-action`, `device-read-clipboard`,
  `device-write-clipboard`, `device-move-mouse`, `device-click`,
  `device-scroll`, `device-drag`, `device-list-files`, `device-read-file`,
  `device-glob`, `device-grep`, `device-check-admin`, `device-write-file`,
  `device-edit-file`, `device-mkdir`, `device-stat`, `device-copy`,
  `device-move`, `device-delete`, `device-apply-patch`, `device-run-command` e
  `device-shell`.
- Widget de abrir apps (`openDeviceApp`) com gesto do usuário.
- Descoberta de aplicativos instalados no Windows (Menu Iniciar + App Paths),
  verificação por `device-find-app` e apps personalizados por dispositivo.

## O que limita o carro chefe

- **A IA enxerga e clica, mas ainda não por elemento.**
  `device-screenshot` captura tela, monitor e região e anexa a imagem ao
  modelo; o mouse por coordenada (`move-mouse`/`click`/`scroll`/`drag`) fecha o
  ciclo capturar → agir → verificar. As tools de mouse aceitam `screenshotId` e
  recebem coordenadas normalizadas 0–1000, mas o clique ainda depende de
  coordenada calculada, não de um elemento de UI. A imagem é temporária (15 min).
- **A IA era míope.** `device-type-text` e `device-press-key` agiam sobre a
  janela em foco, sem como listar ou focar janelas. Isso foi resolvido com
  `device-list-windows` + `device-focus-window` (item 2), e `type-text`/
  `press-key` agora aceitam `windowId` para focar e agir no mesmo comando.
- **O `device-run-command` não roda nada útil.** A allowlist em
  `spectral/driver/src/commands/files.ts` só tem `dir`, `type`, `echo`,
  `tasklist`, `systeminfo` etc., e o denylist bloqueia `node`, `git`, `python`,
  `npm` e shell. O caminho real agora é `device-shell` (item 7), que executa
  scripts em arquivo; a allowlist antiga continua só para consulta.
- **Operações de arquivo básicas:** `mkdir`, `stat`, `copy`, `move`, `delete`
  para a lixeira e `apply-patch` atômico já funcionam no Windows. Upload/download
  e `zip`/`unzip` dedicados ainda faltam (transferência binária é a Fase 5a;
  zip via shell).
- **O driver não é um produto instalável.** Hoje é `npm run dev:driver` em um
  terminal aberto. Sem instalador, serviço/tray, autostart e auto-update, a
  adoção fica travada.
- **A política existe, mas ainda é enxuta.** Modo Leitura/Construtor + Pedir
  confirmação/Poder Total, aprovação nativa do AI SDK e auditoria em
  `DeviceAuditEvent` já funcionam; faltam a tela de atividade e mais categorias
  de risco.
- **O transporte limita o tamanho e a duração.** O WebSocket do backend usa
  `maxPayload` de 4 MB (configurável) e cada comando tem timeout máximo de 60s,
  com um comando em voo por PC (`device_busy`). Screenshots ainda trafegam em
  base64 e ficam em disco temporário; um canal binário e storage permanente
  seguem pendentes.
- **Apps web complexos ficam fora do alcance do UIA.** WhatsApp Web, painéis e
  SPAs têm DOM profundo (além do `depth` 12) e carregamento assíncrono; a árvore
  do Chrome não garante nomes estáveis nos itens e, quando o controle não expõe
  `ValuePattern`, digitar ainda depende de `SendKeys` no primeiro plano. É o que
  motiva o item 4c (Playwright), já que o caminho por acessibilidade foi feito
  para apps nativos.

---

## Roadmap

Legenda de esforço: **P** pequeno, **M** médio, **G** grande.
Risco considera exposição de segurança ao liberar o recurso.

### Bloco A — Percepção (o que destrava tudo)

#### 1. `device-screenshot` — captura de tela ✅

- **Status:** implementado (MVP). Contrato em
  `spectral/shared/device-commands.ts`, driver em
  `spectral/driver/src/commands/screen.ts`, tool em
  `lib/ai/tools/device-tools.ts`, armazenamento temporário em
  `lib/devices/screenshot-store.ts` e card em
  `components/chat/tool-part-card.tsx`.
- **O que:** capturar tela inteira, um monitor ou uma região, com escala e
  compressão configuráveis. Retornar a imagem para o modelo e para um card no
  chat.
- **Por quê:** é a feature que transforma "controlar PC" em "agente que
  resolve". Permite verificar se a ação anterior funcionou e corrigir o rumo.
- **Contrato:** `device-screenshot` com
  `{ deviceId, monitor?, region?, format?, quality?, maxWidth? }`. Resultado
  com `screenshot{ id, width, height, scale, monitor, region, format,
  byteLength, capturedAt }` e `imageBase64` transiente. O histórico guarda só
  os metadados.
- **Transporte:** base64 pelo WebSocket, com `maxPayload` de 4 MB no backend e
  teto de 400 KB para a imagem final. O app salva os bytes em disco temporário
  com TTL de 15 min e os anexa ao modelo via `toModelOutput`; a imagem é servida
  por rota autenticada.
- **Plataformas:** Windows (PowerShell + .NET), macOS (`screencapture`/`sips`,
  exige Gravação de Tela) e Linux X11 (`import`/`convert`/`identify`/`xrandr`).
  Wayland retorna `unsupported_environment` nesta fase.
- **Pronto quando:** a IA tira um print, vê a imagem, clica em um elemento e
  confirma por um segundo print. Com o item 3 implementado, o ciclo está
  disponível por coordenada.
- **Esforço:** M · **Risco:** M (privacidade da tela).

#### 2. Janelas: listar, focar e controlar ✅

- **Status:** implementado. Contrato em `spectral/shared/device-commands.ts`,
  driver em `spectral/driver/src/commands/windows.ts`, tools
  `device-list-windows`/`device-focus-window`/`device-window-action` e
  `windowId` opcional em `device-type-text`/`device-press-key`.
- **O que:** listar janelas abertas (título, processo, bounds, foco), focar uma
  janela por id e minimizar, maximizar, restaurar ou fechar por id.
- **Por quê:** elimina o risco de digitar na janela errada, permite "abra o VS
  Code e vá para a janela X" e dá controle básico de janelas ao assistente.
- **Onde mexer:** contrato compartilhado, driver (`windows.ts` por plataforma),
  executor, tools e prompt.
- **Pronto quando:** `type-text`/`press-key` puderem ser precedidos por foco
  explícito, ações de janela estiverem disponíveis por id e o prompt orientar
  esse fluxo.
- **Esforço:** M · **Risco:** baixo para foco/minimizar/maximizar; médio para
  fechar (trabalho não salvo).
- **Limites:** `windowId` com até 128 caracteres (`^[A-Za-z0-9:._-]+$`),
  `list-windows` com `limit` de 1 a 30 (padrão 20) e título/processo truncados.
  Windows usa PowerShell + P/Invoke; macOS usa System Events (exige
  Acessibilidade); Linux usa `wmctrl`/`xdotool` em X11, com
  `unsupported_environment` no Wayland.
- **Ações:** `device-window-action` (`minimize`, `maximize`, `restore`,
  `close`) mapeia para `minimize-window`, `maximize-window`, `restore-window` e
  `close-window`. `close` é gracioso (`WM_CLOSE`/botão de fechar/`wmctrl -c`) e
  não usa força bruta. Nesta versão `close` não exige confirmação textual.

#### 3. Mouse — `device-click`, `device-move-mouse`, `device-scroll`, `device-drag` ✅

- **Status:** implementado (MVP por coordenada). Contrato em
  `spectral/shared/device-commands.ts`, driver em
  `spectral/driver/src/commands/mouse.ts`, dispatch em
  `spectral/driver/src/commands/executor.ts`, tools em
  `lib/ai/tools/device-tools.ts` e prompt com regras de confirmação.
- **O que:** controle de mouse por coordenada (e, no futuro, por elemento).
  `move-mouse`, `click` (left/right/middle, 1 a 3 cliques), `scroll`
  (up/down/left/right, 1 a 50 passos) e `drag` (`from`/`to`, 100–10.000 ms).
- **Por quê:** combinado com screenshot, fecha o ciclo completo de automação de
  GUI (clicar, verificar, corrigir).
- **Coordenadas:** as tools aceitam `screenshotId`; nesse caso `x`/`y` e
  `from`/`to` são inteiros normalizados de 0 a 1000 na imagem (0 = borda
  esquerda/topo, 1000 = borda direita/baixo) e o servidor converte com
  `region.x + normalizadoX * (region.width / 1000)` (e o equivalente em Y). Sem
  `screenshotId`, são pixels nativos do sistema; aceita valores negativos em
  multi-monitor, limitados a `-100_000..100_000`. Para alvos pequenos, use o
  fluxo coarse-to-fine: capture a tela/janela, recorte com `screenshotId` +
  `region` normalizado e clique com o `screenshotId` do recorte, verificando com
  nova captura.
- **Onde mexer:** driver (API nativa por plataforma), contrato, tools e prompt.
  Windows usa `SetCursorPos`/`mouse_event` via PowerShell com
  `SetProcessDPIAware`; macOS usa CoreGraphics via `osascript` (exige
  Acessibilidade e trabalha em pontos); Linux X11 usa `xdotool`; Wayland e
  ausência de `DISPLAY` retornam `unsupported_environment`.
- **Erros:** `screenshot_not_found`, `screenshot_device_mismatch`,
  `permission_denied`, `unsupported_environment`, `dependency_missing`,
  `invalid_coordinates` e `mouse_action_failed`.
- **Pronto quando:** um fluxo de clicar/arrastar/rolar for executado e verificado
  por screenshot. O driver e as tools estão prontos; falta validar em cada
  sistema, incluindo fechar abas do Chrome por atalho ou por clique na barra de
  abas com `screenshotId`.
- **Esforço:** M · **Risco:** alto (ações destrutivas) — exige confirmação no
  prompt.

#### 4. Clipboard — `device-read-clipboard` / `device-write-clipboard` ✅

- **O que:** ler e escrever a área de transferência do PC.
- **Por quê:** baixo risco e utilidade enorme ("manda esse texto pro PC",
  "pega o que eu copiei").
- **Onde mexer:** driver, contrato, tools e prompt.
- **Pronto quando:** copiar/colar entre chat e dispositivo funcionar nos três
  sistemas.
- **Esforço:** P · **Risco:** baixo.
- **Status:** implementado em texto (ler/escrever), com limite de 100 mil
  caracteres, aviso de privacidade e suporte a Windows, macOS, Linux X11
  (`xclip`/`xsel`) e Wayland (`wl-clipboard`). Imagens e arquivos no clipboard
  ficam para depois.

#### 4b. UI Automation — inspecionar e agir sem cursor ✅

- **Status:** implementado no Windows (MVP determinístico). Contrato em
  `spectral/shared/device-commands.ts`, driver em
  `spectral/driver/src/commands/ui.ts`, dispatch em
  `spectral/driver/src/commands/executor.ts`, tools
  `device-inspect-ui`/`device-ui-action` e prompt v29.
- **O que:** inspecionar a árvore de acessibilidade de uma janela e executar
  ações em controles por `runtimeId`, sem mover o cursor nem estimar pixels.
- **Por quê:** o grounding visual de alvos pequenos (ex.: o “x” de uma aba de
  36×36 px) errava na primeira tentativa. A árvore de UI Automation entrega
  nome, papel, bounds e centro exatos, e a ação via pattern é determinística.
- **Contrato:** `inspect-ui` com
  `{ windowId, find?, role?, maxResults, depth, includeOffscreen, waitMs }`
  retorna `ui{ windowId, windowTitle, elements[], scanned, waitedMs, truncated }`;
  cada elemento traz `runtimeId`, `name`, `role`, `value`, `bounds`, `center`,
  `enabled`, `focused`, `selected`, `expanded`, `actions`, `automationId` e
  `path`. `value` é null em campos de senha.
  `ui-action` com `{ windowId, runtimeId, action, waitMs, value? }` executa
  `invoke`, `select`, `toggle`, `expand`, `collapse`, `focus` ou `setValue` e
  retorna `uiAction` com o estado do elemento, `waitedMs` e, quando aplicável,
  `hint`.
- **Resiliência:** `waitMs` (0–10000) faz a enumeração repetir a cada ~150 ms até
  o alvo aparecer. O padrão é 1500 ms na ação e 0 na inspeção; `inspect-ui`
  também aceita espera quando o conteúdo renderiza depois. `setValue` usa
  `ValuePattern.SetValue` e escreve direto em campos de texto, sem depender de
  `SendKeys` na janela em foco. Campos com `ValuePattern.IsPassword` são
  bloqueados: `setValue` retorna `password_field_blocked` e o `value` do
  elemento vem null. Quando `focus` é aplicado a um controle com
  `SelectionItemPattern` (aba, item de lista), a resposta traz
  `hint` recomendando `select`.
- **Plataformas:** Windows via PowerShell + UIAutomationClient
  (`AutomationElement.FromHandle`, `RawViewWalker`, DPI awareness v2).
  macOS (`AXUIElement`) e Linux (AT-SPI) retornam `unsupported_platform` nesta
  fase; o caminho visual continua como fallback.
- **Erros:** `window_not_found`, `element_not_found`, `pattern_not_supported`,
  `action_failed`, `invalid_ui_value`, `password_field_blocked`,
  `ui_inspection_failed` e `unsupported_platform`.
- **Limites:** `runtimeId` é temporário e precisa ser reencontrado enumerando a
  árvore na hora da ação; a busca é limitada a 4.000 nós na inspeção e 8.000 na
  ação, por tentativa. Controles sem nome e sem AutomationId são omitidos para
  reduzir ruído. `setValue` cobre `ValuePattern`; editores sem esse pattern
  (canvas, alguns apps Electron) continuam dependendo de foco + teclado.
- **Pronto quando:** a IA localizar o “Fechar” da aba ativa do Chrome por
  inspeção e selecionar/fechar a aba por `ui-action` sem mover o cursor,
  confirmando o estado depois. Instalar/validar em macOS e Linux fica pendente.
- **Esforço:** M · **Risco:** alto para `invoke` destrutivo — exige autorização
  explícita no prompt.

#### 4c. Automação de navegador — Playwright

- **Status:** planejado. Complementa o 4b: UIA para apps nativos, Playwright para
  páginas web.
- **O que:** controlar o navegador por seletor (DOM), não por pixel: navegar,
  preencher campos, clicar, ler texto e esperar elementos.
- **Por quê:** apps web complexos (WhatsApp Web, painéis, SPAs) são hostis ao
  caminho atual. O DOM é fundo (além do `depth` 12), virtualizado e assíncrono; a
  árvore de acessibilidade do Chrome não garante nome estável nos itens; e
  digitar depende de `SendKeys` no primeiro plano, sem espera entre a ação e o
  carregamento. Isso gera `element_not_found` em sequência e o loop de inspeção.
  Playwright entrega seletor estável, `fill`/`type` determinístico e auto-wait.
- **Contrato (proposto):** `browser-open` (headless e perfil), `browser-goto`,
  `browser-find` (elementos com seletor, texto, role e bounds), `browser-action`
  (`click`, `fill`, `press`, `select`, `wait`) e `browser-text`. Em paralelo,
  `ui-action` ganha `setValue` (ValuePattern) para reduzir a dependência de
  `SendKeys` também no caminho UIA.
- **Onde mexer:** `spectral/driver/src/commands/browser.ts` (novo), contrato em
  `spectral/shared/device-commands.ts`, dispatch no `executor.ts`, tools em
  `lib/ai/tools/device-tools.ts`, prompt e specs. O navegador roda no driver, no
  PC do usuário — nunca no servidor.
- **Plataformas:** Windows primeiro. macOS e Linux retornam
  `unsupported_platform` até a fase seguinte.
- **Erros:** `browser_not_launched`, `browser_selector_not_found`,
  `browser_timeout`, `browser_navigation_failed` e `unsupported_platform`.
- **Limites:** sessão isolada por padrão, sem perfil nem cookies do usuário;
  usar o perfil real é opt-in explícito. Enviar mensagem, submeter formulário ou
  concluir compra exige confirmação do usuário, como no `invoke` destrutivo do
  4b. Downloads passam pelo sandbox do item 6. O runtime do Playwright e os
  navegadores pesam centenas de MB, o que afeta o instalador do item 10.
- **Pronto quando:** a IA abrir o WhatsApp Web, procurar um contato, escrever
  uma mensagem e enviar para o próprio número, confirmando o envio, sem usar
  coordenadas nem keystrokes no primeiro plano.
- **Esforço:** G · **Risco:** alto (sessão autenticada; enviar mensagem ou
  comprar em nome do usuário).

#### 4c. Aplicativos: descoberta, abertura e catálogo local ✅

- **O que:** substituir a allowlist fixa por descoberta dinâmica no Windows
  (atalhos do Menu Iniciar e registro App Paths), busca por nome/id/caminho
  (`find-app`), abertura por id descoberto ou caminho absoluto (`open-app`) com
  argumentos (`args`) e diretório de trabalho (`cwd`), abertura de arquivo/pasta
  no app padrão sem aprovação (`open-path`) e catálogo local de apps no driver
  (`~/.spectral/driver/apps.json`) com `register-app` e `remove-app`.
- **Por quê:** o usuário espera "abre o Zed" ou "abre o Zed nesta pasta"
  (`zed .`) sem precisar descobrir o caminho e sem que a IA invente ids. A
  allowlist de oito apps não cobre a máquina real. `open-path` abre documentos
  sem aprovação; `open-app` com `args`/`cwd` pede aprovação porque o app recebe
  instruções.
- **Onde mexer:** `spectral/driver/src/commands/apps.ts`,
  `spectral/driver/src/commands/catalog.ts` (novo),
  `spectral/driver/src/commands/executor.ts`,
  `spectral/shared/device-commands.ts`, `lib/ai/tools/device-tools.ts`,
  `lib/devices/execution-policy.ts`, `lib/devices/tool-approval.ts`,
  `lib/ai/prompts/sections/devices.ts`, prompt v33.
- **Status:** implementado no Windows. `device-find-app` retorna `found`,
  `query` e `apps[]`; `device-list-apps` aceita `query`, `refresh` e `limit` e
  mescla builtins, descoberta e catálogo local (`source: custom`); ids vêm de
  `deviceAppIdFromTarget` (slug + FNV-1a) e a descoberta tem cache de 5 minutos.
  `open-app` aceita `args` (até 32, máximo 512 chars cada, sem controle) e
  `cwd` (diretório existente); com args/cwd o risco é `launch` (aprovação no
  build). `open-path` recusa extensões de app e a blocklist de scripts,
  instaladores e documentos com macro (`invalid_path`). `register-app` valida
  o caminho na hora e grava em `apps.json` (escrita atômica, dedupe por caminho,
  máx. 100). Fora do Windows só os apps fixos e `open-path` funcionam.
- **Pronto quando:** "o Zed está instalado?", "abre o Zed" e "abre o Zed nesta
  pasta" funcionarem com o caminho real do PC; `open-path` abrir um PDF sem
  aprovação; `register-app` cadastrar um app fora da descoberta; e o catálogo
  aparecer em `device-list-apps` sem cadastro manual em Configurações. ✅
- **Esforço:** M · **Risco:** médio (abrir executável arbitrário via `path`;
  args/cwd pedem aprovação como lançamento).
- **Pendências resolvidas (teste ao vivo 2026-11-12):** o executor foi
  exercitado direto e os dois gaps encontrados foram corrigidos:
  1. `open-path` executava scripts/instaladores fora da denylist de apps (`.vbs`,
     `.js`, `.msi`, `.hta`, `.scr`, `.cpl`, `.jar`, `.reg`, `.url`) sem
     aprovação. Correção: `DEVICE_OPEN_PATH_BLOCKED_EXTENSIONS` no contrato e no
     driver (scripts, instaladores, handlers e documentos com macro; no driver
     só para arquivos), com testes.
  2. `device-shell` com `Start-Process`/`start`/`open`/`xdg-open`/`explorer` era
     classificado como `exec` e contornava o `launch` do `open-app`. Correção:
     esses scripts e a invocação direta de `.exe`/`.cmd` agora são `launch`,
     depois de `system`/`destructive`.

  Limites restantes: `cmd /c start`, `Invoke-Expression`, `schtasks` e outras
  entradas indiretas ainda escapam da heurística. Detalhes em
  `device-execution.md` §4.3c.

### Bloco B — Controle real do PC

#### 5. Operações de arquivo completas ✅

- **O que:** `copy`, `move`, `rename` (caso de `move`), `delete` (para a lixeira
  quando possível), `mkdir`, `stat` e `apply-patch`. `zip`/`unzip` ficam
  opcionais via `shell`.
- **Por quê:** antes só existia escrever/editar; sem isso não se organiza nada.
- **Onde mexer:** `spectral/driver/src/commands/files.ts` (mesmo sandbox e
  denylist atuais), contrato e tools.
- **Status:** implementado no Windows. `delete` usa a lixeira por padrão e exige
  `permanent: true` para apagar de vez; raízes protegidas; symlinks nunca
  seguidos. Tools `device-mkdir`, `device-stat`, `device-copy`, `device-move`,
  `device-delete`, `device-apply-patch`.
- **Pronto quando:** as operações respeitarem raízes permitidas e houver
  aprovação para exclusão. ✅
- **Esforço:** M · **Risco:** alto (exclusão) — exige aprovação.

#### 6. Transferência app ↔ dispositivo

- **O que:** `device-upload-file` (salva na pasta padrão) e
  `device-download-file` (vira anexo no chat), com streaming binário e limite de
  tamanho.
- **Por quê:** hoje a única forma de levar um arquivo ao PC é colar texto na
  tool. Isso quebra o uso real.
- **Onde mexer:** rotas de upload/download, driver, storage do app e widget de
  browser de arquivos com preview.
- **Pronto quando:** arrastar um arquivo no chat e mandar para o PC (e o
  contrário) funcionar com progresso.
- **Esforço:** G · **Risco:** médio.

#### 7. `run-command` em camadas + task runner

> **Detalhamento:** [`specs/device-execution.md`](./device-execution.md). Este item
> é o centro do **plano de execução**: shell, arquivos, processos e jobs com
> política, aprovação e auditoria. Os itens 5, 8 e 13 dependem dele.

- **Status:** Fase 0, Fase 1 e Fase 2 de arquivos implementadas (política,
  auditoria, aprovação nativa, `device-env`, `device-shell` e operações de
  arquivo no Windows). Processos implementados (Fase 3 — ver item 8) e jobs
  (Fase 4) seguem no roadmap — ver
  [`device-execution.md`](./device-execution.md#8-fases-de-implementação).
- **O que:** shell por script em arquivo, governado por dois modos no chat
  (`plan` = leitura, `build` = construtor) e uma preferência por dispositivo
  (`Pedir confirmação` ou `Poder Total` para ações destrutivas/de sistema):
  - `plan` só consulta; `build` executa `node`, `python`, `git`, `npm`,
    `powershell`/`bash`;
  - **task runner**: a IA escreve o script em `defaultWorkingDirectory` e
    executa, com stdout/stderr, timeout e cancelamento.
- **Por quê:** é o que permite "criar um script e rodar" sem liberar shell
  arbitrário por padrão.
- **Onde mexer:** contrato, `spectral/driver/src/commands/files.ts`, política por
  dispositivo, tools e prompt.
- **Pronto quando:** um script criado pela IA roda na pasta padrão, com saída
  capturada e sem shell interpolado.
- **Esforço:** G · **Risco:** alto — só depois do Bloco C de governança
  (itens 14–16).

#### 8. Processos ✅ (implementado)

- **O que:** `device-list-processes` e `device-kill-process` (com aprovação).
- **Por quê:** permite "o que está travando?" e "fecha o Chrome".
- **Onde mexer:** `spectral/shared/device-commands.ts` (contrato),
  `spectral/driver/src/commands/processes.ts` (driver), `executor.ts` (dispatch),
  `lib/ai/tools/device-tools.ts` (tools), `lib/devices/execution-policy.ts`
  (risco destructive), prompt.
- **Esforço:** M · **Risco:** alto (matar processo) — exige aprovação.
- **Pronto quando:** listagem filtrada por `query`, encerramento por `pid`
  (nunca por nome), proteções `protected_process` (pid <= 4, driver e ancestrais,
  nomes críticos do Windows, processo do driver por linha de comando) e validação
  de morte antes de devolver `killed: true`. ✅

#### 9. Ações de sistema

- **O que:** volume, brilho, mídia (play/pause/next), bloquear, dormir,
  desligar/reiniciar (aprovação) e notificação nativa no PC.
- **Por quê:** utilidade diária e ótimo para demonstração.
- **Onde mexer:** driver por plataforma, contrato, tools e prompt.
- **Esforço:** M · **Risco:** alto (energia) — exige aprovação.

### Bloco C — Confiabilidade e produto

#### 10. Instalador + serviço/tray + autostart

- **O que:** instalador para Windows (MSI/EXE), macOS (pkg) e Linux (deb), com
  ícone na bandeja, status, "emparelhar", logs e "abrir configurações", rodando
  como serviço e iniciando com o sistema.
- **Por quê:** é o maior bloqueio de adoção hoje. Um produto que exige terminal
  aberto não chega no usuário comum.
- **Onde mexer:** `spectral/driver` (empacotamento, modo serviço, tray) e docs de
  instalação.
- **Pronto quando:** instalar, emparelhar e fechar o terminal sem derrubar o
  driver.
- **Esforço:** G · **Risco:** médio.

#### 11. Auto-update do driver

- **O que:** versionamento, canal estável/beta, update assinado e rollback.
- **Por quê:** sem isso, cada mudança de contrato quebra usuários antigos.
- **Onde mexer:** driver (updater), backend (manifesto de versão) e UI
  (atualização disponível).
- **Esforço:** G · **Risco:** médio.

#### 12. Negociação de capacidades

- **O que:** o driver reporta `version`, `capabilities` e `platform` no
  `device:authenticated`; o backend guarda e a UI mostra "atualize para usar
  screenshot". As tools degradam com mensagem clara em vez de erro genérico.
- **Por quê:** com o contrato evoluindo, usuários com driver antigo precisam de
  diagnóstico explícito.
- **Onde mexer:** `spectral/shared/device-commands.ts`,
  `spectral/backend/src/websocket/*`, `db/schema/device.ts`,
  `lib/devices/types.ts`, `devices-section.tsx`.
- **Esforço:** M · **Risco:** baixo.

#### 13. Modelo de jobs

- **O que:** comandos longos com `jobId`, progresso, streaming de saída e
  cancelamento, com eventos WS → app.
- **Por quê:** o orçamento do `shell` já vale de ponta a ponta (até 60s), mas
  builds, scripts e capturas em loop ainda morrem no teto de 60s, não há saída
  incremental e só há um comando em voo por PC. Jobs removem essas três
  limitações.
- **Onde mexer:** `spectral/backend/src/websocket/command-bus.ts`,
  `spectral/backend/src/http/internal.ts`, driver, tools e UI.
- **Esforço:** G · **Risco:** médio.

#### 14. Auditoria

- **O que:** registrar toda ação (quem: IA ou usuário; qual tool; dispositivo;
  resultado; aprovação; timestamp) e exibir "o que a IA fez no meu PC".
- **Por quê:** é requisito de confiança para liberar recursos perigosos, não
  luxo.
- **Onde mexer:** nova tabela no schema, rotas de leitura e tela em
  Configurações → Dispositivos.
- **Esforço:** M · **Risco:** baixo.

#### 15. Política por dispositivo na UI

- **O que:** ligar/desligar categorias (arquivos, input, shell, tela), nível de
  confiança, exigir aprovação, raízes permitidas, pasta padrão e rate limit.
- **Por quê:** é o que permite liberar recursos perigosos com segurança.
- **Onde mexer:** `db/schema/device.ts`, API de devices, `devices-section.tsx`,
  contrato e validação das tools.
- **Esforço:** G · **Risco:** baixo (reduz risco).

#### 16. Aprovação de verdade

- **O que:** card no chat com **permitir uma vez / sempre / negar**, notificação
  nativa e, para ações de alto risco, aprovação no próprio PC (popup do tray).
- **Por quê:** substitui o "confirme em texto", que a IA pode ignorar.
- **Onde mexer:** modelo de aprovação no backend, streaming de eventos para o
  chat, UI de card, driver/tray.
- **Esforço:** G · **Risco:** baixo (reduz risco).

### Bloco D — Orquestração

#### 17. Multi-dispositivo

- **O que:** rodar a mesma ação em vários PCs, grupos/tags e "dispositivo ativo"
  selecionável no chat.
- **Por quê:** hoje toda tool exige `deviceId` e a IA escolhe sozinha.
- **Onde mexer:** schema (grupos), tools (alvo múltiplo), UI e prompt.
- **Esforço:** M · **Risco:** médio.

#### 18. Roteamento por capacidade

- **O que:** "o PC que tem VS Code", "o notebook com GPU", usando capabilities e
  apps instalados.
- **Por quê:** com vários devices, escolher o alvo deixa de ser manual.
- **Onde mexer:** capabilities (item 12), inventário de apps e tools.
- **Esforço:** M · **Risco:** baixo.

#### 19. Tarefas agendadas/recorrentes e gatilhos

- **O que:** "todo dia às 9 abrir o dashboard", "quando eu chegar, preparar o
  ambiente".
- **Por quê:** transforma comandos em automações.
- **Onde mexer:** scheduler no backend, job model (item 13) e UI.
- **Esforço:** G · **Risco:** médio.

#### 20. Transferência dispositivo → dispositivo

- **O que:** mover arquivos entre PCs sem passar pelo navegador, com progresso.
- **Por quê:** fecha o fluxo de quem usa mais de um computador.
- **Onde mexer:** backend (coordenação), driver (origem/destino) e storage
  temporário.
- **Esforço:** M · **Risco:** médio.

### Bloco E — Plataforma e qualidade

#### 21. Android/TV como devices

- **O que:** companion Android com clipboard, notificações, arquivos, tela e
  sensores.
- **Por quê:** o spec hoje declara celular e TV como não suportados. É uma fase
  própria, com outro modelo de permissões.
- **Onde mexer:** novo cliente/driver, contrato compartilhado e UI.
- **Esforço:** G · **Risco:** alto.

#### 22. Testes de contrato e caos

- **O que:** um **fake driver** para testes, contract tests do
  `shared/device-commands.ts` e testes de desconexão, timeout, `device_busy`,
  reconexão e rotação de chave.
- **Por quê:** o próprio `specs/chat-device.md` pede "testar muito". Hoje
  `lib/devices/*.test.ts` cobre validação, mas não o ciclo ponta a ponta.
- **Onde mexer:** suíte de testes, harness do fake driver e CI.
- **Esforço:** M · **Risco:** baixo (reduz risco).

---

## Sequência recomendada

**Fase 1 — "a IA enxerga e acerta"** (maior impacto por esforço)
Itens 1, 2, 3, 4 → screenshot + janelas + mouse + clipboard. ✅ Implementado;
já permite demonstrar automação real de GUI.

**Fase 2 — "o driver como plano de execução"** (carro chefe)
Ver [`specs/device-execution.md`](./specs/device-execution.md). Ordem interna:
governança (15 + 16 + 14 + 12) → shell (7) → arquivos, apps e processos (5 +
4c + 8) → jobs (13). Governança vem **antes** de liberar shell, não depois.

**Fase 3 — "produto instalável"**
Itens 10, 11 → instalador/tray/autostart e auto-update. Sem isso o resto não
chega no usuário comum.

**Fase 4 — expansão**
Itens 4c, 6, 9, 17–22.

Se fosse escolher **só três** para começar: **screenshot**, **listar/focar
janelas** e **política de aprovação por dispositivo**. As duas primeiras
destravam o produto; a terceira permite liberar comandos complexos sem virar um
risco.

---

## Paridade com o Claude Code (plano consolidado)

> **Detalhamento de contrato, limites e critérios de aceite:**
> [`specs/device-execution.md`](./device-execution.md). Esta seção consolida o
> que falta para o driver oferecer **todas as primitivas de execução** que o
> Claude Code usa para operar a máquina do usuário, sem mover o cérebro para o
> driver.

**Poder ≠ permissão.** O driver ganha a capacidade técnica; o app continua
decidindo o que pode rodar (Modo Leitura/Construtor + Pedir confirmação/Poder
Total). Planejamento, todo list, subagents, memória, MCP, hooks e skills
continuam sendo cérebro e não vão para o driver.

### Mapa de paridade

| Capacidade | Claude Code | Driver hoje | Entrega |
|---|---|---|---|
| Shell/scripts | `Bash` | ✅ `shell` (Windows, 60 s, 1 comando em voo) | Fase 4 (jobs) e Fase 6 (macOS/Linux) |
| Shell persistente (cwd/env entre comandos) | sessão viva | ❌ | Fase 4 (opcional) |
| Background + streaming + cancelar | `run_in_background`, `BashOutput`, `KillShell` | ❌ | Fase 4 |
| Ler arquivo com offset/limit | `Read` | ✅ `read-file` | — |
| Escrever arquivo | `Write` | ✅ `write-file` | — |
| Editar vários trechos | `Edit`/`MultiEdit` | ✅ `apply-patch` atômico | — |
| Buscar arquivos/texto | `Glob`/`Grep` | ✅ `glob`, `grep` | — |
| Operações de arquivo | `cp`, `mv`, `rm`, `mkdir`, `stat` | ✅ `mkdir`, `stat`, `copy`, `move`, `delete` | `zip`/`unzip` via shell |
| Abrir aplicativos | atalhos do sistema | ✅ `find-app`, `list-apps`, `open-app` (descoberta + catálogo local), `open-path` (arquivo/pasta), `register-app`/`remove-app` | `open-app` com args/cwd é risco `launch` (aprovação); macOS/Linux na Fase 6 |
| Processos | `ps`, `top`, `kill` | ✅ `device-list-processes`, `device-kill-process` (Windows) | Fase 3 |
| Rede | `curl`/WebFetch | ✅ via `shell` | mantém via shell |
| Upload/download binário | leitura/escrita local | ❌ | Fase 5a |
| GUI/UIA, mouse, teclado, janelas | ❌ | ✅ | diferencial do Spectral |
| Sistema (volume, brilho, energia) | via shell | ❌ | Fase 5b |
| Navegador | via MCP/Playwright | ❌ | Fase 5d |
| Elevação/UAC | manual | ❌ | Fase 5e (opt-in) |

### Fase 2 — Arquivos completos (M) — ✅ implementada

Mesmo `FileSandbox` atual, com raízes unificadas ao shell (home + pasta padrão):

| Comando | Entrada | Risco |
|---|---|---|
| `mkdir` | `{ path, recursive? }` | write |
| `stat` | `{ path }` — tipo, tamanho, datas, modo, symlink sem seguir | read |
| `copy` | `{ from, to, overwrite?, recursive? }` | write |
| `move` | `{ from, to, overwrite? }` (rename é o caso do mesmo diretório) | write |
| `delete` | `{ path, recursive?, permanent? }` | **destructive** |
| `apply-patch` | `{ path, patches: [{ oldText, newText, replaceAll? }] }` | write |

- `delete` usa a lixeira por padrão; `permanent: true` exige aprovação.
- Nunca seguir symlink em `delete` recursivo, `copy` ou `move`.
- `copy`/`move` validam origem e destino; `overwrite` é explícito.
- `apply-patch` é atômico, preserva CRLF/BOM e limita a 10 patches / 1 MB.
- `zip`/`unzip` ficam opcionais: o shell resolve, e zip slip adiciona superfície.
- Tools: `device-mkdir`, `device-stat`, `device-copy`, `device-move`,
  `device-delete`, `device-apply-patch`.
- Fora do Windows, `delete` sem `permanent` retorna `unsupported_platform`.

**Pronto quando:** organizar uma pasta (criar, copiar, mover, apagar para a
lixeira) e editar vários trechos de um arquivo funcionarem com aprovação só no
destrutivo, auditoria e verificação posterior. ✅

### Fase 2b — Aplicativos (M) — ✅ implementada

| Comando | Entrada | Risco |
|---|---|---|
| `list-apps` | `{ query?, refresh?, limit? }` | read |
| `find-app` | `{ query, refresh?, limit? }` | read |
| `open-app` | `{ appId?, path?, args?, cwd? }` | input sem args; **launch** com args/cwd |
| `open-path` | `{ path }` | input (recusa executáveis) |
| `register-app` | `{ name, path, args?, cwd? }` | write |
| `remove-app` | `{ appId }` | write |

- Descoberta no Windows por atalhos `.lnk` do Menu Iniciar (usuário e comum),
  por `App Paths` em HKLM (64/32-bit) e HKCU, e por aplicativos da Microsoft
  Store (AUMID via `Shell.Application` / `shell:AppsFolder`), com cache de 5
  minutos.
- `find-app` é a verificação de existência: retorna `found`, `query` e `apps[]`
  com `source` (`builtin`, `start-menu`, `app-path`, `store`, `custom`) e
  `target`. Shims dentro de `\WindowsApps\` (ex.: `spotify_cli.exe` do Spotify
  da Store) são filtrados porque não abrem janela visível.
- `open-app` abre apps da Store via `explorer.exe shell:AppsFolder\<AUMID>` e
  devolve `verified: true` apenas quando o driver confirma o surgimento de uma
  janela nova (até 3 s); caso contrário dispara o processo com `verified:
  false`. Nunca afirma que o app está aberto sem confirmação de janela.
- `open-app` resolve ids fixos, descobertos e do catálogo local; `path` precisa
  ser absoluto e ter extensão suportada. `args` (até 32, máximo 512 chars cada,
  sem caracteres de controle) e `cwd` (diretório existente) acompanham qualquer
  um dos dois. Erros: `app_not_found`, `unsupported_app_path`,
  `app_args_unsupported` (atalho com args), `invalid_app_args`.
- `open-path` abre arquivo ou pasta no app padrão, sem aprovação. Recusa
  executáveis/atalhos (`invalid_path`).
- Catálogo local do driver em `~/.spectral/driver/apps.json` (versão 1, esc
 rita atômica, dedupe por caminho, máx. 100). `register-app` cadastra/atualiza
  pelo caminho; `remove-app` remove pelo id. Aparece em `list-apps` com
  `source: custom`.
- `Device.customApps` (banco) é importado uma vez para o driver quando o
  dispositivo fica online; cadastro manual em Configurações é retirado. Drop da
  coluna fica para a próxima release.
- Tools: `device-find-app`, `device-list-apps`, `device-open-app`,
  `device-open-path`, `device-register-app`, `device-remove-app`.

**Pronto quando:** perguntar se um app existe e abri-lo por nome funcionar com o
caminho real do PC; `open-app "Zed" args ["."]` abrir o Zed na pasta atual com
aprovação; `open-path` abrir um documento sem aprovação; `register-app`
cadastrar um app fora da descoberta; e o catálogo aparecer em
`device-list-apps` sem cadastro manual em Configurações. ✅

### Fase 3 — Processos ✅ (implementado)

| Comando | Entrada | Risco |
|---|---|---|
| `list-processes` | `{ query?, limit? }` | read |
| `kill-process` | `{ pid, force?, tree? }` | **destructive** |

- `list-processes` consulta `Get-CimInstance Win32_Process` no Windows e retorna
  `pid`, `parentPid`, `name`, `command`, `memoryBytes`, `startedAt`, `sessionId`.
  Aceita `query` (filtra nome e linha de comando, contém, sem diferenciar
  maiúsculas) e `limit` (padrão 40, máximo 100), ordenado por memória decrescente.
  macOS/Linux retornam `unsupported_platform` (vazio).
- `kill-process` encerra um processo **sempre por `pid`** (nunca por nome: é
  ambíguo e perigoso). Aceita `force` (`taskkill /F`) e `tree` (`taskkill /T`,
  mata filhos também). Depois do encerramento, o driver verifica se o processo
  sumiu (até ~2 s) e só então devolve `killed: true`.
- Proteções (retornam `protected_process`):
  - `pid <= 4`;
  - o próprio driver e seus ancestrais (cadeia de `parentPid`);
  - processos críticos do Windows: `system`, `registry`, `smss`, `csrss`,
    `wininit`, `winlogon`, `services`, `lsass`, `lsaiso`, `dwm`, `svchost`,
    `fontdrvhost`, `memorycompression`;
  - qualquer processo cuja linha de comando indique o driver Spectral
    (`spectral\\driver`, `index.ts` ou `tsx`), porque o `process.pid` interno
    do `tsx` nem sempre corresponde ao PID visível no WMI.
  Com `tree: true`, qualquer descendente protegido também bloqueia o encerramento.
- Nunca encerra por nome (`taskkill /IM` não é usado).
- Tools: `device-list-processes`, `device-kill-process`.
- `start-process` fica fora desta release: `open-app`, `device-shell` e jobs já
  cobrem abrir/executar; adicionar `exec` com `detached`/`env` aumenta a
  superfície sem resolver o pedido atual.

**Pronto quando:** "o que está travando?", "mata esse processo" funcionarem com
aprovação e auditoria, sem risco a processos críticos. ✅
  - Validação ao vivo (2026-11-15): `list-processes query notepad` encontrou o
    Bloco de Notas (PID 8328), `kill-process pid 8328` devolveu `killed: true`,
    e a listagem seguinte confirmou que o processo sumiu.
  - `kill-process` no PID do driver e ancestrais: `protected_process` (coberto
    por testes unitários em `processes.test.ts`).

**Arquivos:** `spectral/shared/device-commands.ts` (contrato),
`spectral/driver/src/commands/processes.ts` (driver),
`spectral/driver/src/commands/executor.ts` (dispatch),
`lib/ai/tools/device-tools.ts` (tools),
`lib/devices/execution-policy.ts` (risco read/destructive),
`lib/ai/prompts/sections/devices.ts` + `registry.ts` (prompt v39).

### Fase 4 — Jobs e sessões (G)

```ts
job-start:  { script, shell?, cwd?, env?, label?, maxRuntimeMs? } → { jobId }
job-status: { jobId } → { status, exitCode?, startedAt, durationMs, bytesOut }
job-output: { jobId, cursor, maxBytes? } → { chunks[], nextCursor }
job-cancel: { jobId } → { cancelled }
job-list:   {} → { jobs[] }
```

- Buffer circular de 1 MB com cursor monotônico (code units UTF-16) no fluxo combinado stdout+stderr; `startCursor` indica descarte do começo.
- `job-output` incremental por `cursor`; o modelo não relê tudo.
- `maxRuntimeMs` padrão 30 min (mínimo 1s, máximo 60 min); cancelar mata a árvore de processos (`taskkill /T` no Windows, grupo no Unix).
- Até 3 jobs simultâneos por dispositivo; quarto `job-start` retorna `job_limit`.
- Job concluído fica retido ~10 min, depois some (`job_not_found`).
- Driver é a fonte da verdade; backend só proxy, sem tabela nem migração. Reiniciar o driver perde jobs em andamento.
- Sem PTY/sessão persistente nesta fase: `cwd`/`env` explícitos por comando cobrem quase tudo; PTY só para REPLs interativos (depois).
- Sem WebSocket app↔backend: o modelo faz polling pelas tools.
- `job-start` é risco `exec`: negado no Modo Leitura, aprovação no Construtor, liberado em Poder Total. `job-cancel` é `input` (sem aprovação extra). `job-status/job-output/job-list` são `read`.
- Windows primeiro; macOS/Linux retornam `unsupported_platform`.

**Pronto quando:** `npm run dev`, builds longos e watchers ficarem vivos além de
60 s, com saída incremental, cancelamento e sem processo órfão.

### Fase 5 — Expansão

- **5a. Transferência binária (G):** `device-upload-file`/`device-download-file`
  com streaming, progresso, limite e hash; nada de binário em base64 no comando.
- **5b. Sistema (M):** volume, brilho, mídia, bloquear, dormir e
  desligar/reiniciar (risco `system`).
- **5c. Rede dedicada (opcional):** manter `curl` via `shell`; só criar
  `http-request` se houver allowlist de domínios.
- **5d. Playwright (G):** `browser-open/goto/find/action/text`, perfil isolado
  por padrão e aprovação para enviar mensagem/comprar.
- **5e. Elevação (M, opt-in):** `run-as-admin` com UAC explícito e aprovação;
  nunca no fluxo automático.

### Fase 6 — Multiplataforma e robustez (G)

- macOS/Linux para shell, arquivos, processos e jobs; UIA/GUI segue Windows.
- Negociação de capacidades, rate limit por dispositivo, auditoria com
  referência de job (sem saída bruta).
- Atualização do prompt a cada fase e `SYSTEM_PROMPT_VERSION++`.
- Instalador/serviço/tray e auto-update (itens 10 e 11) continuam pré-requisito
  para uso real, mas não bloqueiam a paridade técnica.

### Ordem recomendada

| Ordem | Entrega | Esforço | Valor |
|---|---|---|---|
| 1 | Fase 2 — arquivos completos ✅ | M | alto (organizar projetos) |
| 1.5 | P2 — acesso total a disco ✅ | M | alto (cwd livre em qualquer pasta) |
| 2 | Fase 3 — processos ✅ | M | alto ("o que travou?") |
| 3 | Fase 4 — jobs/background ✅ | G | altíssimo (dev server, builds) |
| 4 | Fase 5a/5b — transferência + sistema | G/M | alto (uso diário) |
| 5 | Fase 5d — Playwright | G | alto (web sem UIA) |
| 6 | Fase 6 — macOS/Linux | G | expansão |

Estimativa total: **4–6 semanas** de trabalho focado, com validação ao vivo em
Windows a cada fase.

> **Aviso:** o `shell` atual **não é uma sandbox de SO**. O `cwd` aceita qualquer
> caminho absoluto; o script pode navegar e escrever em qualquer lugar que o
> usuário alcance. Contenção real exigiria token restrito, AppContainer ou Job
> Object, o que fica fora deste plano. A segurança pratica continua sendo modos
> + aprovacao + auditoria + denylist + caminhos protegidos.

### Decisões pendentes

Resolvidas na Fase 2:

1. `delete` usa lixeira por padrão. ✅ (`permanent: true` para apagar de vez)
2. Acesso total a disco: cwd e arquivos aceitam qualquer caminho absoluto.
   Escrita fora do home é destrutiva (aprovacao no Construtor, direto em Poder
   Total). Caminhos protegidos (Spectral, System32, WinSxS, Boot) bloqueados.
   ✅
3. Fase 2 inteira (arquivos); `zip`/`unzip` via shell. ✅

Ainda abertas:

4. Sessão persistente/PTY agora ou só jobs? (recomendado: jobs primeiro)
5. macOS/Linux entram agora ou depois de jobs? (recomendado: depois)
6. Playwright e elevação UAC entram no escopo? (recomendado: sim, nas fases
   5d/5e)

---

## Princípios de segurança

Valem para todos os itens acima:

- **Padrão fechado.** Toda nova capacidade nasce desligada e exige opt-in por
  dispositivo.
- **Menor privilégio.** O driver só executa o que a política do dispositivo
  permite; nunca shell arbitrário por padrão.
- **Aprovação proporcional ao risco.** Leitura livre; escrita, input, shell e
  energia exigem aprovação explícita.
- **Tudo auditável.** Nenhuma ação da IA sem registro de quem, o quê, onde e
  quando.
- **Degradação clara.** Driver antigo ou sem capability responde com mensagem
  acionável, não com erro genérico.
- **Dados sensíveis ficam no device.** Screenshots e arquivos nunca são
  persistidos além do necessário para a conversa.

## Referências

- Arquitetura e protocolo: [`specs/devices-connect.md`](./devices-connect.md)
- Plano de execução (shell, arquivos, processos, jobs):
  [`specs/device-execution.md`](./device-execution.md)
- Tools atuais do chat: [`specs/chat-device.md`](./chat-device.md)
- Configurações iniciais do device: [`specs/eco-device.md`](./eco-device.md)
- Schema de `Device` e `DevicePairingSession`: [`specs/schema.md`](./schema.md)
