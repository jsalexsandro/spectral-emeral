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
| `device-type-text` | Digita texto na janela em foco do PC | `{ deviceId, text }` | `ok` (requer aprovação) |
| `device-press-key` | Pressiona uma tecla ou combinação no PC | `{ deviceId, key, modifiers? }` | `ok` (requer aprovação) |
| `device-list-files` | Lista arquivos e pastas do PC (somente leitura) | `{ deviceId, path?, depth?, showHidden?, maxEntries? }` | `entries[]` com nome, caminho, tipo, tamanho e modificação |
| `device-read-file` | Lê conteúdo de texto de um arquivo (somente leitura) | `{ deviceId, path, offset?, limit? }` | `file` com `content`, linhas e `truncated` |
| `device-glob` | Busca arquivos por padrão glob (somente leitura) | `{ deviceId, pattern, path?, showHidden?, maxResults? }` | `paths[]` de arquivos |
| `device-grep` | Busca texto dentro de arquivos (somente leitura) | `{ deviceId, pattern, path?, glob?, caseSensitive?, maxResults? }` | `matches[]` com arquivo, linha, coluna e trecho |
| `device-check-admin` | Verifica se o dispositivo está com privilégios de administrador | `{ deviceId }` | `admin: true/false` |

### Detalhes

- `device-get-os` retorna dados reais do driver (`node:os`), incluindo `elevated`
  para indicar se o driver está rodando com privilégios de administrador.
- `device-open-url` aceita apenas `http://` e `https://`, até 2048 caracteres,
  sem usuário/senha na URL.
- `device-open-app` aceita apenas `appId` da allowlist do driver:
  `chrome`, `edge`, `firefox`, `notepad`, `explorer`, `vscode`, `terminal` e
  `calculator`. Use `device-list-apps` antes para descobrir os ids disponíveis.
- `device-type-text` aceita de 1 a 2000 caracteres e rejeita caracteres de
  controle (exceto tab, CR e LF). O texto vai para a janela que estiver em foco;
  o driver não escolhe a janela.
- `device-press-key` aceita letras `a-z`, dígitos `0-9`, `enter`, `tab`,
  `escape`, `backspace`, `delete`, `space`, `insert`, setas, `home`, `end`,
  `pageup`, `pagedown` e `f1`-`f12`, com modificadores `ctrl`, `alt`, `shift` e
  `meta`. As combinações `alt+F4` e `ctrl+alt+delete` são bloqueadas.
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
- `device-screenshot` ainda **não** está implementada.

## Regras de segurança

- Só dispositivos online e pertencentes ao usuário autenticado aceitam comandos.
- Um comando em voo por PC; o próximo recebe `device_busy` até o anterior terminar.
- Timeout padrão de 15s por comando (máximo de 60s).
- O endpoint interno do backend exige `x-internal-secret` e nunca deve ser
  exposto publicamente.
- `device-type-text` e `device-press-key` podem afetar qualquer janela em foco.
  O prompt exige confirmação antes de conteúdo sensível e proíbe senhas.
- O driver não executa shell arbitrário, não escreve/edita arquivos e não captura
  tela. A leitura de arquivos é restrita à pasta de usuário com sandbox e denylist
  de caminhos sensíveis (`.ssh`, `.gnupg`, `.aws`, credenciais, perfis de
  navegador, arquivos do sistema, etc.).
- O driver deve ser iniciado com privilégios de administrador (PowerShell como
  Administrador ou `sudo`) para que comandos futuros possam ser elevados. Isso é
  refletido em `device-get-os` (`elevated`).

## Aprovação no chat

- `device-type-text` e `device-press-key` exigem aprovação explícita antes de
  executar. Quando o assistente tenta usá-las, o chat exibe botões "Aprovar" e
  "Recusar". O comando só é enviado ao dispositivo após o usuário aprovar.
- Se o usuário recusar, o comando não é executado e o assistente é informado.
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

## Referências

- Contrato compartilhado: `spectral/shared/device-commands.ts`
- Tools do chat: `lib/ai/tools/device-tools.ts`
- Cliente do backend: `lib/devices/command-client.ts`
- Prompt: `lib/ai/prompts/sections/devices.ts` (`SYSTEM_PROMPT_VERSION = 11`)
- Backend: `spectral/backend/src/websocket/command-bus.ts` e `spectral/backend/src/http/internal.ts`
- Driver: `spectral/driver/src/commands/executor.ts` e
  `spectral/driver/src/commands/files.ts`
- Arquitetura completa: `specs/devices-connect.md`


testar muito essa api de device, adicionar mais funcionalidades deixar ela mais completa.
da privilegios de adm pro driver pra ele executar funções complexas
no futuro implemntar um ferramente pra ele fazer task complexas e ter feedback da tela