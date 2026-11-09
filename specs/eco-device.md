### Sistema de devices

Consulte, devices-connect.md
Roadmap de evolução: devices-evolution.md
1. Na conexão com o driver, com um driver devemos configurações basicas ali sobre.
   Essas configurações devem acontecer logo apos ser feita a primeira conexão.
   Será injetadas configurações basicas naquela.

   Na tela deve aparecer a tela configurações:    
   Configs:
    1. Pasta padrão do driver, onde será execultado suas ações.  
       Caso eu mande ele criar um script e não diga o local, será criado ali.

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
   (`SYSTEM_PROMPT_VERSION = 21`). O `maxPayload` do WebSocket subiu para 256 KB
   para acomodar respostas maiores.

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

