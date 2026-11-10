### Sistema de devices

Consulte, devices-connect.md
Roadmap de evolução: devices-evolution.md
1. Configurações iniciais do driver.
   Status: implementado.

   Na primeira autenticação o driver envia a pasta padrão (`homedir()`) e o
   backend grava em `devices.defaultWorkingDirectory`. A tela
   **Configurações → Dispositivos** permite editar essa pasta depois.

   Configs:
    1. Pasta padrão do driver, onde serão executadas suas ações.
       Caso eu mande ele criar um script e não diga o local, será criado ali.
       O valor é enviado ao driver no evento `device:authenticated` e usado como
       `cwd` padrão de `run-command`.

   Referências: `app/app/devices-section.tsx`, `app/api/devices/[id]/route.ts`,
   `spectral/backend/src/websocket/server.ts` e
   `spectral/driver/src/commands/files.ts`.

2. Janelas de dispositivos (`device-list-windows` + `device-focus-window`).
   Status: implementado (item 2 do roadmap).
   A IA lista as janelas abertas, escolhe a alvo e foca antes de digitar ou
   pressionar teclas, em vez de agir às cegas na janela em foco.

   - `device-list-windows`: lista título, processo, bounds, foco e estado de
     minimizada. `limit` de 1 a 30 (padrão 20); `includeMinimized` opcional.
   - `device-focus-window`: foca uma janela por `windowId` e retorna o snapshot.
   - `device-type-text` e `device-press-key` aceitam `windowId` opcional: o
     driver foca a janela e executa a ação no mesmo comando.
   - `windowId` tem até 128 caracteres e segue `^[A-Za-z0-9:._-]+$`; título é
     truncado em 120 e nome do processo em 80 caracteres.
   - Erros: `window_not_found` (janela sumiu), `focus_denied` (SO bloqueou o
     foco), `permission_denied` (macOS sem Acessibilidade),
     `unsupported_environment` (Wayland) e `dependency_missing` (Linux sem
     `wmctrl`).

   Plataformas:
   - Windows: PowerShell + P/Invoke (`EnumWindows`, `SetForegroundWindow`, com
     fallback via ALT/`SetWindowPos`/`SwitchToThisWindow` para o foreground lock).
   - macOS: System Events via `osascript`; exige permissão de Acessibilidade.
   - Linux: `wmctrl`/`xdotool` em X11; Wayland não permite enumerar janelas
     globalmente.

   Prompt atualizado para listar janelas antes de digitar
   (`SYSTEM_PROMPT_VERSION = 21`). O `maxPayload` do WebSocket hoje é de 4 MB
   (`DEVICE_WS_MAX_PAYLOAD_BYTES`), necessário para transportar screenshots em
   base64.

   Referências: contrato em `spectral/shared/device-commands.ts`, driver em
   `spectral/driver/src/commands/windows.ts`, tools em
   `lib/ai/tools/device-tools.ts` e detalhes em `specs/devices-evolution.md`.

3. Ações de janela (`device-window-action`).
   Status: implementado.

   A IA minimiza, maximiza, restaura e fecha janelas de um dispositivo online,
   sempre a partir do `windowId` retornado por `device-list-windows`.

   - Tool: `device-window-action` com
     `action: "minimize" | "maximize" | "restore" | "close"`, `deviceId` e
     `windowId`.
   - Protocolo do driver: comandos separados `minimize-window`,
     `maximize-window`, `restore-window` e `close-window`, todos com input
     `{ windowId }`.
   - `minimize`, `maximize` e `restore` retornam `{ ok: true, window }` com o
     snapshot atualizado. `close` retorna `{ ok: true }`; o backend não precisou
     de novo campo no schema.
   - `close` é gracioso: o aplicativo pode abrir um diálogo para salvar
     alterações e continuar aberto. Não há `force` nem `TerminateProcess` nesta
     versão.
   - Erros: `window_not_found`, `command_failed`, `unsupported_environment`
     (Wayland), `permission_denied` (macOS sem Acessibilidade) e
     `dependency_missing` (Linux sem `wmctrl`).

   Plataformas:
   - Windows: `ShowWindow` 6/3/9 para minimizar, maximizar e restaurar;
     `PostMessage(WM_CLOSE)` para fechar.
   - macOS: atributos `AXMinimized` e `AXFullScreen`; fechamento via `AXPress`
     no botão de fechar do System Events.
   - Linux X11: `wmctrl -b add,hidden`,
     `add,maximized_vert,maximized_horz`, `remove,...` e `wmctrl -c`. Wayland
     retorna `unsupported_environment`.

   Prompt atualizado para listar/escolher a janela antes de agir e nunca fechar
   janelas do sistema ou sem relação com o pedido
   (`SYSTEM_PROMPT_VERSION = 22`).

   Referências: contrato em `spectral/shared/device-commands.ts`, driver em
   `spectral/driver/src/commands/windows.ts`, dispatch em
   `spectral/driver/src/commands/executor.ts`, tool em
   `lib/ai/tools/device-tools.ts` e testes em `lib/devices/commands.test.ts` e
   `lib/ai/tools/device-tools.test.ts`.

4. Captura de tela (`device-screenshot`).
   Status: implementado (item 1 do roadmap).

   A IA captura a tela inteira, um monitor ou uma região e recebe a imagem
   anexada, para verificar o resultado das próprias ações em vez de adivinhar.

   - Tool: `device-screenshot` com
     `{ deviceId, monitor?, region?, maxWidth?, quality?, format? }`.
     Sem `monitor` nem `region`, captura a tela inteira virtual.
   - `monitor` é o índice 0-based; `region` é `{ x, y, width, height }` em
     coordenadas nativas do sistema operacional. Não combine os dois.
   - `maxWidth` de 320 a 3840 (padrão 1280), `quality` de 30 a 90 (padrão 70,
     só para JPEG) e `format` `jpeg` (padrão) ou `png`.
   - O driver captura em PNG nativo e reencoda reduzindo a largura
     progressivamente até a imagem caber em 400 KB.
   - Resultado: `ok` + `screenshot{ id, width, height, scale, monitor, region,
     format, byteLength, capturedAt }` + `imageBase64` transiente. O histórico
     do chat guarda apenas os metadados.
   - `scale` é o fator de pixels nativos por unidade do SO (por exemplo, `2` em
     telas Retina); `region` é o retângulo capturado.
   - A imagem fica em disco temporário por 15 minutos
     (`SPECTRAL_SCREENSHOT_DIR`) e é servida por
     `GET /api/devices/:id/screenshots/:screenshotId`, que exige sessão e
     ownership do dispositivo. O modelo recebe os bytes via `toModelOutput`;
     `imageBase64` nunca é persistido no histórico.
   - Erros: `screen_permission_denied` (macOS sem Gravação de Tela),
     `unsupported_environment` (Wayland), `dependency_missing` (Linux sem
     ImageMagick/xrandr), `monitor_not_found`, `screen_too_large` e
     `screen_capture_failed`.

   Plataformas:
   - Windows: PowerShell + .NET (`System.Drawing`, `Graphics.CopyFromScreen`),
     com seleção de monitor e região via `System.Windows.Forms.Screen`.
   - macOS: `screencapture` + `sips`; exige permissão de Gravação de Tela.
   - Linux X11: `import`/`convert`/`identify` e `xrandr`; Wayland retorna
     `unsupported_environment`.

   Prompt atualizado com regras de privacidade, custo de contexto e tradução
   dos erros (`SYSTEM_PROMPT_VERSION = 23`).

   Referências: contrato em `spectral/shared/device-commands.ts`, driver em
   `spectral/driver/src/commands/screen.ts`, dispatch em
   `spectral/driver/src/commands/executor.ts`, tool em
   `lib/ai/tools/device-tools.ts`, store em `lib/devices/screenshot-store.ts`,
   rota em `app/api/devices/[id]/screenshots/[screenshotId]/route.ts`, card em
   `components/chat/tool-part-card.tsx` e testes em
   `lib/devices/command-result-screenshot.test.ts`,
   `lib/devices/screenshot-store.test.ts` e
   `lib/ai/tools/device-screenshot.test.ts`.

5. Clipboard (`device-read-clipboard` + `device-write-clipboard`).
   Status: implementado (item 4 do roadmap).

   A IA lê e substitui o texto da área de transferência do PC, permitindo
   copiar/colar entre chat e dispositivo. Apenas texto neste MVP; imagens e
   arquivos ficam para depois.

   - Tools: `device-read-clipboard` com `{ deviceId }` e
     `device-write-clipboard` com `{ deviceId, text }`.
   - Leitura limitada a 100 mil caracteres
     (`DEVICE_CLIPBOARD_TEXT_MAX_LENGTH`). O resultado traz
     `clipboard{ text, length, truncated }`, com `length` igual ao tamanho
     original e `truncated: true` quando o conteúdo foi cortado.
   - Escrita aceita de 1 a 100 mil caracteres e rejeita caracteres de controle
     (tab, CR e LF são permitidos). O texto substitui o conteúdo atual.
   - Erros: `clipboard_unavailable` (falha ao ler o clipboard),
     `clipboard_write_failed`, `dependency_missing` (Linux X11 sem
     `xclip`/`xsel`) e `unsupported_environment` (Wayland sem `wl-clipboard`).
     Quando o clipboard não tem texto, a leitura tende a voltar vazia.

   Plataformas:
   - Windows: `Get-Clipboard -Raw`/`Set-Clipboard` via PowerShell. A escrita usa
     arquivo temporário UTF-8 para evitar limites de variável de ambiente e
     injeção.
   - macOS: `pbpaste`/`pbcopy`.
   - Linux X11: `xclip` com fallback para `xsel`.
   - Wayland: `wl-paste`/`wl-copy` (`wl-clipboard`); sem o pacote retorna
     `unsupported_environment`.

   Prompt atualizado com regras de privacidade (clipboard pode conter senhas e
   tokens), confirmação antes de sobrescrever o conteúdo atual e tradução dos
   erros (`SYSTEM_PROMPT_VERSION = 24`).

   Referências: contrato em `spectral/shared/device-commands.ts`, driver em
   `spectral/driver/src/commands/clipboard.ts`, dispatch em
   `spectral/driver/src/commands/executor.ts`, schema em
   `spectral/backend/src/websocket/messages.ts`, tools em
   `lib/ai/tools/device-tools.ts` e testes em
   `lib/devices/commands.test.ts`, `lib/devices/command-result-clipboard.test.ts`
   e `lib/ai/tools/device-tools.test.ts`.

6. Mouse (`device-move-mouse` + `device-click` + `device-scroll` + `device-drag`).
   Status: implementado (item 3 do roadmap).

   A IA move o cursor, clica, rola e arrasta em coordenadas da tela, fechando o
   ciclo capturar → agir → verificar. O controle é por coordenada, não por
   elemento de UI: a coordenada vem da imagem do `device-screenshot`.

   - Tools: `device-move-mouse` com `{ deviceId, x, y, screenshotId? }`;
     `device-click` com `{ deviceId, x?, y?, screenshotId?, button?, count? }`;
     `device-scroll` com
     `{ deviceId, x?, y?, screenshotId?, direction, amount? }`; `device-drag` com
     `{ deviceId, from, to, screenshotId?, button?, durationMs? }`.
   - Com `screenshotId`, `x`/`y` e `from`/`to` são inteiros normalizados de 0 a
     1000 na imagem retornada por `device-screenshot` (0 = borda esquerda/topo,
     1000 = borda direita/baixo); o servidor converte para nativos com
     `region.x + normalizadoX * (region.width / 1000)` (e o equivalente em Y).
     Sem `screenshotId`, as coordenadas são pixels nativos do sistema. `scale` é
     a escala do SO, não o fator de redimensionamento.
   - Para alvos pequenos, use grounding coarse-to-fine: capture a tela ou a
     janela (`windowId`), recorte com `screenshotId` + `region` normalizado para
     ampliar e clique com o `screenshotId` do recorte; confirme com nova captura.
     O driver eleva `maxWidth` até a largura nativa em capturas de região. O
     prompt também prefere atalhos confiáveis (por exemplo, `ctrl+w` para fechar
     a aba ativa) quando o usuário não exigir o mouse.
   - Em multi-monitor, aceita valores negativos. Limite de `-100_000` a
     `100_000` para evitar entradas absurdas.
   - `click`: botões `left` (padrão), `right` e `middle`; `count` de 1 a 3
     (padrão 1). Sem `x`/`y`, clica onde o cursor está.
   - `scroll`: direções `up`, `down`, `left` e `right`; `amount` de 1 a 50
     (padrão 3). Sem `x`/`y`, rola na posição atual do cursor.
   - `drag`: `from`/`to` obrigatórios, `button` (padrão `left`) e `durationMs`
     de 100 a 10.000 ms (padrão 500). O driver interpola o movimento em passos.
   - O prompt exige confirmação antes de clicar/arrastar e proíbe sequências de
     cliques sem verificar o resultado. Prefira `type-text`/`press-key` com
     `windowId` para preencher formulários em vez de clicar em cada campo.
   - Resultado: `ok: true` (a verificação visual fica por conta de um novo
     `device-screenshot`).

   Plataformas:
   - Windows: PowerShell + `SetCursorPos`/`mouse_event`, com
     `SetProcessDPIAware` para que as coordenadas do mouse usem os mesmos pixels
     físicos da captura.
   - macOS: JXA/CoreGraphics via `osascript`; exige permissão de Acessibilidade
     e retorna `permission_denied` quando faltar.
   - Linux X11: `xdotool`; Wayland ou ausência de `DISPLAY` retornam
     `unsupported_environment`, e `xdotool` ausente retorna
     `dependency_missing`.
   - Erros: `screenshot_not_found`, `screenshot_device_mismatch`,
     `unsupported_environment`, `permission_denied`, `dependency_missing`,
     `invalid_coordinates` e `mouse_action_failed`.

   Prompt atualizado com regras de coordenadas, confirmação e tradução dos erros
   (`SYSTEM_PROMPT_VERSION = 26`).

   Referências: contrato em `spectral/shared/device-commands.ts`, driver em
   `spectral/driver/src/commands/mouse.ts`, dispatch em
   `spectral/driver/src/commands/executor.ts`, tools em
   `lib/ai/tools/device-tools.ts` e testes em `lib/devices/commands.test.ts` e
   `lib/ai/tools/device-tools.test.ts`.

7. UI Automation (`device-inspect-ui` + `device-ui-action`).
   Status: implementado no Windows (MVP determinístico).

   A IA inspeciona a árvore de acessibilidade de uma janela e age em controles
   por `runtimeId`, sem mover o cursor e sem estimar pixels. É o caminho preferido
   para abas, botões, menus, campos e checkboxes; a captura + clique continua
   como fallback para canvas, jogos e apps sem acessibilidade.

   - Tools: `device-inspect-ui` com
     `{ deviceId, windowId, find?, role?, maxResults?, depth?, includeOffscreen? }`
     retorna `ui{ windowId, windowTitle, elements[], scanned, truncated }`;
     `device-ui-action` com `{ deviceId, windowId, runtimeId, action? }` executa
     `invoke`, `select`, `toggle`, `expand`, `collapse` ou `focus` e retorna
     `uiAction{ windowId, action, element }` com o estado depois da ação.
   - Cada elemento traz `runtimeId` (runtime id do UIA serializado por `.`),
     `name`, `role` sem o prefixo `ControlType`, `bounds`/`center` em pixels
     nativos, `enabled`, `focused`, `selected`, `expanded`, `actions`,
     `automationId` e `path` de ancestrais.
   - O `runtimeId` é temporário: o driver reencontra o elemento enumerando a
     árvore no momento da ação. Se o elemento sumiu, retorna
     `element_not_found` e a IA precisa inspecionar de novo.
   - `invoke` em controles destrutivos (fechar, excluir, enviar, salvar, sair)
     exige autorização explícita do usuário. Ações de navegação (`select`,
     `toggle`, `expand`, `collapse`, `focus`) são livres.
   - Plataformas: Windows via PowerShell + UIAutomationClient, com DPI awareness
     v2 para alinhar os bounds à captura. macOS (AXUIElement) e Linux (AT-SPI)
     retornam `unsupported_platform` nesta fase.
   - Erros: `window_not_found`, `element_not_found`, `pattern_not_supported`,
     `action_failed`, `ui_inspection_failed` e `unsupported_platform`.

   Prompt atualizado para preferir o caminho determinístico e manter o visual
   como fallback (`SYSTEM_PROMPT_VERSION = 28`).

   Referências: contrato em `spectral/shared/device-commands.ts`, driver em
   `spectral/driver/src/commands/ui.ts`, dispatch em
   `spectral/driver/src/commands/executor.ts`, tools em
   `lib/ai/tools/device-tools.ts` e testes em `lib/devices/commands.test.ts` e
   `lib/ai/tools/device-tools.test.ts`.

## Próximas features

Itens do roadmap ainda não implementados, em ordem recomendada (detalhes em
`devices-evolution.md`):

1. **Operações de arquivo completas** — copiar, mover, renomear, apagar,
   `mkdir`, `stat`, zip/unzip.
2. **Transferência app ↔ dispositivo** — upload e download de arquivos.
3. **`run-command` em camadas + task runner** — allowlist maior com políticas.
4. **Processos e ações de sistema** — listar/encerrar processos, energia,
   volume, brilho.
5. **Produto instalável** — instalador, serviço/tray, autostart e auto-update.
6. **Negociação de capacidades e jobs** — driver informa o que suporta e
   comandos longos viram jobs.
7. **Política, aprovação e auditoria por dispositivo** — opt-in por capacidade,
   confirmação proporcional ao risco e registro de ações.
8. **Expansão** — multi-dispositivo, roteamento por capacidade, tarefas
   agendadas e transferência dispositivo → dispositivo.

