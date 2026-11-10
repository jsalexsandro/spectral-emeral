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
| `device-list` | Lista todos os PCs pareados, inclusive offline | `{}` | `devices[]` com id, nome, hostname, plataforma, arquitetura, status e último contato |
| `device-online-list` | Lista apenas os PCs online agora | `{}` | `devices[]` somente online |
| `device-get-os` | Consulta o sistema operacional do PC | `{ deviceId }` | `os` com `platform`, `type`, `release`, `version`, `architecture` e `elevated` |
| `device-list-apps` | Lista os aplicativos que o PC permite abrir | `{ deviceId }` | `apps[]` com `id` e `name` |
| `device-open-url` | Abre uma URL no navegador padrão do PC | `{ deviceId, url }` | `ok` |
| `device-open-app` | Abre um aplicativo da allowlist no PC | `{ deviceId, appId }` | `ok` + `output` |
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
| `device-screenshot` | Captura a tela inteira, um monitor ou uma região e envia a imagem ao modelo | `{ deviceId, monitor?, region?, maxWidth?, quality?, format? }` | `ok` + `screenshot` com id, largura, altura, escala, monitor, região, formato e tamanho; a imagem é anexada ao modelo, não ao histórico |
| `device-list-files` | Lista arquivos e pastas do PC (somente leitura) | `{ deviceId, path?, depth?, showHidden?, maxEntries? }` | `entries[]` com nome, caminho, tipo, tamanho e modificação |
| `device-read-file` | Lê conteúdo de texto de um arquivo (somente leitura) | `{ deviceId, path, offset?, limit? }` | `file` com `content`, linhas e `truncated` |
| `device-glob` | Busca arquivos por padrão glob (somente leitura) | `{ deviceId, pattern, path?, showHidden?, maxResults? }` | `paths[]` de arquivos |
| `device-grep` | Busca texto dentro de arquivos (somente leitura) | `{ deviceId, pattern, path?, glob?, caseSensitive?, maxResults? }` | `matches[]` com arquivo, linha, coluna e trecho |
| `device-check-admin` | Verifica se o dispositivo está com privilégios de administrador | `{ deviceId }` | `admin: true/false` |
| — | `defaultWorkingDirectory` (campo do dispositivo) | `string | null` | Pasta padrão do dispositivo, retornada em `device-list`/`device-get` e enviada ao driver em `device:authenticated`. Usada como `cwd` padrão de `run-command`. |
| `device-write-file` | Escreve/sobrescreve conteúdo de texto em um arquivo (gravação) | `{ deviceId, path, content }` | `write` com `path`, `size`, `created` |
| `device-edit-file` | Substitui uma ocorrência exata de texto dentro de um arquivo (edição) | `{ deviceId, path, oldText, newText }` | `edit` com `path`, `replacements`, `oldTextLength`, `newTextLength` |

### Detalhes

- `device-get-os` retorna dados reais do driver (`node:os`), incluindo `elevated`
  para indicar se o driver está rodando com privilégios de administrador.
- `device-open-url` aceita apenas `http://` e `https://`, até 2048 caracteres,
  sem usuário/senha na URL.
- `device-open-app` aceita apenas `appId` da allowlist do driver:
  `chrome`, `edge`, `firefox`, `notepad`, `explorer`, `vscode`, `terminal` e
  `calculator`. Use `device-list-apps` antes para descobrir os ids disponíveis.
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
- `device-write-file` escreve ou sobrescreve um arquivo de texto no dispositivo.
  Cria o arquivo se não existir. Máximo de 1 MB de conteúdo. O caminho deve
  estar dentro da pasta do usuário e não pode ser um caminho bloqueado.
- `device-edit-file` substitui uma ocorrência exata de `oldText` por `newText`
  dentro de um arquivo. O texto antigo deve aparecer exatamente uma vez no
  arquivo; se aparecer mais de uma vez, a edição é rejeitada. Máximo de 1 MB
  no arquivo resultante.
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
3. chama `device-list-apps` e embute `apps[]` no `<select>` do widget;
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
- O driver não executa shell arbitrário fora da allowlist, escreve/edita apenas
  dentro do sandbox da pasta do usuário e só captura tela sob comando explícito
  da tool `device-screenshot`. Screenshots ficam no máximo 15 minutos em
  armazenamento temporário e não entram no histórico do chat. A leitura de
  arquivos é restrita à pasta de usuário com sandbox e denylist de caminhos sensíveis
  (`.ssh`, `.gnupg`, `.aws`, credenciais, perfis de navegador, arquivos do
  sistema, etc.).
- O driver deve ser iniciado com privilégios de administrador (PowerShell como
  Administrador ou `sudo`) para que comandos futuros possam ser elevados. Isso é
  refletido em `device-get-os` (`elevated`).

## Confirmação no chat

- `device-type-text` e `device-press-key` podem afetar qualquer janela em foco
  quando não recebem `windowId`. Antes de executá-las, o assistente lista as
  janelas, escolhe a alvo e pede confirmação em texto (sim/não). O comando só é
  enviado ao dispositivo após o usuário confirmar.
- Se o usuário não confirmar, o comando não é executado.
- `device-window-action` (incluindo `close`) não exige confirmação textual nesta
  versão. O fechamento continua gracioso, então o aplicativo ainda pode pedir
  para salvar alterações.
- No futuro, haverá um modo/opção `requireApproval: false` (autônomo) para
  desativar confirmações.

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
- Prompt: `lib/ai/prompts/sections/devices.ts` (`SYSTEM_PROMPT_VERSION = 26`)
- Backend: `spectral/backend/src/websocket/command-bus.ts` e `spectral/backend/src/http/internal.ts`
- Driver: `spectral/driver/src/commands/executor.ts`,
  `spectral/driver/src/commands/files.ts` e
  `spectral/driver/src/commands/screen.ts`
- Screenshot no app: `lib/devices/screenshot-store.ts`,
  `lib/devices/screenshot-tool.ts` e
  `app/api/devices/[id]/screenshots/[screenshotId]/route.ts`
- Arquitetura completa: `specs/devices-connect.md`
- Roadmap de evolução (screenshot, mouse, janelas, política, auditoria):
  `specs/devices-evolution.md`


testar muito essa api de device, adicionar mais funcionalidades deixar ela mais completa.
da privilegios de adm pro driver pra ele executar funções complexas
no futuro implemntar um ferramente pra ele fazer task complexas e ter feedback da tela