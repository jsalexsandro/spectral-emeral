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
  `device-list-apps`, `device-open-url`, `device-open-app`, `device-type-text`,
  `device-press-key`, `device-list-windows`, `device-focus-window`,
  `device-window-action`, `device-screenshot`, `device-read-clipboard`,
  `device-write-clipboard`, `device-move-mouse`, `device-click`,
  `device-scroll`, `device-drag`, `device-list-files`,
  `device-read-file`, `device-glob`, `device-grep`, `device-check-admin`,
  `device-write-file`, `device-edit-file` e `device-run-command`.
- Widget de abrir apps (`openDeviceApp`) com gesto do usuário.

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
  `npm` e shell. Ou seja: não dá para "criar um script e executar", que é
  justamente a promessa do produto.
- **Não há operações de arquivo básicas** (copiar, mover, renomear, apagar,
  upload/download). O mouse MVP já está disponível por coordenada.
- **O driver não é um produto instalável.** Hoje é `npm run dev:driver` em um
  terminal aberto. Sem instalador, serviço/tray, autostart e auto-update, a
  adoção fica travada.
- **Não há política por dispositivo, aprovação real nem auditoria.** A
  confirmação é apenas texto no chat.
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

### Bloco B — Controle real do PC

#### 5. Operações de arquivo completas

- **O que:** `copy`, `move`, `rename`, `delete` (para a lixeira quando possível),
  `mkdir`, `stat`, `zip` e `unzip`.
- **Por quê:** hoje só existe escrever/editar; sem isso não se organiza nada.
- **Onde mexer:** `spectral/driver/src/commands/files.ts` (mesmo sandbox e
  denylist atuais), contrato e tools.
- **Pronto quando:** as operações respeitarem raízes permitidas e houver
  aprovação para exclusão.
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

- **O que:** substituir a allowlist atual por níveis:
  - `read-only` (atual, padrão);
  - `trusted` por dispositivo, com aprovação: `node`, `python`, `git`, `npm`,
    `powershell`/`bash` executando um script em arquivo;
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

#### 8. Processos

- **O que:** `device-list-processes`, `device-start-process` e
  `device-kill-process` (com aprovação).
- **Por quê:** permite "o que está travando?" e "fecha o Chrome".
- **Onde mexer:** driver, contrato, tools e prompt.
- **Esforço:** M · **Risco:** alto (matar processo) — exige aprovação.

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
- **Por quê:** hoje builds, scripts e capturas em loop morrem no timeout de 15s
  (máximo 60s) e só há um comando em voo por PC.
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

**Fase 2 — "confiança para soltar o poder"**
Itens 7, 15, 16, 14 → `run-command` em camadas + política por dispositivo +
aprovação + auditoria. Fazer isso **antes** de liberar shell, não depois.

**Fase 3 — "produto instalável"**
Itens 10, 11, 12, 13 → instalador/tray/autostart, auto-update, capabilities e
jobs. Sem isso o resto não chega no usuário comum.

**Fase 4 — expansão**
Itens 4c, 5, 6, 8, 9, 17–22.

Se fosse escolher **só três** para começar: **screenshot**, **listar/focar
janelas** e **política de aprovação por dispositivo**. As duas primeiras
destravam o produto; a terceira permite liberar comandos complexos sem virar um
risco.

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
- Tools atuais do chat: [`specs/chat-device.md`](./chat-device.md)
- Configurações iniciais do device: [`specs/eco-device.md`](./eco-device.md)
- Schema de `Device` e `DevicePairingSession`: [`specs/schema.md`](./schema.md)
