# Evolução dos dispositivos (roadmap)

> **Status:** proposta. Nada aqui está implementado além do que está em
> [`specs/chat-device.md`](./chat-device.md).
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
  `device-press-key`, `device-list-files`, `device-read-file`, `device-glob`,
  `device-grep`, `device-check-admin`, `device-write-file`, `device-edit-file`
  e `device-run-command`.
- Widget de abrir apps (`openDeviceApp`) com gesto do usuário.

## O que limita o carro chefe

- **A IA é cega.** Não existe `device-screenshot`. Ela digita e torce para ter
  acertado.
- **A IA era míope.** `device-type-text` e `device-press-key` agiam sobre a
  janela em foco, sem como listar ou focar janelas. Isso foi resolvido com
  `device-list-windows` + `device-focus-window` (item 2), e `type-text`/
  `press-key` agora aceitam `windowId` para focar e agir no mesmo comando.
- **O `device-run-command` não roda nada útil.** A allowlist em
  `spectral/driver/src/commands/files.ts` só tem `dir`, `type`, `echo`,
  `tasklist`, `systeminfo` etc., e o denylist bloqueia `node`, `git`, `python`,
  `npm` e shell. Ou seja: não dá para "criar um script e executar", que é
  justamente a promessa do produto.
- **Não há mouse, clipboard nem operações de arquivo básicas** (copiar, mover,
  renomear, apagar, upload/download).
- **O driver não é um produto instalável.** Hoje é `npm run dev:driver` em um
  terminal aberto. Sem instalador, serviço/tray, autostart e auto-update, a
  adoção fica travada.
- **Não há política por dispositivo, aprovação real nem auditoria.** A
  confirmação é apenas texto no chat.
- **O transporte limita o tamanho e a duração.** O WebSocket do backend usa
  `maxPayload` de 256 KB e cada comando tem timeout máximo de 60s, com um comando
  em voo por PC (`device_busy`).

---

## Roadmap

Legenda de esforço: **P** pequeno, **M** médio, **G** grande.
Risco considera exposição de segurança ao liberar o recurso.

### Bloco A — Percepção (o que destrava tudo)

#### 1. `device-screenshot` — captura de tela

- **O que:** capturar tela inteira, um monitor ou uma região, com escala e
  compressão configuráveis. Retornar a imagem para o modelo e para um widget.
- **Por quê:** é a feature que transforma "controlar PC" em "agente que
  resolve". Permite verificar se a ação anterior funcionou e corrigir o rumo.
- **Contrato:** `device-screenshot` com
  `{ deviceId, monitor?, region?, format?, quality?, maxWidth? }`.
  Resultado com `imageUrl` (ou referência de armazenamento), `width`, `height`
  e `monitors[]`.
- **Onde mexer:** `spectral/shared/device-commands.ts`,
  `spectral/driver/src/commands/screen.ts`, `lib/ai/tools/device-tools.ts`,
  prompt em `lib/ai/prompts/sections/devices.ts`, widget de visualização.
- **Atenção:** base64 de imagem não cabe no `maxPayload` de 256 KB. Salvar em
  storage e devolver uma URL/referência, ou criar um canal binário separado.
- **Pronto quando:** a IA tira um print, vê a imagem, clica em um elemento e
  confirma por um segundo print.
- **Esforço:** M · **Risco:** M (privacidade da tela).

#### 2. `device-list-windows` + `device-focus-window` — janelas ✅

- **Status:** implementado. Contrato em `spectral/shared/device-commands.ts`,
  driver em `spectral/driver/src/commands/windows.ts`, tools
  `device-list-windows`/`device-focus-window` e `windowId` opcional em
  `device-type-text`/`device-press-key`.
- **O que:** listar janelas abertas (título, processo, bounds, foco) e focar uma
  janela por id ou título.
- **Por quê:** elimina o risco de digitar na janela errada e permite "abra o VS
  Code e vá para a janela X".
- **Onde mexer:** contrato compartilhado, driver (`window.ts` por plataforma),
  tools e prompt.
- **Pronto quando:** `type-text`/`press-key` puderem ser precedidos por foco
  explícito e o prompt orientar esse fluxo.
- **Esforço:** M · **Risco:** baixo.
- **Limites:** `windowId` com até 128 caracteres (`^[A-Za-z0-9:._-]+$`),
  `list-windows` com `limit` de 1 a 30 (padrão 20) e título/processo truncados.
  Windows usa PowerShell + P/Invoke; macOS usa System Events (exige
  Acessibilidade); Linux usa `wmctrl`/`xdotool` em X11, com
  `unsupported_environment` no Wayland.

#### 3. Mouse — `device-click`, `device-move-mouse`, `device-scroll`, `device-drag`

- **O que:** controle de mouse por coordenada (e, no futuro, por elemento).
- **Por quê:** combinado com screenshot, fecha o ciclo completo de automação de
  GUI (clicar, verificar, corrigir).
- **Onde mexer:** driver (API nativa por plataforma), contrato, tools, prompt.
- **Pronto quando:** um fluxo de clicar/arrastar/rolar for executado e verificado
  por screenshot.
- **Esforço:** M · **Risco:** alto (ações destrutivas) — exige aprovação.

#### 4. Clipboard — `device-read-clipboard` / `device-write-clipboard`

- **O que:** ler e escrever a área de transferência do PC.
- **Por quê:** baixo risco e utilidade enorme ("manda esse texto pro PC",
  "pega o que eu copiei").
- **Onde mexer:** driver, contrato, tools e prompt.
- **Pronto quando:** copiar/colar entre chat e dispositivo funcionar nos três
  sistemas.
- **Esforço:** P · **Risco:** baixo.

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
Itens 1, 2, 3, 4 → screenshot + janelas + mouse + clipboard. Já permite
demonstrar automação real de GUI.

**Fase 2 — "confiança para soltar o poder"**
Itens 7, 15, 16, 14 → `run-command` em camadas + política por dispositivo +
aprovação + auditoria. Fazer isso **antes** de liberar shell, não depois.

**Fase 3 — "produto instalável"**
Itens 10, 11, 12, 13 → instalador/tray/autostart, auto-update, capabilities e
jobs. Sem isso o resto não chega no usuário comum.

**Fase 4 — expansão**
Itens 5, 6, 8, 9, 17–22.

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
