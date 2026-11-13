# Integração entre o chat e os dispositivos

Documento das tools de dispositivo disponíveis para o chat do Spectral.

> **Escopo atual: PC.** Todas as tools abaixo controlam computadores
> (Windows, macOS e Linux) pareados à conta. Celular e TV Android ainda não são
> suportados.

## Fluxo

```text
Usuário --chat--> Modelo --tool--> Next.js --HTTP interno--> Backend --WS--> Driver (PC)
                                                                               |
Usuário <--chat-- Modelo <--tool-- Next.js <--HTTP interno-- Backend <--WS----+
```

- As tools rodam no servidor Next.js e derivam o `userId` da sessão autenticada.
- O backend valida propriedade, revogação e presença antes de encaminhar o comando.
- O driver executa no PC e devolve o resultado correlacionado por `id`.

## Tools de dispositivo para PC

Todas exigem um `deviceId` de um dispositivo **online** retornado por
`device-list` ou `device-online-list` (exceto as duas primeiras, que não recebem
`deviceId`).

| Tool | Para que serve | Entrada | Retorno |
| --- | --- | --- | --- |
| `device-list` | Lista todos os PCs pareados, inclusive offline | `{}` | `devices[]` com id, nome, hostname, plataforma, arquitetura, status, último contato e `confirmDestructive` |
| `device-online-list` | Lista apenas os PCs online agora | `{}` | `devices[]` somente online, com `confirmDestructive` |
| `device-env` | Retrato da máquina para o modelo não adivinhar shell, caminhos e runtimes | `{ deviceId }` | `env` com plataforma, arquitetura, hostname, usuário, home, temp, cwd, shell padrão, shells e runtimes instalados, elevação, locale e `capabilities` |
| `device-shell` | Executa um script de shell na máquina (build, git, rede, testes) | `{ deviceId, script, shell?, cwd?, env?, stdin?, maxOutputBytes?, timeoutMs? }` | `shell` com `shell`, `shellPath`, `cwd`, `exitCode`, `stdout`, `stderr`, tamanhos, `durationMs`, `truncated` e `timedOut` |
| `device-get-os` | Consulta o sistema operacional do PC | `{ deviceId }` | `os` com `platform`, `type`, `release`, `version`, `architecture` e `elevated` |
| `device-list-apps` | Lista os aplicativos que o driver consegue abrir, com busca e cache de descoberta | `{ deviceId, query?, refresh?, limit? }` | `apps[]` com `id`, `name`, `source` e `target` quando conhecido |
| `device-find-app` | Verifica se um aplicativo existe no PC e retorna as correspondências | `{ deviceId, query, refresh?, limit? }` | `found`, `query` e `apps[]` ordenados por relevância |
| `device-open-url` | Abre uma URL no navegador padrão do PC | `{ deviceId, url }` | `ok` |
| `device-open-app` | Abre um aplicativo por id descoberto ou caminho absoluto, com argumentos opcionais | `{ deviceId, appId?, path?, args?, cwd? }` | `ok` + `output` |
| `device-open-path` | Abre um arquivo ou pasta no app padrão do PC | `{ deviceId, path }` | `ok` + `output` |
| `device-register-app` | Cadastra um app no catálogo local do dispositivo | `{ deviceId, name, path, args?, cwd? }` | `ok` + `output` + `apps[]` |
| `device-remove-app` | Remove um app do catálogo local do dispositivo | `{ deviceId, appId }` | `ok` + `output` |
| `device-type-text` | Digita texto na janela alvo do PC | `{ deviceId, text, windowId? }` | `ok` + `window` (requer confirmação em texto antes de executar) |
| `device-press-key` | Pressiona uma tecla ou combinação na janela alvo do PC | `{ deviceId, key, modifiers?, windowId? }` | `ok` + `window` (requer confirmação em texto antes de executar) |
| `device-read-clipboard` | Lê o texto atual da área de transferência do PC | `{ deviceId }` | `clipboard` com `text`, `length` e `truncated` (usar apenas quando o usuário pedir) |
| `device-write-clipboard` | Substitui o texto da área de transferência do PC | `{ deviceId, text }` | `ok` (avisa que o conteúdo atual será substituído) |
| `device-move-mouse` | Move o cursor para uma coordenada da tela do PC | `{ deviceId, x, y, screenshotId? }` | `ok` |
| `device-click` | Clica em um ponto da tela do PC | `{ deviceId, x?, y?, screenshotId?, button?, count? }` | `ok` (requer confirmação em texto antes de executar) |
| `device-scroll` | Rola a tela do PC na direção indicada | `{ deviceId, x?, y?, screenshotId?, direction, amount? }` | `ok` |
| `device-drag` | Arrasta de um ponto a outro na tela do PC | `{ deviceId, from, to, screenshotId?, button?, durationMs? }` | `ok` (requer confirmação em texto antes de executar) |
| `device-list-windows` | Lista as janelas abertas do PC | `{ deviceId, includeMinimized?, limit? }` | `windows[]` com id, título, processo, bounds, foco e minimizada |
| `device-focus-window` | Foca uma janela específica do PC | `{ deviceId, windowId }` | `ok` + `window` |
| `device-window-action` | Minimiza, maximiza, restaura ou fecha uma janela do PC | `{ deviceId, windowId, action }` | `ok` + `window` em `minimize`/`maximize`/`restore`; `ok` em `close` |
| `device-inspect-ui` | Inspeciona a árvore de acessibilidade (UI Automation) de uma janela | `{ deviceId, windowId, find?, role?, maxResults?, depth?, includeOffscreen? }` | `ui` com `windowTitle`, `elements[]` (runtimeId, nome, papel, bounds, centro, estado, ações), `scanned` e `truncated` |
| `device-ui-action` | Executa uma ação de acessibilidade em um elemento sem mover o cursor | `{ deviceId, windowId, runtimeId, action? }` | `uiAction` com `windowId`, `action` e o estado do elemento depois da ação (ou último conhecido se ele foi removido) |
| `device-screenshot` | Captura a tela inteira, um monitor ou uma região e envia a imagem ao modelo | `{ deviceId, monitor?, region?, maxWidth?, quality?, format? }` | `ok` + `screenshot` com id, largura, altura, escala, monitor, região, formato e tamanho; a imagem é anexada ao modelo, não ao histórico |
| `device-list-files` | Lista arquivos e pastas do PC (somente leitura) | `{ deviceId, path?, depth?, showHidden?, maxEntries? }` | `entries[]` com nome, caminho, tipo, tamanho e modificação |
| `device-read-file` | Lê conteúdo de texto de um arquivo (somente leitura) | `{ deviceId, path, offset?, limit? }` | `file` com `content`, linhas e `truncated` |
| `device-glob` | Busca arquivos por padrão glob (somente leitura) | `{ deviceId, pattern, path?, showHidden?, maxResults? }` | `paths[]` de arquivos |
| `device-grep` | Busca texto dentro de arquivos (somente leitura) | `{ deviceId, pattern, path?, glob?, caseSensitive?, maxResults? }` | `matches[]` com arquivo, linha, coluna e trecho |
| `device-check-admin` | Verifica se o dispositivo está com privilégios de administrador | `{ deviceId }` | `admin: true/false` |
| — | `defaultWorkingDirectory` (campo do dispositivo) | `string | null` | Pasta padrão do dispositivo, retornada em `device-list`/`device-get` e enviada ao driver em `device:authenticated`. Usada como `cwd` padrão de `run-command`. |
| `device-write-file` | Escreve/sobrescreve conteúdo de texto em um arquivo (gravação) | `{ deviceId, path, content }` | `write` com `path`, `size`, `created` |
| `device-edit-file` | Substitui uma ocorrência exata de texto dentro de um arquivo (edição) | `{ deviceId, path, oldText, newText }` | `edit` com `path`, `replacements`, `oldTextLength`, `newTextLength` |
| `device-mkdir` | Cria um diretório (gravação) | `{ deviceId, path, recursive? }` | `mkdir` com `path` e `created` |
| `device-stat` | Consulta metadados de um caminho sem seguir links (somente leitura) | `{ deviceId, path }` | `stat` com tipo, tamanho, datas, modo, `isSymlink` e `linkTarget` |
| `device-copy` | Copia arquivo ou árvore de diretórios (gravação) | `{ deviceId, from, to, overwrite?, recursive? }` | `copy` com `from`, `to`, `files` e `bytes` |
| `device-move` | Move ou renomeia arquivo/diretório (gravação) | `{ deviceId, from, to, overwrite? }` | `move` com `from` e `to` |
| `device-delete` | Apaga arquivo ou diretório, para a lixeira por padrão (destrutivo) | `{ deviceId, path, recursive?, permanent? }` | `delete` com `path`, `deleted` e `toTrash` |
| `device-apply-patch` | Aplica vários trechos exatos de forma atômica (edição) | `{ deviceId, path, patches: [{ oldText, newText, replaceAll? }] }` | `patch` com `path`, `applied` e `replacements` |

### Detalhes

- `device-get-os` retorna dados reais do driver (`node:os`), incluindo `elevated`
  para indicar se o driver está rodando com privilégios de administrador.
- `device-open-url` aceita apenas `http://` e `https://`, até 2048 caracteres,
  sem usuário/senha na URL.
- `device-open-app` aceita exatamente um entre `appId` e `path`. O `appId` pode
  ser um app fixo (`chrome`, `edge`, `firefox`, `notepad`, `explorer`, `vscode`,
  `terminal`, `calculator`), um atalho descoberto no Windows ou um app
  personalizado do dispositivo. `path` precisa ser absoluto e apontar para uma
  extensão suportada (`.exe`, `.cmd`, `.bat`, `.com`, `.lnk`, `.msc`,
  `.appref-ms`, `.app`). Use `device-find-app`/`device-list-apps` antes para
  descobrir o id. Ids desconhecidos retornam `app_not_found`; caminhos sem
  extensão suportada retornam `unsupported_app_path`. `args` aceita até 32
  argumentos de 1–512 caracteres, sem caracteres de controle ou quebra de linha;
  `cwd` precisa ser um diretório existente. Com `args` ou `cwd` o risco é
  `launch` e o build pede aprovação; sem eles o risco é `input`.
- `device-open-path` abre um arquivo ou pasta no app padrão, sem aprovação.
  Recusa a denylist de extensões de app (`invalid_path`), mas não é uma allowlist:
  scripts e instaladores fora dela ainda passam (ver `device-execution.md` §4.3c,
  Achado 1).
- `device-find-app` é a verificação de existência: aceita nome, id ou trecho do
  caminho, retorna `found` e lista as correspondências com `source`
  (`builtin`, `start-menu`, `app-path` ou `custom`). No Windows a descoberta
  cobre atalhos do Menu Iniciar e o registro App Paths, com cache de 5 minutos;
  `refresh: true` refaz a varredura.
- Apps personalizados ficam no catálogo local do driver
  (`~/.spectral/driver/apps.json`, até 100, dedupe por caminho) e são
  cadastrados por `device-register-app`; aparecem como `source: "custom"`.
  `device-remove-app` só esquece a entrada, não desinstala nem apaga o
  executável.
- `device-type-text` aceita de 1 a 2000 caracteres e rejeita caracteres de
  controle (exceto tab, CR e LF). Sem `windowId`, o texto vai para a janela que
  estiver em foco; com `windowId`, o driver foca a janela e digita no mesmo
  comando.
- `device-press-key` aceita letras `a-z`, dígitos `0-9`, `enter`, `tab`,
  `escape`, `backspace`, `delete`, `space`, `insert`, setas, `home`, `end`,
  `pageup`, `pagedown` e `f1`-`f12`, com modificadores `ctrl`, `alt`, `shift` e
  `meta`. As combinações `alt+F4` e `ctrl+alt+delete` são bloqueadas. Também
  aceita `windowId` opcional.
- `device-list-windows` retorna até 20 janelas por padrão (máximo 30), com
  `includeMinimized` para incluir janelas minimizadas. Use antes de digitar ou
  pressionar teclas para escolher a janela certa.
- `device-focus-window` recebe um `windowId` retornado por
  `device-list-windows`. Se o SO bloquear o foco, retorna `focus_denied`; se a
  janela sumiu, retorna `window_not_found`. No Wayland, ambos retornam
  `unsupported_environment`.
- `device-window-action` recebe o mesmo `windowId` e uma `action`:
  `minimize` (minimiza), `maximize` (maximiza), `restore` (volta ao tamanho
  normal, desfazendo minimizado/maximizado) ou `close` (fecha). As três
  primeiras retornam o snapshot atualizado em `window`; `close` retorna apenas
  `ok: true`.
- `close` é gracioso: no Windows envia `WM_CLOSE`, no macOS pressiona o botão de
  fechar via Acessibilidade e no Linux usa `wmctrl -c`. O aplicativo pode abrir
  um diálogo para salvar alterações e continuar aberto; não há força bruta nem
  encerramento por processo.
- `device-inspect-ui` percorre a árvore de UI Automation no Windows e retorna
  controles com nome ou AutomationId. `find` filtra por trecho do nome ou
  AutomationId, `role` filtra pelo papel sem o prefixo `ControlType`
  (`Button`, `TabItem`, `MenuItem`, `Edit`, `CheckBox` etc.), `maxResults` vai de
  1 a 100 (padrão 40), `depth` de 1 a 12 (padrão 10) e `includeOffscreen` inclui
  controles fora da área visível. Cada elemento traz `runtimeId` serializado
  (`int[]` unido por `.`), `bounds` e `center` em pixels nativos, estado
  (`focused`, `selected`, `expanded`) e a lista `actions` suportadas. O driver
  usa DPI awareness v2 para que os bounds batam com a captura de tela.
- `device-ui-action` recebe o `runtimeId` e a mesma `windowId` da inspeção.
  Ações: `invoke` (InvokePattern), `select` (SelectionItemPattern), `toggle`
  (TogglePattern), `expand`/`collapse` (ExpandCollapsePattern) e `focus`
  (SetFocus). Para abas use `select`: `focus` só concentra o foco de teclado e
  não ativa a aba. O driver reencontra o elemento enumerando a árvore no momento
  da ação; o `runtimeId` é temporário e não deve ser reutilizado depois de
  mudanças. Em navegadores, títulos de abas mudam com frequência e podem
  recriar o elemento; se vier `element_not_found`, inspecione de novo
  imediatamente antes de agir. Erros: `window_not_found`, `element_not_found`,
  `pattern_not_supported`, `action_failed` e `ui_inspection_failed`. macOS e
  Linux retornam `unsupported_platform` nesta fase e o caminho visual continua
  disponível como fallback.
- O caminho determinístico (`device-inspect-ui` + `device-ui-action`) é preferido
  para controles nativos; a captura + `device-click` fica para canvas, jogos,
  aplicativos sem acessibilidade e quando a árvore não expõe o alvo.
- Ações destrutivas por `invoke` (fechar, excluir, enviar, salvar, sair, fechar
  aba/janela) exigem autorização explícita do usuário, assim como as tools de
  mouse e janela. O driver não fecha nada por conta própria.
- `device-list-files` lista a pasta do usuário por padrão, com `depth` de 1 a 3
  e no máximo 200 itens. Não segue links simbólicos.
- `device-read-file` lê até 2000 linhas / 64 KB por chamada, com `offset` e
  `limit` para paginação. Não lê arquivos binários nem arquivos acima de 1 MB.
- `device-glob` aceita padrões como `*.md`, `src/**/*.ts` e `Documentos/*.txt`,
  limitado a 200 resultados. Ignora `node_modules`, `.git`, `dist`, `build` e
  pastas grandes por padrão.
- `device-grep` aceita expressão regular (case-insensitive por padrão), opcional
  `path` e `glob`, limitado a 100 correspondências. Não lê arquivos binários.
- `device-check-admin` retorna `admin: true` quando o driver está elevado
  (PowerShell como Administrador ou `sudo`). Use para responder se o PC tem
  privilégios de adm.
- `device-env` deve ser chamado antes de montar scripts: devolve o shell padrão,
  os shells instalados (`pwsh`, `powershell`, `cmd`, `bash`, `sh`, `zsh`), os
  runtimes encontrados (`node`, `npm`, `pnpm`, `yarn`, `bun`, `python`, `pip`,
  `git`, `docker`, `rg`), usuário, home, temp, diretório atual, elevação e
  locale. O resultado é cacheado no driver por 5 minutos.
- `device-shell` grava o script em um arquivo temporário e nunca o interpola numa
  linha de comando. `shell` aceita `auto` (padrão), `pwsh`, `powershell`, `cmd`,
  `bash`, `sh` e `zsh`; no Windows, `auto` usa `pwsh`, depois `powershell` e por
  fim `cmd`. `cwd` precisa estar dentro do home ou da pasta padrão do
  dispositivo. `env` aceita até 32 variáveis extras, `stdin` até 64 KB,
  `maxOutputBytes` de 1 KB a 512 KB (padrão 64 KB por stream) e `timeoutMs` de
  1 s a 60 s (padrão 30 s). Acima do teto de saída, o resultado mantém cabeça e
  cauda com um marcador de bytes omitidos. macOS e Linux retornam
  `unsupported_platform` nesta versão.
- Erros do shell: `unsupported_platform`, `shell_unavailable`,
  `cwd_outside_root`, `command_timeout`, `output_too_large`, `policy_denied` e
  `command_failed`. O driver mata a árvore de processos no timeout.
- `device-run-command` continua sendo a allowlist curta de consulta; não é o
  caminho para scripts. Fluxos reais usam `device-env` + `device-shell`.
- `confirmDestructive` vem em `device-list`/`device-online-list`: quando `true`,
  ações destrutivas ou de sistema pedem aprovação no chat; quando `false`, o
  dispositivo está em Poder Total.
- `device-write-file` escreve ou sobrescreve um arquivo de texto no dispositivo.
  Cria o arquivo se não existir. Máximo de 1 MB de conteúdo. O caminho deve
  estar dentro da pasta do usuário e não pode ser um caminho bloqueado.
- `device-edit-file` substitui uma ocorrência exata de `oldText` por `newText`
  dentro de um arquivo. O texto antigo deve aparecer exatamente uma vez no
  arquivo; se aparecer mais de uma vez, a edição é rejeitada. Máximo de 1 MB
  no arquivo resultante.
- `device-mkdir` cria um diretório e, com `recursive: true` (padrão), também os
  intermediários. Se já existir como diretório, retorna `created: false` sem
  erro.
- `device-stat` usa `lstat` e não segue o último componente: informa `type`
  (`file`, `directory`, `symlink`, `other`), tamanho, datas, modo, `isSymlink` e
  `linkTarget`. Use antes de copiar, mover ou apagar.
- `device-copy` copia arquivos ou árvores (`recursive: true` por padrão) arquivo
  por arquivo e ignora symlinks. `overwrite: false` (padrão) falha se o destino
  existir; copiar um diretório para dentro dele mesmo retorna
  `invalid_destination`.
- `device-move` usa `rename` no mesmo volume e copia + apaga a origem entre
  volumes. Renomear no mesmo diretório é só usar `from`/`to`. `overwrite: false`
  (padrão) falha se o destino existir.
- `device-delete` envia para a lixeira do Windows por padrão (`toTrash: true`).
  `permanent: true` apaga de vez e só deve ser usado com confirmação explícita.
  Diretórios com conteúdo exigem `recursive: true`; symlinks são removidos como
  link, nunca seguidos. As raízes permitidas (home e pasta padrão) não podem ser
  apagadas (`protected_path`). Fora do Windows, sem `permanent` retorna
  `unsupported_platform`.
- `device-apply-patch` aplica de 1 a 10 patches em uma única gravação: se algum
  `oldText` não existir ou aparecer mais de uma vez (sem `replaceAll: true`),
  nada é gravado. Preserva CRLF/BOM e limita o resultado a 1 MB. Prefira ler o
  arquivo antes e conferir com `device-read-file`/`device-stat` depois.
- Todas as operações de arquivo compartilham o sandbox: home + pasta padrão do
  dispositivo, denylist e bloqueio de symlink. Caminhos relativos resolvem contra
  a pasta padrão; `~` resolve contra o home.
- `device-screenshot` captura a tela inteira (todos os monitores), uma janela
  por `windowId`, um monitor pelo índice (`0` = primeiro) ou uma `region`. Use
  apenas um alvo por captura. Com `windowId`, o driver foca a janela e captura
  os limites dela no mesmo comando. `maxWidth` vai de 320 a 3840 (padrão 1280),
  `quality` de 30 a 90 (padrão 70, só JPEG) e `format` aceita `jpeg` (padrão) ou
  `png`. O driver captura em PNG nativo e reencoda reduzindo a largura até caber
  em 400 KB; em capturas de região ele eleva `maxWidth` até a largura nativa
  para não perder detalhe.
- O resultado da tool para o chat contém apenas metadados. Os bytes ficam em
  armazenamento temporário do app por 15 minutos e são anexados ao modelo via
  `toModelOutput`; `imageBase64` nunca é persistido no histórico. A imagem é
  servida por `GET /api/devices/:id/screenshots/:screenshotId`, que exige sessão
  e ownership do dispositivo.
- `scale` é o fator de pixels nativos por unidade do sistema operacional (por
  exemplo, `2` em telas Retina) e `region` é o retângulo capturado. A imagem pode
  ser redimensionada para caber em `maxWidth`; nesse caso `screenshot.width` é a
  largura final. O driver detecta capturas 100% uniformes em alvos sem `region`
  explícita e retorna `screen_unstable`. Erros comuns:
  `screen_permission_denied` (macOS sem Gravação de Tela),
  `unsupported_environment` (Wayland), `dependency_missing` (ImageMagick/xrandr no
  Linux), `monitor_not_found`, `window_bounds_unavailable`, `screen_unstable`,
  `screen_too_large` e `screen_capture_failed`.
- Por privacidade, a captura só deve ser usada quando o usuário pedir ou para
  confirmar uma ação autorizada. O prompt proíbe capturas em loop e exige cuidado
  com senhas e dados sensíveis.
- `device-read-clipboard` lê apenas texto, com limite de 100 mil caracteres. O
  resultado traz `length` (tamanho original) e `truncated: true` quando o
  conteúdo foi cortado. O clipboard pode conter senhas, tokens e dados
  sensíveis: a leitura só deve ocorrer quando o usuário pedir explicitamente, e
  o conteúdo não deve ser repetido sem necessidade nem enviado para fora.
- `device-write-clipboard` aceita de 1 a 100 mil caracteres e rejeita caracteres
  de controle (tab, CR e LF são permitidos). A operação substitui o conteúdo
  atual; o prompt exige aviso e confirmação antes de sobrescrever algo que o
  usuário possa querer manter.
- Erros do clipboard: `clipboard_unavailable` (falha ao ler o clipboard),
  `clipboard_write_failed`, `dependency_missing` (Linux sem `xclip`/`xsel`) e
  `unsupported_environment` (Wayland sem `wl-clipboard`). Quando o clipboard
  não tem texto, a leitura tende a voltar vazia.
- `device-move-mouse` aceita `x` e `y` inteiros entre `-100_000` e `100_000`. Com
  `screenshotId`, as coordenadas são inteiros normalizados de 0 a 1000 na imagem
  retornada por `device-screenshot` (0 = borda esquerda/topo, 1000 = borda
  direita/baixo) e o servidor converte para pixels nativos. Sem `screenshotId`,
  são pixels nativos do sistema; em multi-monitor, valores negativos são válidos.
  Mover o cursor não clica nem altera o conteúdo.
- A conversão usa `nativoX = region.x + normalizadoX * (region.width / 1000)` e a
  fórmula análoga para Y, com o resultado limitado às bordas da captura. O
  `scale` é a escala do SO, não o fator de redimensionamento. Capturas antigas sem
  `width`/`height`/`region` são consideradas expiradas para fins de conversão.
- Grounding coarse-to-fine: capture a tela ou a janela, localize o alvo, capture
  um recorte com `screenshotId` + `region` normalizado para ampliar, clique com o
  `screenshotId` do recorte e confirme com nova captura. Esse fluxo reduz o erro
  de modelos pequenos em alvos como o “x” de uma aba.
- `device-click` aceita `button` `left` (padrão), `right` ou `middle` e `count`
  de 1 a 3 (padrão 1). Informe `x` e `y` juntos (com `screenshotId` opcional) para
  mover antes de clicar; sem eles, clica onde o cursor está. O prompt exige
  confirmação antes de clicar e proíbe sequências sem verificar o resultado.
- `device-scroll` aceita `direction` `up`, `down`, `left` ou `right` e `amount`
  de 1 a 50 (padrão 3). `x` e `y` opcionais (com `screenshotId`) posicionam o
  cursor sobre a área.
- `device-drag` recebe `from` e `to` com `x` e `y`, `button` (padrão `left`) e
  `durationMs` de 100 a 10.000 (padrão 500). Com `screenshotId`, os dois pontos
  são normalizados de 0 a 1000. O driver interpola o movimento em passos; confirme
  antes e capture a tela depois.
- Erros do mouse: `screenshot_not_found` (captura expirada ou inexistente),
  `screenshot_device_mismatch` (captura de outro dispositivo),
  `invalid_coordinates` (normalizado fora de 0–1000), `invalid_region`,
  `permission_denied` (macOS sem Acessibilidade), `unsupported_environment`
  (Wayland ou sem sessão gráfica), `dependency_missing` (Linux X11 sem `xdotool`)
  e `mouse_action_failed`.

## Widget de abrir apps

Quando o usuário pede um seletor ou botão em vez de uma abertura imediata:

1. a IA chama `device-online-list`;
2. se houver mais de um PC online, pergunta qual usar antes de gerar o widget;
3. chama `device-list-apps` (ou `device-find-app`) e embute `apps[]` no
   `<select>` do widget;
4. o clique envia `openDeviceApp` (`deviceId`, `appId`) pela bridge do widget;
5. o app executa `POST /api/devices/{id}/open-app`, que valida sessão e
   ownership, aplica rate limit e chama o mesmo comando `open-app` do driver.

A action `openDeviceApp` fica fora de `aiActionSchema`, então a IA não consegue
executá-la via `runAction`. Ela exige gesto do usuário e nunca é disparada na
carga do widget.

## Regras de segurança

- Só dispositivos online e pertencentes ao usuário autenticado aceitam comandos.
- Um comando em voo por PC; o próximo recebe `device_busy` até o anterior terminar.
- Timeout padrão de 15s por comando (máximo de 60s).
- O endpoint interno do backend exige `x-internal-secret` e nunca deve ser
  exposto publicamente.
- `device-type-text` e `device-press-key` podem afetar qualquer janela em foco
  quando não recebem `windowId`. O prompt exige que a IA liste as janelas antes,
  confirme antes de conteúdo sensível e proíba senhas.
- O shell é liberado por política, não por texto do modelo. O modo da sessão
  (`plan` → `build`) é escolhido no composer e chega ao app por um campo
  estruturado (`executionMode`) — nunca por instrução do modelo.
- `plan` (Modo Leitura, padrão) permite apenas leitura e nega `input`, `write`,
  `exec`, `launch`, `destructive` e `system`. `build` (Modo Construtor) libera
  `input`, `write` e `exec`; `launch`, `destructive` e `system` pedem aprovação,
  exceto quando o dispositivo está em Poder Total (`confirmDestructive: false`).
- `launch` é abrir um app com instruções (`open-app` com `args`/`cwd`): o app
  recebe argumentos e diretório de trabalho, então o lançamento pede aprovação no
  Modo Construtor. `open-app` sem `args`/`cwd` continua `input`.
- `device-open-path` abre arquivo ou pasta no app padrão como `input` (sem
  aprovação). Ele recusa a denylist de extensões de app, mas não é allowlist:
  scripts e instaladores fora dela ainda passam (ver
  `device-execution.md` §4.3c, Achado 1).
- `device-shell` continua sendo a válvula de escape do Modo Construtor (`exec`).
  Scripts que lançam apps (`Start-Process`, `start`, `open`, `xdg-open`,
  `explorer`) ainda não são classificados como `launch`, então o fallback via
  terminal contorna a aprovação do `open-app` (ver `device-execution.md` §4.3c,
  Achado 2).
- Quando uma tool exige aprovação, o app usa o primitivo nativo do AI SDK
  (`toolApproval` + `tool-approval-request`) e o usuário decide no card
  Permitir/Negar. O pedido é assinado no servidor; o modelo nunca recebe a
  decisão como texto e não consegue forjar uma aprovação.
- Toda execução e negação gera um `DeviceAuditEvent` com ferramenta, risco,
  decisão, política, modo, duração, exit code e comando sanitizado. stdout/stderr
  brutos não são gravados.
- O driver escreve/edita apenas dentro do sandbox da pasta do usuário, restringe
  `cwd` do shell ao home/pasta padrão e só captura tela sob comando explícito da
  tool `device-screenshot`. Screenshots ficam no máximo 15 minutos em
  armazenamento temporário e não entram no histórico do chat. A leitura de
  arquivos é restrita à pasta de usuário com sandbox e denylist de caminhos sensíveis
  (`.ssh`, `.gnupg`, `.aws`, credenciais, perfis de navegador, arquivos do
  sistema, etc.).
- O driver deve ser iniciado com privilégios de administrador (PowerShell como
  Administrador ou `sudo`) para que comandos futuros possam ser elevados. Isso é
  refletido em `device-get-os` (`elevated`).

## Aprovação no chat

- O composer tem um chip de modo (`Leitura`, `Construtor`); `Shift+Tab`
  alterna entre os dois. O modo é por chat e fica salvo em `localStorage`
  (`spectral:execution-mode:<chatId>`).
- A confirmação de ações destrutivas é configurada em Configurações →
  Dispositivos (`Pedir confirmação` ou `Poder Total`) e vale para todos os chats.
  Ela nunca fura o Modo Leitura.
- Um pedido de aprovação abre o painel “Execução do agente” e mostra o card com
  Permitir/Negar. A resposta é enviada automaticamente de volta ao agente
  (`sendAutomaticallyWhen`).
- `device-type-text` e `device-press-key` são risco `input`: rodam direto no
  Modo Construtor e são negadas no Modo Leitura. O modelo continua proibido de
  digitar senhas.
- Ações destrutivas (fechar janela/aba, matar processo, exclusão) pedem
  aprovação no Modo Construtor, exceto com Poder Total. O fechamento de janela
  continua gracioso.
- Lançamentos com instruções (`device-open-app` com `args`/`cwd`) pedem
  aprovação no Modo Construtor pelo card Permitir/Negar. `device-open-path` e
  `device-open-app` sem argumentos rodam como `input`.
- Ações não destrutivas de UIA (`select`, `toggle`, `expand`, `collapse`,
  `focus`) e `invoke` em controles de navegação rodam direto no Modo Construtor;
  o `invoke` de controles destrutivos continua exigindo autorização.

## Exemplos de uso no chat

- "Quais PCs estão online?"
- "Qual a versão do Windows do casa-pc?"
- "Abra o YouTube no navegador do casa-pc."
- "Quais aplicativos posso abrir no casa-pc?"
- "Abra o VS Code no casa-pc."
- "Digite 'olá, mundo' no Bloco de Notas do casa-pc."
- "Pressione ctrl+s no casa-pc."
- "Liste os arquivos em Documentos do casa-pc."
- "Leia o README do projeto no casa-pc."
- "Busque 'TODO' em src do casa-pc."
- "Tire um print da tela do casa-pc e veja se o download terminou."
- "Capture só a região do navegador no casa-pc."
- "Feche a aba ativa do Chrome do casa-pc e confirme com um novo print."

## Referências

- Contrato compartilhado: `spectral/shared/device-commands.ts`
- Tools do chat: `lib/ai/tools/device-tools.ts`
- Cliente do backend: `lib/devices/command-client.ts`
- Prompt: `lib/ai/prompts/sections/devices.ts` (`SYSTEM_PROMPT_VERSION = 29`)
- Backend: `spectral/backend/src/websocket/command-bus.ts` e `spectral/backend/src/http/internal.ts`
- Driver: `spectral/driver/src/commands/executor.ts`,
  `spectral/driver/src/commands/shell.ts`,
  `spectral/driver/src/commands/system.ts`,
  `spectral/driver/src/commands/files.ts` e
  `spectral/driver/src/commands/screen.ts`
- Governança: `lib/devices/execution-policy.ts`,
  `lib/devices/tool-approval.ts` e `lib/devices/audit.ts`
- Screenshot no app: `lib/devices/screenshot-store.ts`,
  `lib/devices/screenshot-tool.ts` e
  `app/api/devices/[id]/screenshots/[screenshotId]/route.ts`
- Arquitetura completa: `specs/devices-connect.md`
- Roadmap de evolução (screenshot, mouse, janelas, política, auditoria):
  `specs/devices-evolution.md`


testar muito essa api de device, adicionar mais funcionalidades deixar ela mais completa.
da privilegios de adm pro driver pra ele executar funções complexas
no futuro implemntar um ferramente pra ele fazer task complexas e ter feedback da tela